use parking_lot::Mutex;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager, State};

const MIGRATION: &str = r#"
CREATE TABLE IF NOT EXISTS tool_presets (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,
  name TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS user_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS recent_jobs (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,
  status TEXT NOT NULL,
  input_count INTEGER NOT NULL,
  output_count INTEGER NOT NULL,
  manifest_path TEXT,
  finished_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_outbox (
  client_mutation_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"#;

pub fn migrate(connection: &Connection) -> rusqlite::Result<()> {
    connection.execute_batch(MIGRATION)
}

pub struct LocalStore {
    connection: Mutex<Connection>,
}

impl LocalStore {
    pub fn open(app: &AppHandle) -> Result<Self, String> {
        let directory = app
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())?;
        fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
        Self::open_path(directory.join("lightops-v2.sqlite3"))
    }

    fn open_path(path: PathBuf) -> Result<Self, String> {
        let connection = Connection::open(path).map_err(|error| error.to_string())?;
        migrate(&connection).map_err(|error| error.to_string())?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentJob {
    pub id: String,
    pub tool_id: String,
    pub status: String,
    pub input_count: u32,
    pub output_count: u32,
    pub manifest_path: Option<String>,
    pub finished_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolPreset {
    pub id: String,
    pub tool_id: String,
    pub name: String,
    pub payload: serde_json::Value,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutboxMutation {
    client_mutation_id: String,
    entity_type: String,
    entity_id: String,
    op: String,
    payload: Option<serde_json::Value>,
    client_modified_at: String,
    attempts: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteChange {
    entity_type: String,
    entity_id: String,
    operation: String,
    payload: Option<serde_json::Value>,
}

#[tauri::command]
pub fn record_recent_job(store: State<'_, LocalStore>, job: RecentJob) -> Result<(), String> {
    store
        .connection
        .lock()
        .execute(
            "INSERT OR REPLACE INTO recent_jobs (id, tool_id, status, input_count, output_count, manifest_path, finished_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![job.id, job.tool_id, job.status, job.input_count, job.output_count, job.manifest_path, job.finished_at],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_recent_jobs(store: State<'_, LocalStore>) -> Result<Vec<RecentJob>, String> {
    let connection = store.connection.lock();
    let mut statement = connection
        .prepare("SELECT id, tool_id, status, input_count, output_count, manifest_path, finished_at FROM recent_jobs ORDER BY finished_at DESC LIMIT 20")
        .map_err(|error| error.to_string())?;
    let jobs = statement
        .query_map([], |row| {
            Ok(RecentJob {
                id: row.get(0)?,
                tool_id: row.get(1)?,
                status: row.get(2)?,
                input_count: row.get(3)?,
                output_count: row.get(4)?,
                manifest_path: row.get(5)?,
                finished_at: row.get(6)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(jobs)
}

#[tauri::command]
pub fn upsert_tool_preset(store: State<'_, LocalStore>, preset: ToolPreset) -> Result<(), String> {
    let mutation_id = uuid::Uuid::new_v4().to_string();
    let sync_payload = serde_json::json!({
        "toolId": preset.tool_id,
        "name": preset.name,
        "payload": preset.payload,
    });
    let mut connection = store.connection.lock();
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "INSERT INTO tool_presets (id, tool_id, name, payload_json, updated_at, deleted_at) VALUES (?1, ?2, ?3, ?4, ?5, NULL) ON CONFLICT(id) DO UPDATE SET tool_id = excluded.tool_id, name = excluded.name, payload_json = excluded.payload_json, updated_at = excluded.updated_at, deleted_at = NULL",
            params![preset.id, preset.tool_id, preset.name, preset.payload.to_string(), preset.updated_at],
        )
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "INSERT INTO sync_outbox (client_mutation_id, entity_type, entity_id, operation, payload_json, created_at) VALUES (?1, 'preset', ?2, 'upsert', ?3, ?4)",
            params![mutation_id, preset.id, sync_payload.to_string(), preset.updated_at],
        )
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_tool_presets(
    store: State<'_, LocalStore>,
    tool_id: Option<String>,
) -> Result<Vec<ToolPreset>, String> {
    let connection = store.connection.lock();
    let sql = if tool_id.is_some() {
        "SELECT id, tool_id, name, payload_json, updated_at FROM tool_presets WHERE deleted_at IS NULL AND tool_id = ?1 ORDER BY name"
    } else {
        "SELECT id, tool_id, name, payload_json, updated_at FROM tool_presets WHERE deleted_at IS NULL ORDER BY tool_id, name"
    };
    let mut statement = connection.prepare(sql).map_err(|error| error.to_string())?;
    let map_row =
        |row: &rusqlite::Row<'_>| -> rusqlite::Result<(String, String, String, String, String)> {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        };
    let rows = if let Some(tool_id) = tool_id {
        statement
            .query_map(params![tool_id], map_row)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
    } else {
        statement
            .query_map([], map_row)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
    };
    rows.into_iter()
        .map(|(id, tool_id, name, payload, updated_at)| {
            Ok(ToolPreset {
                id,
                tool_id,
                name,
                payload: serde_json::from_str(&payload).map_err(|error| error.to_string())?,
                updated_at,
            })
        })
        .collect()
}

#[tauri::command]
pub fn delete_tool_preset(store: State<'_, LocalStore>, id: String) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    let mutation_id = uuid::Uuid::new_v4().to_string();
    let mut connection = store.connection.lock();
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "UPDATE tool_presets SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1",
            params![id, now],
        )
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "INSERT INTO sync_outbox (client_mutation_id, entity_type, entity_id, operation, payload_json, created_at) VALUES (?1, 'preset', ?2, 'delete', NULL, ?3)",
            params![mutation_id, id, now],
        )
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_user_setting(
    store: State<'_, LocalStore>,
    key: String,
    value: serde_json::Value,
) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    let mutation_id = uuid::Uuid::new_v4().to_string();
    let mut connection = store.connection.lock();
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "INSERT INTO user_settings (key, value_json, updated_at, deleted_at) VALUES (?1, ?2, ?3, NULL) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at, deleted_at = NULL",
            params![key, value.to_string(), &now],
        )
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "INSERT INTO sync_outbox (client_mutation_id, entity_type, entity_id, operation, payload_json, created_at) VALUES (?1, 'setting', ?2, 'upsert', ?3, ?4)",
            params![mutation_id, key, value.to_string(), now],
        )
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_user_settings(
    store: State<'_, LocalStore>,
) -> Result<std::collections::HashMap<String, serde_json::Value>, String> {
    let connection = store.connection.lock();
    let mut statement = connection
        .prepare("SELECT key, value_json FROM user_settings WHERE deleted_at IS NULL")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?;
    let mut settings = std::collections::HashMap::new();
    for row in rows {
        let (key, value) = row.map_err(|error| error.to_string())?;
        settings.insert(
            key,
            serde_json::from_str(&value).map_err(|error| error.to_string())?,
        );
    }
    Ok(settings)
}

#[tauri::command]
pub fn get_sync_device_id(store: State<'_, LocalStore>) -> Result<String, String> {
    let connection = store.connection.lock();
    if let Ok(value) = connection.query_row(
        "SELECT value FROM sync_state WHERE key = 'device_id'",
        [],
        |row| row.get::<_, String>(0),
    ) {
        return Ok(value);
    }
    let device_id = uuid::Uuid::new_v4().to_string();
    connection
        .execute(
            "INSERT INTO sync_state (key, value) VALUES ('device_id', ?1)",
            params![device_id],
        )
        .map_err(|error| error.to_string())?;
    Ok(device_id)
}

#[tauri::command]
pub fn get_sync_cursor(store: State<'_, LocalStore>) -> Result<Option<String>, String> {
    match store.connection.lock().query_row(
        "SELECT value FROM sync_state WHERE key = 'cursor'",
        [],
        |row| row.get::<_, String>(0),
    ) {
        Ok(value) => Ok(Some(value)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn list_sync_outbox(store: State<'_, LocalStore>) -> Result<Vec<OutboxMutation>, String> {
    let connection = store.connection.lock();
    let mut statement = connection
        .prepare("SELECT client_mutation_id, entity_type, entity_id, operation, payload_json, created_at, attempts FROM sync_outbox ORDER BY created_at LIMIT 100")
        .map_err(|error| error.to_string())?;
    let mutations = statement
        .query_map([], |row| {
            let payload: Option<String> = row.get(4)?;
            Ok(OutboxMutation {
                client_mutation_id: row.get(0)?,
                entity_type: row.get(1)?,
                entity_id: row.get(2)?,
                op: row.get(3)?,
                payload: payload.and_then(|value| serde_json::from_str(&value).ok()),
                client_modified_at: row.get(5)?,
                attempts: row.get(6)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(mutations)
}

#[tauri::command]
pub fn record_sync_failure(
    store: State<'_, LocalStore>,
    mutation_ids: Vec<String>,
) -> Result<(), String> {
    let connection = store.connection.lock();
    for mutation_id in mutation_ids {
        connection
            .execute(
                "UPDATE sync_outbox SET attempts = attempts + 1 WHERE client_mutation_id = ?1",
                params![mutation_id],
            )
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn apply_sync_response(
    store: State<'_, LocalStore>,
    applied_mutation_ids: Vec<String>,
    changes: Vec<RemoteChange>,
    next_cursor: String,
) -> Result<(), String> {
    let mut connection = store.connection.lock();
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    for mutation_id in applied_mutation_ids {
        transaction
            .execute(
                "DELETE FROM sync_outbox WHERE client_mutation_id = ?1",
                params![mutation_id],
            )
            .map_err(|error| error.to_string())?;
    }
    let now = chrono::Utc::now().to_rfc3339();
    for change in changes {
        let deleted_at = (change.operation == "delete").then_some(now.as_str());
        let payload = change.payload.unwrap_or(serde_json::Value::Null);
        if change.entity_type == "setting" {
            transaction
                .execute(
                    "INSERT INTO user_settings (key, value_json, updated_at, deleted_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at",
                    params![change.entity_id, payload.to_string(), &now, deleted_at],
                )
                .map_err(|error| error.to_string())?;
        } else {
            let stored_payload = payload
                .get("payload")
                .cloned()
                .unwrap_or_else(|| payload.clone());
            let tool_id = payload
                .get("toolId")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("unknown");
            let name = payload
                .get("name")
                .and_then(serde_json::Value::as_str)
                .unwrap_or(&change.entity_id);
            transaction
                .execute(
                    "INSERT INTO tool_presets (id, tool_id, name, payload_json, updated_at, deleted_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(id) DO UPDATE SET tool_id = excluded.tool_id, name = excluded.name, payload_json = excluded.payload_json, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at",
                    params![change.entity_id, tool_id, name, stored_payload.to_string(), &now, deleted_at],
                )
                .map_err(|error| error.to_string())?;
        }
    }
    transaction
        .execute(
            "INSERT INTO sync_state (key, value) VALUES ('cursor', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![next_cursor],
        )
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_create_all_local_first_tables() {
        let connection = Connection::open_in_memory().expect("sqlite");
        migrate(&connection).expect("migration");
        let mut statement = connection
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
            .expect("query");
        let names = statement
            .query_map([], |row| row.get::<_, String>(0))
            .expect("rows")
            .collect::<Result<Vec<_>, _>>()
            .expect("names");

        for expected in [
            "tool_presets",
            "user_settings",
            "recent_jobs",
            "sync_outbox",
            "sync_state",
        ] {
            assert!(names.contains(&expected.to_string()), "missing {expected}");
        }
    }
}
