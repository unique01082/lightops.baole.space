import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { tauriMediaClient } from './media-client';
import type { JobProgress } from './media-contracts';

export type SequenceKind = 'hdr' | 'panorama' | 'focus' | 'burst' | 'review';

export type SequenceGroup = {
  id: string;
  kind: SequenceKind;
  confidence: number;
  paths: string[];
  evidence: string[];
  excluded: boolean;
};

export type MetadataCategory =
  | 'location'
  | 'device_identity'
  | 'people'
  | 'edit_history'
  | 'embedded_preview';

export type MetadataAudit = {
  path: string;
  tags: Record<string, unknown>;
  safeShareCategories: MetadataCategory[];
};

export type BeforeAfterPair = {
  id: string;
  beforePath: string;
  afterPath: string;
  confidence: number;
  evidence: string[];
};

export type ExportResult = { outputs: string[]; warnings: string[] };

export type AdvancedClient = {
  pickImages(): Promise<string[]>;
  pickInputFolder(): Promise<string[]>;
  pickOutputDirectory(): Promise<string | null>;
  analyzeSequences(paths: string[], maxGapSeconds: number): Promise<SequenceGroup[]>;
  exportSequences(outputDir: string, groups: SequenceGroup[]): Promise<string>;
  auditMetadata(paths: string[]): Promise<MetadataAudit[]>;
  cleanMetadata(
    paths: string[],
    outputDir: string,
    categories: MetadataCategory[],
  ): Promise<ExportResult>;
  suggestPairs(paths: string[]): Promise<BeforeAfterPair[]>;
  exportBeforeAfter(request: {
    outputDir: string;
    pairs: BeforeAfterPair[];
    formats: string[];
    longEdge: number;
    durationSeconds: number;
    stillFormat: 'jpeg' | 'png';
    zoom: number;
    offsetX: number;
    offsetY: number;
  }): Promise<ExportResult>;
  cancelJob(jobId: string): Promise<void>;
  subscribeJobProgress?(onProgress: (progress: JobProgress) => void): Promise<() => void>;
};

export const tauriAdvancedClient: AdvancedClient = {
  pickImages: () => tauriMediaClient.pickImages(),
  pickInputFolder: () => tauriMediaClient.pickInputFolder(),
  pickOutputDirectory: () => tauriMediaClient.pickOutputDirectory(),
  analyzeSequences: (paths, maxGapSeconds) => invoke('analyze_sequences', { paths, maxGapSeconds }),
  exportSequences: (outputDir, groups) =>
    invoke('export_sequences', { request: { outputDir, groups } }),
  auditMetadata: (paths) => invoke('audit_metadata', { paths }),
  cleanMetadata: (paths, outputDir, categories) =>
    invoke('clean_metadata', { request: { paths, outputDir, categories } }),
  suggestPairs: (paths) => invoke('suggest_before_after_pairs', { paths }),
  exportBeforeAfter: (request) => invoke('export_before_after', { request }),
  cancelJob: (jobId) => invoke('cancel_tool_job', { jobId }),
  subscribeJobProgress: (onProgress) => {
    if (!isTauri()) return Promise.resolve(() => undefined);
    return listen<JobProgress>('lightops://job-progress', ({ payload }) => onProgress(payload));
  },
};
