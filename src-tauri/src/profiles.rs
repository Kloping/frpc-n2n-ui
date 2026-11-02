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

#[derive(Deserialize)]
struct RawFrpcConfig {
    #[serde(rename = "serverAddr")]
    server_addr: String,
    #[serde(rename = "serverPort", default = "default_server_port")]
    server_port: u16,
    #[serde(default)]
    user: String,
    #[serde(default)]
    auth: Option<RawAuth>,
    #[serde(default)]
    transport: Option<RawTransport>,
    #[serde(rename = "webServer", default)]
    web_server: Option<RawWebServer>,
    #[serde(default)]
    proxies: Vec<RawProxy>,
}

#[derive(Deserialize)]
struct RawAuth {
    #[serde(default)]
    token: String,
}

#[derive(Deserialize)]
struct RawTransport {
    #[serde(default)]
    protocol: String,
}

#[derive(Deserialize)]
struct RawWebServer {
    #[serde(default)]
    port: Option<u16>,
}

#[derive(Deserialize)]
struct RawProxy {
    #[serde(default)]
    name: String,
    #[serde(rename = "type")]
    kind: String,
    #[serde(rename = "localIP", alias = "localIp", default = "default_local_ip")]
    local_ip: String,
    #[serde(rename = "localPort")]
    local_port: u16,
    #[serde(rename = "remotePort", default)]
    remote_port: Option<u16>,
    #[serde(rename = "customDomains", default)]
    custom_domains: Vec<String>,
    #[serde(default)]
    subdomain: String,
    #[serde(rename = "secretKey", default)]
    secret_key: String,
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

fn default_server_port() -> u16 {
    7000
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

fn parse_range(value: &str) -> Result<Vec<u16>, String> {
    let value = value.trim();
    let (start, end) = match value.split_once('-') {
        Some((start, end)) => (start.trim(), end.trim()),
        None => (value, value),
    };
    let start: u16 = start
        .parse()
        .map_err(|_| format!("端口区间非法：{value}"))?;
    let end: u16 = end.parse().map_err(|_| format!("端口区间非法：{value}"))?;
    if start == 0 || end == 0 || start > end {
        return Err(format!("端口区间非法：{value}"));
    }
    Ok((start..=end).collect())
}

fn parse_number_range_pair(line: &str) -> Result<(Vec<u16>, Vec<u16>), String> {
    let quoted: Vec<&str> = line.split('"').skip(1).step_by(2).collect();
    if quoted.len() < 2 {
        return Err("parseNumberRangePair 需要两个端口区间参数".into());
    }
    let first = parse_range(quoted[0])?;
    let second = parse_range(quoted[1])?;
    if first.len() != second.len() {
        return Err("多端口映射的本地与远程区间数量不一致".into());
    }
    Ok((first, second))
}

fn render_template_line(line: &str, first: u16, second: u16) -> String {
    let mut result = String::with_capacity(line.len());
    let mut rest = line;
    while let Some(start) = rest.find("{{") {
        result.push_str(&rest[..start]);
        let after = &rest[start + 2..];
        let Some(end) = after.find("}}") else {
            result.push_str(&rest[start..]);
            return result;
        };
        let token = after[..end].trim();
        match token.strip_suffix(".First") {
            Some(_) => result.push_str(&first.to_string()),
            None => match token.strip_suffix(".Second") {
                Some(_) => result.push_str(&second.to_string()),
                None => result.push_str(&rest[start..start + 2 + end + 2]),
            },
        }
        rest = &after[end + 2..];
    }
    result.push_str(rest);
    result
}

// shortcut: 只展开单层 parseNumberRangePair 模板，出现嵌套模板时升级为通用模板引擎。
fn expand_template(text: &str) -> Result<String, String> {
    let lines: Vec<&str> = text.lines().collect();
    let mut output = String::with_capacity(text.len());
    let mut index = 0;
    while index < lines.len() {
        let line = lines[index];
        if line.contains("range") && line.contains("parseNumberRangePair") {
            let mut end = index + 1;
            while end < lines.len() {
                let trimmed = lines[end].trim();
                if trimmed.starts_with("{{") && trimmed.contains("end") {
                    break;
                }
                end += 1;
            }
            if end >= lines.len() {
                return Err("多端口映射模板缺少结束标记".into());
            }

            let (first, second) = parse_number_range_pair(line)?;
            for position in 0..first.len() {
                for inner in &lines[index + 1..end] {
                    output.push_str(&render_template_line(inner, first[position], second[position]));
                    output.push('\n');
                }
            }
            index = end + 1;
        } else {
            output.push_str(line);
            output.push('\n');
            index += 1;
        }
    }
    Ok(output)
}

fn parse_profile_toml(text: &str, base: &Profile) -> Result<Profile, String> {
    let text = expand_template(text)?;
    let RawFrpcConfig {
        server_addr,
        server_port,
        user,
        auth,
        transport,
        web_server,
        proxies,
    } = toml::from_str(&text)
        .map_err(|error| format!("解析 TOML 配置失败（仅支持新版 frpc TOML）：{error}"))?;

    let proxy_configs = proxies
        .into_iter()
        .enumerate()
        .map(|(index, proxy)| Proxy {
            id: format!("{}-{}", base.id, index),
            name: proxy.name.trim().to_string(),
            kind: proxy.kind.trim().to_ascii_lowercase(),
            local_ip: toml_value(&proxy.local_ip)
                .unwrap_or("127.0.0.1")
                .to_string(),
            local_port: proxy.local_port,
            remote_port: proxy.remote_port,
            custom_domains: proxy
                .custom_domains
                .into_iter()
                .filter_map(|domain| toml_value(&domain).map(str::to_string))
                .collect(),
            subdomain: proxy.subdomain.trim().to_string(),
            secret_key: proxy.secret_key.trim().to_string(),
        })
        .collect();

    let profile = Profile {
        id: base.id.clone(),
        name: base.name.clone(),
        server_addr: server_addr.trim().to_string(),
        server_port,
        token: auth
            .map(|auth| auth.token)
            .unwrap_or_default()
            .trim()
            .to_string(),
        protocol: {
            let protocol = transport
                .map(|transport| transport.protocol)
                .unwrap_or_else(default_protocol)
                .trim()
                .to_ascii_lowercase();
            if protocol.is_empty() {
                default_protocol()
            } else {
                protocol
            }
        },
        user: user.trim().to_string(),
        admin_port: web_server
            .and_then(|web_server| web_server.port)
            .unwrap_or(base.admin_port),
        auto_start: base.auto_start,
        proxies: proxy_configs,
    };

    validate_profiles(std::slice::from_ref(&profile))?;
    Ok(profile)
}

fn toml_path(path: &str) -> Result<PathBuf, String> {
    let mut path = PathBuf::from(path);
    match path.extension().and_then(|ext| ext.to_str()) {
        None => {
            path.set_extension("toml");
            Ok(path)
        }
        Some(ext) if ext.eq_ignore_ascii_case("toml") => Ok(path),
        Some(_) => Err("仅支持 .toml 格式的新版 frpc 配置".into()),
    }
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

#[tauri::command]
pub fn export_profile_config(path: String, profile: Profile) -> Result<(), String> {
    let path = toml_path(&path)?;
    validate_profiles(std::slice::from_ref(&profile))?;
    let text = build_toml(&profile)?;
    fs::write(&path, text).map_err(|error| format!("写入 {} 失败：{error}", path.display()))
}

#[tauri::command]
pub fn import_profile_config(path: String, profile: Profile) -> Result<Profile, String> {
    let path = toml_path(&path)?;
    let text = fs::read_to_string(&path)
        .map_err(|error| format!("读取 {} 失败：{error}", path.display()))?;
    parse_profile_toml(&text, &profile)
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

    #[test]
    fn imports_new_style_toml() {
        let base = Profile {
            id: "profile-1".into(),
            name: "公司内网".into(),
            server_addr: String::new(),
            server_port: 7000,
            token: String::new(),
            protocol: "tcp".into(),
            user: String::new(),
            admin_port: 7400,
            auto_start: false,
            proxies: Vec::new(),
        };
        let text = r#"
serverAddr = "203.0.113.10"
serverPort = 7000
user = "alice"
transport.protocol = "kcp"
auth.token = "secret"
webServer.port = 7401

[[proxies]]
name = "web"
type = "tcp"
localIP = "127.0.0.1"
localPort = 5173
remotePort = 6000
"#;

        let imported = parse_profile_toml(text, &base).expect("toml should parse");
        assert_eq!(imported.id, "profile-1");
        assert_eq!(imported.name, "公司内网");
        assert_eq!(imported.server_addr, "203.0.113.10");
        assert_eq!(imported.protocol, "kcp");
        assert_eq!(imported.token, "secret");
        assert_eq!(imported.admin_port, 7401);
        assert_eq!(imported.proxies[0].remote_port, Some(6000));
    }

    #[test]
    fn imports_number_range_pair_template() {
        let base = Profile {
            id: "profile-1".into(),
            name: "香港代理".into(),
            server_addr: String::new(),
            server_port: 7000,
            token: String::new(),
            protocol: "tcp".into(),
            user: String::new(),
            admin_port: 7400,
            auto_start: false,
            proxies: Vec::new(),
        };
        let text = r#"
serverAddr = "154.201.83.159"
serverPort = 7000
auth.token = "123224"

{{- range $_, $v := parseNumberRangePair "21000-21002" "31000-31002" }}
[[proxies]]
name = "app-tcp-{{ $v.First }}"
type = "tcp"
localIP = "127.0.0.1"
localPort = {{ $v.First }}
remotePort = {{ $v.Second }}
{{- end }}

[[proxies]]
name = "nfl-mut"
type = "tcp"
localIP = "127.0.0.1"
localPort = 11101
remotePort = 11101
"#;

        let imported =
            parse_profile_toml(text, &base).expect("template toml should parse");
        assert_eq!(imported.proxies.len(), 4);
        assert_eq!(imported.proxies[0].name, "app-tcp-21000");
        assert_eq!(imported.proxies[0].local_port, 21000);
        assert_eq!(imported.proxies[0].remote_port, Some(31000));
        assert_eq!(imported.proxies[2].name, "app-tcp-21002");
        assert_eq!(imported.proxies[3].name, "nfl-mut");
    }
}
