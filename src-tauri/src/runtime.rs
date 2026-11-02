use serde::Serialize;
use std::collections::{HashMap, VecDeque};
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Manager, State};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const MAX_LOG_LINES: usize = 200;

#[derive(Default)]
pub struct RuntimeState {
    children: Mutex<HashMap<String, Child>>,
    errors: Mutex<HashMap<String, String>>,
    logs: Arc<Mutex<HashMap<String, VecDeque<String>>>>,
}

#[derive(Serialize)]
pub struct RuntimeInfo {
    running: bool,
    pid: Option<u32>,
    error: Option<String>,
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
}

fn frpc_binary(app: &AppHandle) -> Result<PathBuf, String> {
    let triple = match std::env::consts::ARCH {
        "aarch64" => "aarch64-pc-windows-msvc",
        _ => "x86_64-pc-windows-msvc",
    };
    let mut candidates = vec![
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join(format!("frpc-{triple}.exe")),
    ];

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("frpc.exe"));
        candidates.push(resource_dir.join(format!("frpc-{triple}.exe")));
    }
    if let Ok(exe) = std::env::current_exe()
        && let Some(dir) = exe.parent()
    {
        candidates.push(dir.join("frpc.exe"));
        candidates.push(dir.join(format!("frpc-{triple}.exe")));
    }

    candidates
        .into_iter()
        .find(|path| path.is_file())
        .ok_or_else(|| "找不到 frpc.exe，请确认 src-tauri/binaries 下已放入对应文件".into())
}

fn verify_config(binary: &Path, config: &Path) -> Result<(), String> {
    let mut command = Command::new(binary);
    command.arg("verify").arg("-c").arg(config);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let output = command
        .output()
        .map_err(|error| format!("运行 frpc verify 失败：{error}"))?;
    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let detail = if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        format!("退出码 {}", output.status)
    };
    let detail: String = detail.chars().take(600).collect();
    Err(format!("frpc 配置校验失败：{detail}"))
}

fn strip_ansi(line: &str) -> String {
    let mut output = String::with_capacity(line.len());
    let mut chars = line.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\x1b' {
            if chars.peek() == Some(&'[') {
                chars.next();
                for code in chars.by_ref() {
                    if ('@'..='~').contains(&code) {
                        break;
                    }
                }
            }
            continue;
        }
        output.push(ch);
    }
    output
}

fn spawn_log_reader<R: Read + Send + 'static>(
    id: String,
    stream: R,
    logs: Arc<Mutex<HashMap<String, VecDeque<String>>>>,
) {
    thread::spawn(move || {
        let reader = BufReader::new(stream);
        for line in reader.lines().map_while(Result::ok) {
            let line = strip_ansi(&line);
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            if let Ok(mut logs) = logs.lock() {
                let lines = logs.entry(id.clone()).or_default();
                lines.push_back(line.to_string());
                while lines.len() > MAX_LOG_LINES {
                    lines.pop_front();
                }
            }
        }
    });
}

fn spawn_frpc(
    binary: &Path,
    config: &Path,
    id: &str,
    logs: Arc<Mutex<HashMap<String, VecDeque<String>>>>,
) -> Result<Child, String> {
    let mut command = Command::new(binary);
    command
        .arg("-c")
        .arg(config)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let mut child = command
        .spawn()
        .map_err(|error| format!("启动 frpc 失败：{error}"))?;
    if let Some(stdout) = child.stdout.take() {
        spawn_log_reader(id.to_string(), stdout, logs.clone());
    }
    if let Some(stderr) = child.stderr.take() {
        spawn_log_reader(id.to_string(), stderr, logs);
    }
    Ok(child)
}

impl RuntimeState {
    pub fn stop_all(&self) {
        if let Ok(mut children) = self.children.lock() {
            for (_, mut child) in children.drain() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
        if let Ok(mut errors) = self.errors.lock() {
            errors.clear();
        }
        if let Ok(mut logs) = self.logs.lock() {
            logs.clear();
        }
    }
}

#[tauri::command]
pub fn start_profiles(
    app: AppHandle,
    state: State<'_, RuntimeState>,
    ids: Vec<String>,
) -> Result<(), String> {
    if ids.is_empty() {
        return Ok(());
    }

    let binary = frpc_binary(&app)?;
    let config_dir = super::profiles::config_dir(&app)?.join("frpc");
    let mut children = state
        .children
        .lock()
        .map_err(|_| "无法锁定 frpc 进程表".to_string())?;
    let mut errors = state
        .errors
        .lock()
        .map_err(|_| "无法锁定 frpc 错误表".to_string())?;
    let mut failures = Vec::new();

    for id in ids {
        if !valid_id(&id) {
            failures.push(format!("服务器 ID 非法：{id}"));
            continue;
        }
        if children.contains_key(&id) {
            continue;
        }

        if let Ok(mut logs) = state.logs.lock() {
            logs.remove(&id);
        }
        let config = config_dir.join(format!("{id}.toml"));
        if !config.is_file() {
            let error = format!("找不到配置文件：{}", config.display());
            errors.insert(id.clone(), error.clone());
            failures.push(format!("{id}: {error}"));
            continue;
        }
        if let Err(error) = verify_config(&binary, &config) {
            errors.insert(id.clone(), error.clone());
            failures.push(format!("{id}: {error}"));
            continue;
        }

        match spawn_frpc(&binary, &config, &id, state.logs.clone()) {
            Ok(child) => {
                children.insert(id.clone(), child);
                errors.remove(&id);
            }
            Err(error) => {
                errors.insert(id.clone(), error.clone());
                failures.push(format!("{id}: {error}"));
            }
        }
    }

    if failures.is_empty() {
        Ok(())
    } else {
        Err(failures.join("\n"))
    }
}

#[tauri::command]
pub fn stop_profiles(state: State<'_, RuntimeState>, ids: Vec<String>) -> Result<(), String> {
    let mut children = state
        .children
        .lock()
        .map_err(|_| "无法锁定 frpc 进程表".to_string())?;
    let mut errors = state
        .errors
        .lock()
        .map_err(|_| "无法锁定 frpc 错误表".to_string())?;
    for id in ids {
        if let Some(mut child) = children.remove(&id) {
            let _ = child.kill();
            let _ = child.wait();
        }
        errors.remove(&id);
    }

    Ok(())
}

#[tauri::command]
pub fn runtime_snapshot(
    state: State<'_, RuntimeState>,
) -> Result<HashMap<String, RuntimeInfo>, String> {
    let mut children = state
        .children
        .lock()
        .map_err(|_| "无法锁定 frpc 进程表".to_string())?;
    let mut errors = state
        .errors
        .lock()
        .map_err(|_| "无法锁定 frpc 错误表".to_string())?;
    let logs = state
        .logs
        .lock()
        .map_err(|_| "无法锁定 frpc 日志表".to_string())?;

    let mut exited = Vec::new();
    for (id, child) in children.iter_mut() {
        match child.try_wait() {
            Ok(Some(status)) => exited.push((id.clone(), format!("frpc 已退出（{status}）"))),
            Ok(None) => {}
            Err(error) => exited.push((id.clone(), format!("读取 frpc 状态失败：{error}"))),
        }
    }
    for (id, message) in exited {
        children.remove(&id);
        let detail = logs
            .get(&id)
            .and_then(|lines| lines.back())
            .cloned();
        let error = match detail {
            Some(detail) => format!("{detail}\n{message}"),
            None => message,
        };
        errors.insert(id, error);
    }

    let mut snapshot = HashMap::new();
    for (id, child) in children.iter() {
        snapshot.insert(
            id.clone(),
            RuntimeInfo {
                running: true,
                pid: Some(child.id()),
                error: None,
            },
        );
    }
    for (id, error) in errors.iter() {
        snapshot.entry(id.clone()).or_insert_with(|| RuntimeInfo {
            running: false,
            pid: None,
            error: Some(error.clone()),
        });
    }

    Ok(snapshot)
}

#[tauri::command]
pub fn profile_logs(
    state: State<'_, RuntimeState>,
    id: String,
) -> Result<Vec<String>, String> {
    if !valid_id(&id) {
        return Err("服务器 ID 非法".into());
    }
    let logs = state
        .logs
        .lock()
        .map_err(|_| "无法锁定 frpc 日志表".to_string())?;
    Ok(logs
        .get(&id)
        .map(|lines| lines.iter().cloned().collect())
        .unwrap_or_default())
}

#[tauri::command]
pub fn clear_logs(state: State<'_, RuntimeState>, id: String) -> Result<(), String> {
    if !valid_id(&id) {
        return Err("服务器 ID 非法".into());
    }
    let mut logs = state
        .logs
        .lock()
        .map_err(|_| "无法锁定 frpc 日志表".to_string())?;
    logs.remove(&id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_ansi_sequences() {
        assert_eq!(strip_ansi("\u{1b}[1;34mhello\u{1b}[0m"), "hello");
    }
}
