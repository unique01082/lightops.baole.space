use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

const OIDC_EVENT: &str = "lightops://oidc-callback";
const KEYRING_SERVICE: &str = "space.baole.lightops";
const SESSION_KEYRING_USER: &str = "oidc-session";
const STATE_KEYRING_USER: &str = "oidc-state";

fn parse_callback_target(request_line: &str) -> Option<&str> {
    let mut parts = request_line.split_whitespace();
    (parts.next()? == "GET")
        .then(|| parts.next())
        .flatten()
        .filter(|target| {
            target
                .split_once('?')
                .map_or(*target == "/auth/callback", |(path, _)| {
                    path == "/auth/callback"
                })
        })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OidcListener {
    redirect_uri: String,
}

#[tauri::command]
pub async fn start_oidc_callback_listener(app: AppHandle) -> Result<OidcListener, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|error| error.to_string())?;
    let address = listener.local_addr().map_err(|error| error.to_string())?;
    let redirect_uri = format!("http://127.0.0.1:{}/auth/callback", address.port());
    let callback_base = redirect_uri.clone();
    tauri::async_runtime::spawn(async move {
        let accepted = listener.accept().await;
        let Ok((mut stream, _)) = accepted else {
            return;
        };
        let mut buffer = vec![0_u8; 16 * 1024];
        let Ok(read) = stream.read(&mut buffer).await else {
            return;
        };
        let request = String::from_utf8_lossy(&buffer[..read]);
        let target = request.lines().next().and_then(parse_callback_target);
        if let Some(target) = target {
            let callback = format!(
                "{}{}",
                callback_base.trim_end_matches("/auth/callback"),
                target
            );
            let _ = app.emit(OIDC_EVENT, callback);
            let body = "<!doctype html><meta charset=utf-8><title>LightOps</title><style>body{font:16px system-ui;background:#111;color:#fff;display:grid;min-height:90vh;place-items:center}</style><p>Signed in to LightOps. You can close this window.</p>";
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(), body
            );
            let _ = stream.write_all(response.as_bytes()).await;
        } else {
            let _ = stream
                .write_all(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n")
                .await;
        }
    });
    Ok(OidcListener { redirect_uri })
}

fn credential_entry(user: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, user).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn store_oidc_session(session: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&session).map_err(|error| error.to_string())?;
    credential_entry(SESSION_KEYRING_USER)?
        .set_password(&session)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn load_oidc_session() -> Result<Option<String>, String> {
    match credential_entry(SESSION_KEYRING_USER)?.get_password() {
        Ok(session) => Ok(Some(session)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn clear_oidc_session() -> Result<(), String> {
    match credential_entry(SESSION_KEYRING_USER)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn load_state_map() -> Result<std::collections::HashMap<String, String>, String> {
    match credential_entry(STATE_KEYRING_USER)?.get_password() {
        Ok(value) => serde_json::from_str(&value).map_err(|error| error.to_string()),
        Err(keyring::Error::NoEntry) => Ok(std::collections::HashMap::new()),
        Err(error) => Err(error.to_string()),
    }
}

fn save_state_map(states: &std::collections::HashMap<String, String>) -> Result<(), String> {
    let entry = credential_entry(STATE_KEYRING_USER)?;
    if states.is_empty() {
        return match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(error.to_string()),
        };
    }
    entry
        .set_password(&serde_json::to_string(states).map_err(|error| error.to_string())?)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_oidc_state(key: String, value: String) -> Result<(), String> {
    let mut states = load_state_map()?;
    states.insert(key, value);
    save_state_map(&states)
}

#[tauri::command]
pub fn get_oidc_state(key: String) -> Result<Option<String>, String> {
    Ok(load_state_map()?.get(&key).cloned())
}

#[tauri::command]
pub fn remove_oidc_state(key: String) -> Result<Option<String>, String> {
    let mut states = load_state_map()?;
    let value = states.remove(&key);
    save_state_map(&states)?;
    Ok(value)
}

#[tauri::command]
pub fn list_oidc_state_keys() -> Result<Vec<String>, String> {
    Ok(load_state_map()?.into_keys().collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn callback_parser_only_accepts_the_loopback_oidc_path() {
        assert_eq!(
            parse_callback_target("GET /auth/callback?code=abc&state=123 HTTP/1.1"),
            Some("/auth/callback?code=abc&state=123")
        );
        assert_eq!(parse_callback_target("GET /other HTTP/1.1"), None);
        assert_eq!(
            parse_callback_target("GET /auth/callback-evil HTTP/1.1"),
            None
        );
        assert_eq!(parse_callback_target("POST /auth/callback HTTP/1.1"), None);
    }
}
