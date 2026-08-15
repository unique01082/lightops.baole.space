import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import type { JobProgress, JobResult, MediaAsset, ToolJobRequest } from './media-contracts';

export type MediaClient = {
  pickImages(): Promise<string[]>;
  pickInputFolder(): Promise<string[]>;
  pickOutputDirectory(): Promise<string | null>;
  inspect(paths: string[]): Promise<MediaAsset[]>;
  runJob(request: ToolJobRequest, onProgress?: (progress: JobProgress) => void): Promise<JobResult>;
  cancelJob(jobId: string): Promise<void>;
  copyOutputImage(path: string): Promise<void>;
};

export const tauriMediaClient: MediaClient = {
  async pickImages() {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [
        { name: 'Rendered images', extensions: ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'webp'] },
      ],
    });
    if (!selected) return [];
    return Array.isArray(selected) ? selected : [selected];
  },

  async pickOutputDirectory() {
    const selected = await open({ multiple: false, directory: true });
    return typeof selected === 'string' ? selected : null;
  },

  async pickInputFolder() {
    const selected = await open({ multiple: false, directory: true });
    if (typeof selected !== 'string') return [];
    return invoke<string[]>('expand_media_paths', { paths: [selected] });
  },

  inspect(paths) {
    return invoke<MediaAsset[]>('inspect_media', { paths });
  },

  async runJob(request, onProgress) {
    return new Promise<JobResult>((resolve, reject) => {
      let stopProgress: (() => void) | undefined;
      let stopFinished: (() => void) | undefined;
      const cleanup = () => {
        stopProgress?.();
        stopFinished?.();
      };

      void (async () => {
        try {
          stopProgress = await listen<JobProgress>('lightops://job-progress', ({ payload }) => {
            if (payload.jobId === request.jobId) onProgress?.(payload);
          });
          stopFinished = await listen<JobResult>('lightops://job-finished', ({ payload }) => {
            if (payload.jobId !== request.jobId) return;
            cleanup();
            resolve(payload);
          });
          await invoke('start_tool_job', { request });
        } catch (error) {
          cleanup();
          reject(error);
        }
      })();
    });
  },

  cancelJob(jobId) {
    return invoke('cancel_tool_job', { jobId });
  },

  copyOutputImage(path) {
    return invoke('copy_output_image', { path });
  },
};
