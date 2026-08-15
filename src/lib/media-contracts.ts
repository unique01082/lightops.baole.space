export type ToolId =
  | 'ingest_rename'
  | 'resize'
  | 'minimize'
  | 'sequence_grouper'
  | 'metadata_cleaner'
  | 'before_after';

export type MediaAsset = {
  id: string;
  path: string;
  format: string;
  width: number;
  height: number;
  byteSize: number;
  bitDepth: number;
  hasAlpha: boolean;
  hasIccProfile: boolean;
  orientation: number;
};

export type ResizeOptions = {
  type: 'resize';
  mode: 'width' | 'height' | 'long_edge' | 'percentage';
  value: number;
  allowUpscale: boolean;
  outputFormat: 'source' | 'jpg' | 'png' | 'tiff' | 'webp';
  quality?: number;
  suffix: string;
};

export type MinimizeOptions = {
  type: 'minimize';
  mode: 'lossless' | 'compressed';
  quality: number;
  targetBytes?: number;
  outputFormat: 'source' | 'jpg' | 'png' | 'tiff' | 'webp';
  suffix: string;
};

export type ToolOptions =
  | ResizeOptions
  | MinimizeOptions
  | { type: 'sequence_grouper'; maxGapSeconds: number }
  | { type: 'metadata_cleaner'; categories: string[] }
  | { type: 'before_after'; format: string }
  | { type: 'ingest_rename' };

export type ToolJobRequest = {
  schemaVersion: 1;
  jobId: string;
  toolId: ToolId;
  inputs: string[];
  outputDir: string;
  options: ToolOptions;
};

export type JobProgress = {
  jobId: string;
  phase: string;
  current: number;
  total: number;
  itemId?: string;
  messageKey: string;
};

export type OutputAsset = {
  sourcePath: string;
  outputPath: string;
  byteSize: number;
  width: number;
  height: number;
  savingsBytes: number;
};

export type JobResult = {
  jobId: string;
  status: 'completed' | 'cancelled' | 'failed';
  outputs: OutputAsset[];
  warnings: string[];
  manifestPath?: string;
};
