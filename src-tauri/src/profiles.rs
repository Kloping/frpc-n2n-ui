use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub server_addr: String,
    pub server_port: u16,
    #[serde(default)]
    pub token: String,
    #[serde(default = "default_protocol")]
    pub protocol: String,
    #[serde(default)]
    pub user: String,
    pub admin_port: u16,
    #[serde(default)]
    pub auto_start: bool,
    #[serde(default)]
    pub proxies: Vec<Proxy>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Proxy {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(rename = "localIP", alias = "localIp", default = "default_local_ip")]
    pub local_ip: String,
    pub local_port: u16,
    #[serde(default)]
    pub remote_port: Option<u16>,
    #[serde(default)]
    pub custom_domains: Vec<String>,
    #[serde(default)]
    pub subdomain: String,
    #[serde(default)]
    pub secret_key: String,
}

#[derive(Serialize)]
struct FrpcConfig<'a> {
    #[serde(rename = "serverAddr")]
    server_addr: &'a str,
    #[serde(rename = "serverPort")]
    server_port: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    user: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    auth: Option<Auth<'a>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    transport: Option<Transport<'a>>,
    #[serde(rename = "webServer")]
    web_server: WebServer,
    proxies: Vec<ProxyConfig<'a>>,
}

#[derive(Serialize)]
struct Auth<'a> {
    method: &'static str,
    token: &'a str,
}

#[derive(Serialize)]
struct Transport<'a> {
    protocol: &'a str,
}

#[derive(Serialize)]
struct WebServer {
    addr: &'static str,
    port: u16,
}

#[derive(Serialize)]
struct ProxyConfig<'a> {
    name: &'a str,
    #[serde(rename = "type")]
    kind: &'a str,
    #[serde(rename = "localIP")]
    local_ip: &'a str,
    #[serde(rename = "localPort")]
    local_port: u16,
    #[serde(rename = "remotePort", skip_serializing_if = "Option::is_none")]
    remote_port: Option<u16>,
    #[serde(rename = "customDomains", skip_serializing_if = "Option::is_none")]
    custom_domains: Option<Vec<&'a str>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    subdomain: Option<&'a str>,
    #[serde(rename = "secretKey", skip_serializing_if = "Option::is_none")]
    secret_key: Option<&'a str>,
}

fn default_protocol() -> String {
    "tcp".into()
}

fn default_local_ip() -> String {
    "127.0.0.1".into()
}

pub(crate) fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|error| format!("无法定位配置目录：{error}"))
}

fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let temp = path.with_extension("tmp");
    fs::write(&temp, bytes).map_err(|error| format!("写入 {} 失败：{error}", temp.display()))?;
    fs::rename(&temp, path).map_err(|error| format!("保存 {} 失败：{error}", path.display()))
}

fn toml_value<'a>(value: &'a str) -> Option<&'a str> {
    let value = value.trim();
    (!value.is_empty()).then_some(value)
}

fn build_toml(profile: &Profile) -> Result<String, String> {
    let token = toml_value(&profile.token);
    let user = toml_value(&profile.user);
    let protocol = profile.protocol.as_str();
    let proxies = profile
        .proxies
        .iter()
        .map(|proxy| {
            let remote_port = matches!(proxy.kind.as_str(), "tcp" | "udp" | "sudp")
                .then_some(proxy.remote_port)
                .flatten();
            let custom_domains: Vec<&str> = proxy
                .custom_domains
                .iter()
                .filter_map(|domain| toml_value(domain))
                .collect();

            ProxyConfig {
                name: proxy.name.trim(),
                kind: proxy.kind.as_str(),
                local_ip: toml_value(&proxy.local_ip).unwrap_or("127.0.0.1"),
                local_port: proxy.local_port,
                remote_port,
                custom_domains: (!custom_domains.is_empty()).then_some(custom_domains),
                subdomain: toml_value(&proxy.subdomain),
                secret_key: toml_value(&proxy.secret_key),
            }
        })
        .collect();

    let config = FrpcConfig {
        server_addr: profile.server_addr.trim(),
        server_port: profile.server_port,
        user,
        auth: token.map(|token| Auth {
            method: "token",
            token,
        }),
        transport: (protocol != "tcp").then_some(Transport { protocol }),
        web_server: WebServer {
            addr: "127.0.0.1",
            port: profile.admin_port,
        },
        proxies,
    };

    toml::to_string_pretty(&config).map_err(|error| format!("生成 frpc 配置失败：{error}"))
}

fn validate_profiles(profiles: &[Profile]) -> Result<(), String> {
    let mut profile_ids = HashSet::new();
    let mut profile_names = HashSet::new();
    let mut admin_ports = HashSet::new();

    for profile in profiles {
        if profile.id.is_empty()
            || !profile
                .id
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
        {
            return Err("服务器配置 ID 非法".into());
        }
        if !profile_ids.insert(profile.id.as_str()) {
            return Err(format!("服务器配置 ID 重复：{}", profile.id));
        }
        let name = profile.name.trim();
        if name.is_empty() {
            return Err("服务器名称不能为空".into());
        }
        if !profile_names.insert(name) {
            return Err(format!("服务器名称重复：{name}"));
        }
        if profile.server_addr.trim().is_empty() {
            return Err(format!("「{name}」的服务器地址不能为空"));
        }
        if profile.server_port == 0 {
            return Err(format!("「{name}」的服务器端口无效"));
        }
        if profile.admin_port == 0 {
            return Err(format!("「{name}」的管理端口无效"));
        }
        if !admin_ports.insert(profile.admin_port) {
            return Err(format!("管理端口重复：{}", profile.admin_port));
        }
        if !matches!(
            profile.protocol.as_str(),
            "tcp" | "kcp" | "quic" | "websocket"
        ) {
            return Err(format!("「{name}」的传输协议不受支持"));
        }

        let mut proxy_names = HashSet::new();
        for proxy in &profile.proxies {
            let proxy_name = proxy.name.trim();
            if proxy.id.trim().is_empty() {
                return Err(format!("「{name}」下存在无效的转发 ID"));
            }
            if proxy_name.is_empty() {
                return Err(format!("「{name}」下的转发名称不能为空"));
            }
            if !proxy_names.insert(proxy_name) {
                return Err(format!("「{name}」下的转发名称重复：{proxy_name}"));
            }
            if proxy.local_port == 0 {
                return Err(format!("「{proxy_name}」的本地端口无效"));
            }
            if !matches!(
                proxy.kind.as_str(),
                "tcp" | "udp" | "http" | "https" | "stcp" | "xtcp" | "sudp"
            ) {
                return Err(format!("「{proxy_name}」的转发类型不受支持"));
            }

            match proxy.kind.as_str() {
                "tcp" | "udp" | "sudp" => {
                    if proxy.remote_port.unwrap_or(0) == 0 {
                        return Err(format!("「{proxy_name}」需要填写远端端口"));
                    }
                }
                "http" | "https" => {
                    let has_domain = proxy
                        .custom_domains
                        .iter()
                        .any(|domain| !domain.trim().is_empty());
                    if !has_domain && proxy.subdomain.trim().is_empty() {
                        return Err(format!("「{proxy_name}」需要填写域名或子域名"));
                    }
                }
                "stcp" | "xtcp" => {
                    if proxy.secret_key.trim().is_empty() {
                        return Err(format!("「{proxy_name}」需要填写 secretKey"));
                    }
                }
                _ => {}
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn load_profiles(app: AppHandle) -> Result<Vec<Profile>, String> {
    let path = config_dir(&app)?.join("profiles.json");
    if !path.exists() {
        return Ok(Vec::new());
    }
    let text = fs::read_to_string(&path)
        .map_err(|error| format!("读取 {} 失败：{error}", path.display()))?;
    serde_json::from_str(&text).map_err(|error| format!("解析 {} 失败：{error}", path.display()))
}

#[tauri::command]
pub fn save_profiles(app: AppHandle, profiles: Vec<Profile>) -> Result<Vec<String>, String> {
    validate_profiles(&profiles)?;

    let dir = config_dir(&app)?;
    let frpc_dir = dir.join("frpc");
    fs::create_dir_all(&frpc_dir).map_err(|error| format!("创建配置目录失败：{error}"))?;

    let configs = profiles
        .iter()
        .map(|profile| Ok((profile.id.clone(), build_toml(profile)?)))
        .collect::<Result<Vec<_>, String>>()?;

    let json = serde_json::to_string_pretty(&profiles)
        .map_err(|error| format!("序列化服务器配置失败：{error}"))?;
    write_atomic(&dir.join("profiles.json"), json.as_bytes())?;

    let mut paths = Vec::with_capacity(configs.len());
    for (id, toml) in configs {
        let path = frpc_dir.join(format!("{id}.toml"));
        write_atomic(&path, toml.as_bytes())?;
        paths.push(path.to_string_lossy().into_owned());
    }

    let active_ids: HashSet<&str> = profiles.iter().map(|profile| profile.id.as_str()).collect();
    if let Ok(entries) = fs::read_dir(&frpc_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let is_toml = path.extension().and_then(|ext| ext.to_str()) == Some("toml");
            let stem = path.file_stem().and_then(|stem| stem.to_str()).unwrap_or("");
            if is_toml && !active_ids.contains(stem) {
                let _ = fs::remove_file(path);
            }
        }
    }

    Ok(paths)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_toml_has_expected_shape() {
        let profile = Profile {
            id: "profile-1".into(),
            name: "公司内网".into(),
            server_addr: "203.0.113.10".into(),
            server_port: 7000,
            token: "secret".into(),
            protocol: "tcp".into(),
            user: String::new(),
            admin_port: 7400,
            auto_start: false,
            proxies: vec![Proxy {
                id: "proxy-1".into(),
                name: "web".into(),
                kind: "tcp".into(),
                local_ip: "127.0.0.1".into(),
                local_port: 5173,
                remote_port: Some(6000),
                custom_domains: Vec::new(),
                subdomain: String::new(),
                secret_key: String::new(),
            }],
        };

        let text = build_toml(&profile).expect("toml should serialize");
        let value: toml::Value = toml::from_str(&text).expect("toml should parse");

        assert_eq!(value["serverAddr"].as_str(), Some("203.0.113.10"));
        assert_eq!(value["webServer"]["port"].as_integer(), Some(7400));
        assert_eq!(
            value["proxies"][0]["remotePort"].as_integer(),
            Some(6000)
        );
    }
}
