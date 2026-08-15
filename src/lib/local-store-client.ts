import { invoke } from '@tauri-apps/api/core';

export type RecentJob = {
  id: string;
  toolId: string;
  status: 'completed' | 'cancelled' | 'failed';
  inputCount: number;
  outputCount: number;
  manifestPath?: string;
  finishedAt: string;
};

export type ToolPreset = {
  id: string;
  toolId: string;
  name: string;
  payload: unknown;
  updatedAt: string;
};

const RECENT_JOBS_CHANGED = 'lightops:recent-jobs-changed';

export async function listRecentJobs(): Promise<RecentJob[]> {
  try {
    return await invoke<RecentJob[]>('list_recent_jobs');
  } catch {
    return [];
  }
}

export async function recordRecentJob(job: RecentJob): Promise<void> {
  try {
    await invoke('record_recent_job', { job });
    window.dispatchEvent(new Event(RECENT_JOBS_CHANGED));
  } catch {
    // Browser previews and tests do not have a native SQLite bridge.
  }
}

export function subscribeToRecentJobs(callback: () => void): () => void {
  window.addEventListener(RECENT_JOBS_CHANGED, callback);
  return () => window.removeEventListener(RECENT_JOBS_CHANGED, callback);
}

export async function listUserSettings(): Promise<Record<string, unknown>> {
  try {
    return await invoke<Record<string, unknown>>('list_user_settings');
  } catch {
    return {};
  }
}

export async function setUserSetting(key: string, value: unknown): Promise<void> {
  try {
    await invoke('set_user_setting', { key, value });
  } catch {
    // Browser previews and tests do not have a native SQLite bridge.
  }
}

export async function listToolPresets(toolId: string): Promise<ToolPreset[]> {
  try {
    return await invoke<ToolPreset[]>('list_tool_presets', { toolId });
  } catch {
    return [];
  }
}

export async function upsertToolPreset(preset: ToolPreset): Promise<void> {
  await invoke('upsert_tool_preset', { preset });
}

export async function deleteToolPreset(id: string): Promise<void> {
  await invoke('delete_tool_preset', { id });
}
