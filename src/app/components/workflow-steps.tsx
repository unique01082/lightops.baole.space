import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock3,
  FolderSearch,
  Gauge,
  Settings2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButtons } from './action-buttons';
import { AdvancedOptionsPanel } from './advanced-options-panel';
import { CameraFormatPanel } from './camera-format-panel';
import { LogEntry, LogPanel } from './log-panel';
import { OutputFolderPanel } from './output-folder-panel';
import { Preset } from './preset-panel';
import { ProgressBar } from './progress-bar';
import { RenameSettingsPanel } from './rename-settings-panel';
import { SourceFoldersPanel } from './source-folders-panel';

type AppStatus = 'idle' | 'processing' | 'complete' | 'stopped' | 'error';

export interface SourceMetadata {
  folder: string;
  sample_file?: string | null;
  camera_make?: string | null;
  camera_model?: string | null;
  capture_time?: string | null;
  detected_extensions: string[];
  raw_extensions: string[];
  jpg_count: number;
  raw_count: number;
  video_count: number;
}

export interface FolderTimeOffset {
  folder: string;
  offset_ms: number;
  label: string;
}

interface StepFrameProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

function StepFrame({ eyebrow, title, description, children, footer }: StepFrameProps) {
  return (
    <section className="flex h-full min-h-0 flex-col">
      <header
        className="shrink-0 border-b px-5 py-4"
        style={{ borderColor: 'var(--glass-divider)' }}
      >
        <p className="text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--text-muted)' }}>
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl text-white" style={{ fontFamily: 'var(--font-heading)' }}>
          {title}
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      {footer && (
        <footer
          className="shrink-0 border-t px-5 py-4"
          style={{ borderColor: 'var(--glass-divider)' }}
        >
          {footer}
        </footer>
      )}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'normal',
}: {
  label: string;
  value: string;
  tone?: 'normal' | 'warning';
}) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{
        background: tone === 'warning' ? 'rgba(247, 151, 30, 0.1)' : 'rgba(255,255,255,0.04)',
        borderColor: tone === 'warning' ? 'rgba(247, 151, 30, 0.3)' : 'var(--glass-border)',
      }}
    >
      <p className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="mt-1 truncate text-sm text-white" title={value}>
        {value}
      </p>
    </div>
  );
}

export interface SourceStepProps {
  folders: string[];
  outputFolder: string;
  onAddFolder: () => void;
  onRemoveFolder: (index: number) => void;
  onBrowseOutput: () => void;
  onOutputChange: (value: string) => void;
  onNext: () => void;
}

export function SourceStep({
  folders,
  outputFolder,
  onAddFolder,
  onRemoveFolder,
  onBrowseOutput,
  onOutputChange,
  onNext,
}: SourceStepProps) {
  const { t } = useTranslation();
  return (
    <StepFrame
      eyebrow={t('workflow.source.eyebrow')}
      title={t('workflow.source.title')}
      description={t('workflow.source.description')}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {folders.length > 0
              ? t('workflow.source.selected', { count: folders.length })
              : t('workflow.source.empty')}
          </span>
          <button
            type="button"
            disabled={folders.length === 0}
            onClick={onNext}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'var(--accent-lightops)' }}
          >
            {t('workflow.source.continue')}
          </button>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <SourceFoldersPanel
          folders={folders}
          onAddFolder={onAddFolder}
          onRemoveFolder={onRemoveFolder}
        />
        <OutputFolderPanel
          outputFolder={outputFolder}
          onBrowse={onBrowseOutput}
          onChange={onOutputChange}
        />
      </div>
    </StepFrame>
  );
}

export interface ScanStepProps {
  folders: string[];
  metadata: SourceMetadata[];
  offsets: FolderTimeOffset[];
  isScanning: boolean;
  onScan: () => void;
  onOffsetChange: (folder: string, offsetMs: number) => void;
  onLabelChange: (folder: string, label: string) => void;
  onBack: () => void;
  onNext: () => void;
}

const OFFSET_UNITS = {
  m: 30 * 24 * 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  h: 60 * 60 * 1000,
  p: 60 * 1000,
  s: 1000,
  ms: 1,
};

const SLIDER_RANGE_MS = 60 * 60 * 1000;

function parseOffsetExpression(value: string) {
  const compact = value.trim().replace(/\s+/g, '').toLowerCase();
  if (!compact) return 0;

  const globalSign = compact.startsWith('-') ? -1 : 1;
  const body = compact.replace(/^[+-]/, '');
  const pattern = /([+-]?\d+(?:\.\d+)?)(ms|m|d|h|p|s)/g;
  let match: RegExpExecArray | null;
  let cursor = 0;
  let total = 0;

  while ((match = pattern.exec(body))) {
    if (match.index !== cursor) return null;
    const amount = Number(match[1]);
    const unit = match[2] as keyof typeof OFFSET_UNITS;
    if (!Number.isFinite(amount)) return null;
    total += amount * OFFSET_UNITS[unit];
    cursor = pattern.lastIndex;
  }

  if (cursor !== body.length) return null;
  return Math.trunc(total * globalSign);
}

function formatOffsetExpression(offsetMs: number) {
  if (offsetMs === 0) return '0ms';
  const sign = offsetMs < 0 ? '-' : '';
  let remaining = Math.abs(offsetMs);
  const parts: string[] = [];

  for (const [unit, size] of Object.entries(OFFSET_UNITS)) {
    const count = Math.floor(remaining / size);
    if (count > 0) {
      parts.push(`${count}${unit}`);
      remaining -= count * size;
    }
  }

  return `${sign}${parts.join('') || '0ms'}`;
}

function formatOffset(offsetMs: number, referenceLabel: string) {
  if (offsetMs === 0) return referenceLabel;
  const sign = offsetMs > 0 ? '+' : '-';
  const abs = Math.abs(offsetMs);
  const days = Math.floor(abs / OFFSET_UNITS.d);
  const hours = Math.floor((abs % OFFSET_UNITS.d) / OFFSET_UNITS.h);
  const minutes = Math.floor((abs % OFFSET_UNITS.h) / OFFSET_UNITS.p);
  const seconds = Math.floor((abs % OFFSET_UNITS.p) / OFFSET_UNITS.s);
  const ms = abs % OFFSET_UNITS.s;
  return `${sign}${[
    days ? `${days}d` : '',
    hours ? `${hours}h` : '',
    minutes ? `${minutes}p` : '',
    seconds ? `${seconds}s` : '',
    ms ? `${ms}ms` : '',
  ]
    .filter(Boolean)
    .join(' ')}`;
}

function cameraLabel(item: SourceMetadata, offset?: FolderTimeOffset, unknownCamera?: string) {
  if (offset?.label?.trim()) return offset.label;
  return [item.camera_make, item.camera_model].filter(Boolean).join(' ') || unknownCamera || '';
}

export function ScanStep({
  folders,
  metadata,
  offsets,
  isScanning,
  onScan,
  onOffsetChange,
  onLabelChange,
  onBack,
  onNext,
}: ScanStepProps) {
  const { t } = useTranslation();
  const [offsetDrafts, setOffsetDrafts] = useState<Record<string, string>>({});
  const [offsetErrors, setOffsetErrors] = useState<Record<string, string>>({});
  const sliderLimit = SLIDER_RANGE_MS;

  const commitOffsetDraft = (folder: string, fallbackMs: number) => {
    const draft = offsetDrafts[folder];
    if (draft === undefined) return;
    const parsed = parseOffsetExpression(draft);
    if (parsed === null) {
      setOffsetErrors((prev) => ({ ...prev, [folder]: t('shared.invalidSyntax') }));
      return;
    }
    onOffsetChange(folder, parsed);
    setOffsetDrafts((prev) => {
      const next = { ...prev };
      delete next[folder];
      return next;
    });
    setOffsetErrors((prev) => {
      const next = { ...prev };
      delete next[folder];
      return next;
    });
    if (parsed !== fallbackMs) {
      return;
    }
  };

  return (
    <StepFrame
      eyebrow={t('workflow.scan.eyebrow')}
      title={t('workflow.scan.title')}
      description={t('workflow.scan.description')}
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border px-4 py-2 text-sm"
            style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}
          >
            {t('workflow.scan.back')}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onScan}
              disabled={isScanning || folders.length === 0}
              className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-40"
              style={{ borderColor: 'var(--glass-border)', color: 'var(--text-primary)' }}
            >
              {isScanning ? t('workflow.scan.scanning') : t('workflow.scan.scan')}
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={metadata.length === 0}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: 'var(--accent-lightops)' }}
            >
              {t('workflow.scan.continue')}
            </button>
          </div>
        </div>
      }
    >
      {metadata.length === 0 ? (
        <div
          className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border text-center"
          style={{ borderColor: 'var(--glass-border)', background: 'rgba(255,255,255,0.04)' }}
        >
          <FolderSearch className="mb-3 h-10 w-10" style={{ color: 'var(--accent)' }} />
          <h3 className="text-lg text-white">{t('workflow.scan.emptyTitle')}</h3>
          <p className="mt-2 max-w-md text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('workflow.scan.emptyBody')}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          <div
            className="rounded-3xl border p-5"
            style={{
              borderColor: 'var(--glass-border)',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.075), rgba(139,92,246,0.08))',
            }}
          >
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p
                  className="text-xs uppercase tracking-[0.28em]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {t('workflow.scan.equalizerEyebrow')}
                </p>
                <h3 className="mt-1 text-xl text-white">{t('workflow.scan.equalizerTitle')}</h3>
              </div>
              <div className="text-right text-xs" style={{ color: 'var(--text-secondary)' }}>
                <p>{t('workflow.scan.equalizerRange')}</p>
                <p>{t('workflow.scan.equalizerSyntax')}</p>
                <p>{t('workflow.scan.equalizerUnits')}</p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[86px_1fr]">
              <div
                className="hidden flex-col justify-between py-12 text-right text-xs xl:flex"
                style={{ color: 'var(--text-muted)' }}
              >
                <span>{formatOffset(sliderLimit, t('shared.referenceTime'))}</span>
                <span>{t('shared.referenceTime')}</span>
                <span>
                  -{formatOffset(sliderLimit, t('shared.referenceTime')).replace(/^\+/, '')}
                </span>
              </div>
              <div className="min-w-0 overflow-x-auto pb-2">
                <div
                  className="grid min-w-max auto-cols-[150px] grid-flow-col gap-4 rounded-2xl border px-4 py-5"
                  style={{
                    borderColor: 'rgba(255,255,255,0.08)',
                    background:
                      'repeating-linear-gradient(to bottom, transparent 0, transparent 78px, rgba(255,255,255,0.08) 79px, transparent 80px)',
                  }}
                >
                  {metadata.map((item) => {
                    const offset = offsets.find((entry) => entry.folder === item.folder);
                    const offsetMs = offset?.offset_ms ?? 0;
                    const draftValue =
                      offsetDrafts[item.folder] ?? formatOffsetExpression(offsetMs);
                    return (
                      <div key={item.folder} className="flex flex-col items-center">
                        <span
                          className="mb-3 h-3 w-3 rounded-full"
                          style={{
                            background:
                              offsetMs === 0
                                ? 'rgba(255,255,255,0.35)'
                                : offsetMs > 0
                                  ? 'var(--log-ok)'
                                  : 'var(--log-error)',
                            boxShadow:
                              offsetMs === 0 ? 'none' : '0 0 18px rgba(56, 239, 125, 0.28)',
                          }}
                        />
                        <input
                          type="range"
                          min={-sliderLimit}
                          max={sliderLimit}
                          step={1000}
                          value={Math.max(-sliderLimit, Math.min(sliderLimit, offsetMs))}
                          onChange={(event) =>
                            onOffsetChange(item.folder, Number(event.target.value))
                          }
                          className="h-64 w-8 accent-emerald-400"
                          style={{
                            writingMode: 'vertical-lr',
                            direction: 'rtl',
                          }}
                          aria-label={`${cameraLabel(item, offset, t('shared.unknownCamera'))} ${t('shared.timeOffset')}`}
                        />
                        <span
                          className="mt-3 max-w-[130px] truncate text-center text-xs font-semibold text-white"
                          title={cameraLabel(item, offset, t('shared.unknownCamera'))}
                        >
                          {cameraLabel(item, offset, t('shared.unknownCamera'))}
                        </span>
                        <span className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {formatOffset(offsetMs, t('shared.referenceTime'))}
                        </span>
                        <div className="mt-3 grid w-full grid-cols-3 gap-1">
                          {[
                            ['-1h', -60 * 60 * 1000],
                            ['-5p', -5 * 60 * 1000],
                            ['0', 0],
                            ['+5p', 5 * 60 * 1000],
                            ['+30p', 30 * 60 * 1000],
                            ['+1h', 60 * 60 * 1000],
                          ].map(([label, value]) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => onOffsetChange(item.folder, Number(value))}
                              className="rounded-md border px-1.5 py-1 text-[10px]"
                              style={{
                                borderColor: 'var(--glass-border)',
                                color: 'var(--text-secondary)',
                                background: 'rgba(255,255,255,0.04)',
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <input
                          value={draftValue}
                          onChange={(event) => {
                            setOffsetDrafts((prev) => ({
                              ...prev,
                              [item.folder]: event.target.value,
                            }));
                            setOffsetErrors((prev) => {
                              const next = { ...prev };
                              delete next[item.folder];
                              return next;
                            });
                          }}
                          onBlur={() => commitOffsetDraft(item.folder, offsetMs)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.currentTarget.blur();
                            }
                            if (event.key === 'Escape') {
                              setOffsetDrafts((prev) => {
                                const next = { ...prev };
                                delete next[item.folder];
                                return next;
                              });
                            }
                          }}
                          className="mt-3 w-full rounded-lg border px-2 py-1.5 text-center text-xs"
                          style={{
                            background: 'var(--input-background)',
                            borderColor: offsetErrors[item.folder]
                              ? 'rgba(245, 87, 108, 0.7)'
                              : 'var(--glass-border)',
                            color: 'var(--text-primary)',
                          }}
                          aria-label={`${cameraLabel(item, offset, t('shared.unknownCamera'))} ${t('workflow.scan.exactOffset')}`}
                        />
                        {offsetErrors[item.folder] && (
                          <span className="mt-1 text-[10px]" style={{ color: 'var(--log-error)' }}>
                            {offsetErrors[item.folder]}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {metadata.map((item) => {
            const offset = offsets.find((entry) => entry.folder === item.folder);
            return (
              <div
                key={item.folder}
                className="rounded-2xl border p-4"
                style={{
                  borderColor: 'var(--glass-border)',
                  background: 'rgba(255,255,255,0.04)',
                }}
              >
                <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                      <input
                        value={cameraLabel(item, offset, t('shared.unknownCamera'))}
                        onChange={(event) => onLabelChange(item.folder, event.target.value)}
                        className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm text-white"
                        style={{
                          background: 'var(--input-background)',
                          borderColor: 'var(--glass-border)',
                        }}
                      />
                    </div>
                    <p
                      className="mt-2 truncate text-xs"
                      title={item.folder}
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {item.folder}
                    </p>
                    <div
                      className="mt-3 grid gap-2 text-xs md:grid-cols-2"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span>
                        {t('shared.sample')}:{' '}
                        {item.sample_file
                          ? item.sample_file.split(/[\\/]/).pop()
                          : t('workflow.scan.samplesMissing')}
                      </span>
                      <span>
                        {t('shared.capture')}:{' '}
                        {item.capture_time ?? t('workflow.scan.captureMissing')}
                      </span>
                      <span>
                        {t('cameraFormat.stats.jpg')}: {item.jpg_count}
                      </span>
                      <span>
                        {t('cameraFormat.stats.raw')}: {item.raw_count}
                      </span>
                      <span>
                        {t('cameraFormat.stats.video')}: {item.video_count}
                      </span>
                      <span>
                        {t('shared.extensions')}:{' '}
                        {item.detected_extensions.join(' ') || t('workflow.scan.extensionsMissing')}
                      </span>
                    </div>
                  </div>
                  <div
                    className="rounded-xl border p-3"
                    style={{
                      borderColor: 'rgba(139, 92, 246, 0.25)',
                      background: 'rgba(139, 92, 246, 0.08)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-white">
                        <Clock3 className="h-4 w-4" />
                        {t('shared.timeOffset')}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                        {formatOffset(offset?.offset_ms ?? 0, t('shared.referenceTime'))}
                      </span>
                    </div>
                    <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t('shared.positiveOffsetHint')}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </StepFrame>
  );
}

export interface RulesStepProps {
  metadata: SourceMetadata[];
  rawExtensions: string;
  fileType: 'both' | 'jpg' | 'raw';
  prefix: string;
  format: string;
  startNumber: number;
  recursiveScan: boolean;
  fileOperation: 'copy' | 'move';
  organizeByDate: boolean;
  onlyPaired: boolean;
  includeVideo: boolean;
  allowedFileTypes: Array<'both' | 'jpg' | 'raw'>;
  currentSettings: Omit<Preset, 'name'>;
  onFileTypeChange: (value: 'both' | 'jpg' | 'raw') => void;
  onPrefixChange: (value: string) => void;
  onFormatChange: (value: string) => void;
  onStartNumberChange: (value: number) => void;
  onRecursiveScanChange: (value: boolean) => void;
  onFileOperationChange: (value: 'copy' | 'move') => void;
  onOrganizeByDateChange: (value: boolean) => void;
  onOnlyPairedChange: (value: boolean) => void;
  onIncludeVideoChange: (value: boolean) => void;
  onApplyPreset: (preset: Preset) => void;
  onSavePresetClick: () => void;
  onBack: () => void;
  onNext: () => void;
}

export function RulesStep({
  metadata,
  rawExtensions,
  fileType,
  prefix,
  format,
  startNumber,
  recursiveScan,
  fileOperation,
  organizeByDate,
  onlyPaired,
  includeVideo,
  allowedFileTypes,
  currentSettings,
  onFileTypeChange,
  onPrefixChange,
  onFormatChange,
  onStartNumberChange,
  onRecursiveScanChange,
  onFileOperationChange,
  onOrganizeByDateChange,
  onOnlyPairedChange,
  onIncludeVideoChange,
  onApplyPreset,
  onSavePresetClick,
  onBack,
  onNext,
}: RulesStepProps) {
  const { t } = useTranslation();
  void currentSettings;
  void onApplyPreset;
  return (
    <StepFrame
      eyebrow={t('workflow.rules.eyebrow')}
      title={t('workflow.rules.title')}
      description={t('workflow.rules.description')}
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border px-4 py-2 text-sm"
            style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}
          >
            {t('workflow.rules.back')}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSavePresetClick}
              className="rounded-xl border px-4 py-2 text-sm"
              style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}
            >
              {t('workflow.rules.savePreset')}
            </button>
            <button
              type="button"
              onClick={onNext}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: 'var(--accent-lightops)' }}
            >
              {t('workflow.rules.continue')}
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <CameraFormatPanel
          metadata={metadata}
          rawExtensions={rawExtensions}
          fileType={fileType}
          allowedFileTypes={allowedFileTypes}
          onFileTypeChange={onFileTypeChange}
        />
        <RenameSettingsPanel
          prefix={prefix}
          format={format}
          startNumber={startNumber}
          onPrefixChange={onPrefixChange}
          onFormatChange={onFormatChange}
          onStartNumberChange={onStartNumberChange}
        />
        <div className="xl:col-span-2">
          <AdvancedOptionsPanel
            recursiveScan={recursiveScan}
            fileOperation={fileOperation}
            organizeByDate={organizeByDate}
            onlyPaired={onlyPaired}
            includeVideo={includeVideo}
            onRecursiveScanChange={onRecursiveScanChange}
            onFileOperationChange={onFileOperationChange}
            onOrganizeByDateChange={onOrganizeByDateChange}
            onOnlyPairedChange={onOnlyPairedChange}
            onIncludeVideoChange={onIncludeVideoChange}
          />
        </div>
      </div>
    </StepFrame>
  );
}

export interface ReviewRunStepProps {
  folders: string[];
  outputFolder: string;
  cameraPreset: string;
  rawExtensions: string;
  fileType: 'both' | 'jpg' | 'raw';
  prefix: string;
  format: string;
  startNumber: number;
  recursiveScan: boolean;
  fileOperation: 'copy' | 'move';
  organizeByDate: boolean;
  onlyPaired: boolean;
  includeVideo: boolean;
  metadata: SourceMetadata[];
  offsets: FolderTimeOffset[];
  status: AppStatus;
  progress: { current: number; total: number };
  stats: { ok: number; skip: number; error: number };
  isProcessing: boolean;
  onRun: () => void;
  onDryRun: () => void;
  onStop: () => void;
  onBack: () => void;
}

export function ReviewRunStep({
  folders,
  outputFolder,
  cameraPreset,
  rawExtensions,
  fileType,
  prefix,
  format,
  startNumber,
  recursiveScan,
  fileOperation,
  organizeByDate,
  onlyPaired,
  includeVideo,
  metadata,
  offsets,
  status,
  progress,
  stats,
  isProcessing,
  onRun,
  onDryRun,
  onStop,
  onBack,
}: ReviewRunStepProps) {
  const { t } = useTranslation();
  const destination = outputFolder.trim() || t('workflow.review.renameInPlace');
  const advanced = [
    recursiveScan ? t('advanced.recursive') : t('advanced.topLevelOnly'),
    t(`advanced.${fileOperation}`),
    organizeByDate ? t('advanced.dateFoldersOn') : t('advanced.dateFoldersOff'),
    onlyPaired ? t('advanced.pairedOnly') : t('advanced.singlesAllowed'),
    includeVideo ? t('advanced.videosOn') : t('advanced.videosOff'),
  ].join(' · ');

  return (
    <StepFrame
      eyebrow={t('workflow.review.eyebrow')}
      title={isProcessing ? t('workflow.review.processingTitle') : t('workflow.review.title')}
      description={
        isProcessing ? t('workflow.review.processingDescription') : t('workflow.review.description')
      }
      footer={
        isProcessing ? (
          <button
            type="button"
            onClick={onStop}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
            style={{ background: 'rgba(245, 87, 108, 0.85)' }}
          >
            {t('workflow.review.stop')}
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border px-4 py-2 text-sm"
              style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}
            >
              {t('workflow.review.back')}
            </button>
            <div className="min-w-0 flex-1">
              <ActionButtons
                isProcessing={isProcessing}
                onRun={onRun}
                onDryRun={onDryRun}
                onStop={onStop}
                showStop={false}
              />
            </div>
          </div>
        )
      }
    >
      {isProcessing ? (
        <div className="flex h-full min-h-[320px] flex-col justify-center gap-6">
          <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--glass-border)' }}>
            <ProgressBar current={progress.current} total={progress.total} status={status} />
            <div className="mt-5 grid grid-cols-3 gap-3">
              <SummaryCard label={t('workflow.results.filters.ok')} value={String(stats.ok)} />
              <SummaryCard label={t('workflow.results.filters.skip')} value={String(stats.skip)} />
              <SummaryCard
                label={t('workflow.results.filters.error')}
                value={String(stats.error)}
                tone={stats.error > 0 ? 'warning' : 'normal'}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Settings2 className="h-4 w-4" />
            <span>{t('workflow.review.logsBuffered')}</span>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          <div
            className="rounded-xl border p-3 xl:col-span-2"
            style={{ borderColor: 'var(--glass-border)', background: 'rgba(255,255,255,0.04)' }}
          >
            <p
              className="text-xs uppercase tracking-[0.2em]"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('workflow.review.sourceLabel')}
            </p>
            <div className="mt-2 grid gap-2">
              {folders.map((folder) => (
                <p key={folder} className="truncate text-sm text-white" title={folder}>
                  {folder}
                </p>
              ))}
            </div>
          </div>
          <SummaryCard label={t('workflow.review.destination')} value={destination} />
          <SummaryCard
            label={t('workflow.review.camera')}
            value={`${cameraPreset} · ${rawExtensions}`}
          />
          <SummaryCard label={t('workflow.review.fileType')} value={fileType.toUpperCase()} />
          <SummaryCard
            label={t('workflow.review.rename')}
            value={`${prefix || '(no prefix)'} · ${format} · #${startNumber}`}
          />
          <SummaryCard
            label={t('workflow.review.advanced')}
            value={advanced}
            tone={fileOperation === 'move' ? 'warning' : 'normal'}
          />
          <div
            className="rounded-xl border p-3 xl:col-span-2"
            style={{ borderColor: 'var(--glass-border)', background: 'rgba(255,255,255,0.04)' }}
          >
            <p
              className="text-xs uppercase tracking-[0.2em]"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('workflow.review.clockEqualizer')}
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {metadata.map((item) => {
                const offset = offsets.find((entry) => entry.folder === item.folder);
                return (
                  <div
                    key={item.folder}
                    className="rounded-lg px-3 py-2"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    <p className="truncate text-sm text-white">{cameraLabel(item, offset)}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatOffset(offset?.offset_ms ?? 0, t('shared.referenceTime'))}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          {fileOperation === 'move' && (
            <div
              className="flex items-center gap-2 rounded-xl border p-3 text-sm xl:col-span-2"
              style={{
                borderColor: 'rgba(247, 151, 30, 0.3)',
                color: 'var(--log-warn)',
                background: 'rgba(247, 151, 30, 0.08)',
              }}
            >
              <AlertTriangle className="h-4 w-4" />
              <span>{t('workflow.review.moveWarning')}</span>
            </div>
          )}
        </div>
      )}
    </StepFrame>
  );
}

export interface ResultsStepProps {
  banner: { type: 'success' | 'warning' | 'error'; message: string } | null;
  entries: LogEntry[];
  isDryRun: boolean;
  stats: { ok: number; skip: number; error: number };
  onClear: () => void;
  onBackToRules: () => void;
}

export function ResultsStep({
  banner,
  entries,
  isDryRun,
  stats,
  onClear,
  onBackToRules,
}: ResultsStepProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'all' | LogEntry['type']>('all');
  const icon =
    banner?.type === 'success' ? (
      <CheckCircle className="h-4 w-4" />
    ) : banner?.type === 'warning' ? (
      <AlertTriangle className="h-4 w-4" />
    ) : (
      <AlertCircle className="h-4 w-4" />
    );

  const filteredEntries =
    filter === 'all'
      ? entries
      : entries.filter((entry) => entry.type === filter || entry.type === 'section');

  return (
    <StepFrame
      eyebrow={t('workflow.results.eyebrow')}
      title={t('workflow.results.title')}
      description={t('workflow.results.description')}
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToRules}
            className="rounded-xl border px-4 py-2 text-sm"
            style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}
          >
            {t('workflow.results.back')}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--accent-lightops)' }}
          >
            {t('log.clear')}
          </button>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="grid shrink-0 gap-3 md:grid-cols-3">
          <SummaryCard label={t('results.filters.ok')} value={String(stats.ok)} />
          <SummaryCard
            label={t('results.filters.skip')}
            value={String(stats.skip)}
            tone={stats.skip > 0 ? 'warning' : 'normal'}
          />
          <SummaryCard
            label={t('results.filters.error')}
            value={String(stats.error)}
            tone={stats.error > 0 ? 'warning' : 'normal'}
          />
        </div>
        {banner && (
          <div
            className="flex shrink-0 items-center gap-2 rounded-xl border p-3 text-sm"
            style={{
              borderColor:
                banner.type === 'success'
                  ? 'rgba(56, 239, 125, 0.3)'
                  : banner.type === 'warning'
                    ? 'rgba(247, 151, 30, 0.3)'
                    : 'rgba(245, 87, 108, 0.3)',
              color:
                banner.type === 'success'
                  ? 'var(--log-ok)'
                  : banner.type === 'warning'
                    ? 'var(--log-warn)'
                    : 'var(--log-error)',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            {icon}
            <span>{banner.message}</span>
          </div>
        )}
        <div className="flex shrink-0 flex-wrap gap-2">
          {(['all', 'ok', 'dry', 'skip', 'warn', 'error'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className="rounded-full border px-3 py-1.5 text-xs capitalize"
              style={{
                borderColor: filter === item ? 'rgba(139, 92, 246, 0.55)' : 'var(--glass-border)',
                background: filter === item ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.04)',
                color: filter === item ? 'white' : 'var(--text-secondary)',
              }}
            >
              {t(`workflow.results.filters.${item}`)}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1">
          <LogPanel entries={filteredEntries} isDryRun={isDryRun} stats={stats} onClear={onClear} />
        </div>
      </div>
    </StepFrame>
  );
}
