import { AlertCircle, AlertTriangle, CheckCircle, Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButtons } from './action-buttons';
import { AdvancedOptionsPanel } from './advanced-options-panel';
import { CameraFormatPanel } from './camera-format-panel';
import { LogEntry, LogPanel } from './log-panel';
import { OutputFolderPanel } from './output-folder-panel';
import { Preset, PresetPanel } from './preset-panel';
import { ProgressBar } from './progress-bar';
import { RenameSettingsPanel } from './rename-settings-panel';
import { SourceFoldersPanel } from './source-folders-panel';

type AppStatus = 'idle' | 'processing' | 'complete' | 'stopped' | 'error';

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
  return (
    <StepFrame
      eyebrow="Step 1"
      title="Source"
      description="Choose the folders LightOps will scan and where renamed files should go."
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {folders.length > 0
              ? `${folders.length} source folder(s) selected`
              : 'Add at least one source folder to continue.'}
          </span>
          <button
            type="button"
            disabled={folders.length === 0}
            onClick={onNext}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'var(--accent-lightops)' }}
          >
            Continue to Rules
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

export interface RulesStepProps {
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
  currentSettings: Omit<Preset, 'name'>;
  savePresetSignal: number;
  onCameraChange: (value: string) => void;
  onRawExtensionsChange: (value: string) => void;
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
  onBack: () => void;
  onNext: () => void;
}

export function RulesStep({
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
  currentSettings,
  savePresetSignal,
  onCameraChange,
  onRawExtensionsChange,
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
  onBack,
  onNext,
}: RulesStepProps) {
  return (
    <StepFrame
      eyebrow="Step 2"
      title="Rules"
      description="Define how files are matched, named, and organized."
      footer={
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border px-4 py-2 text-sm"
            style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--accent-lightops)' }}
          >
            Review & Run
          </button>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <CameraFormatPanel
          cameraPreset={cameraPreset}
          rawExtensions={rawExtensions}
          fileType={fileType}
          onCameraChange={onCameraChange}
          onRawExtensionsChange={onRawExtensionsChange}
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
            collapsible
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
        <div className="xl:col-span-2">
          <PresetPanel
            currentSettings={currentSettings}
            onApply={onApplyPreset}
            saveRequestedToken={savePresetSignal}
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
  status,
  progress,
  stats,
  isProcessing,
  onRun,
  onDryRun,
  onStop,
  onBack,
}: ReviewRunStepProps) {
  const destination = outputFolder.trim() || 'Rename in-place';
  const advanced = [
    recursiveScan ? 'recursive' : 'top-level only',
    fileOperation,
    organizeByDate ? 'date folders' : 'no date folders',
    onlyPaired ? 'paired only' : 'allow singles',
    includeVideo ? 'videos on' : 'videos off',
  ].join(' · ');

  return (
    <StepFrame
      eyebrow="Step 3"
      title={isProcessing ? 'Processing' : 'Review & Run'}
      description={
        isProcessing
          ? 'Configuration is locked while LightOps processes the plan.'
          : 'Confirm the configuration before dry run or execution.'
      }
      footer={
        isProcessing ? (
          <button
            type="button"
            onClick={onStop}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
            style={{ background: 'rgba(245, 87, 108, 0.85)' }}
          >
            Stop
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border px-4 py-2 text-sm"
              style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}
            >
              Back to Rules
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
              <SummaryCard label="OK" value={String(stats.ok)} />
              <SummaryCard label="Skipped" value={String(stats.skip)} />
              <SummaryCard
                label="Errors"
                value={String(stats.error)}
                tone={stats.error > 0 ? 'warning' : 'normal'}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Settings2 className="h-4 w-4" />
            <span>Logs are buffered to keep the interface responsive.</span>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          <SummaryCard label="Sources" value={`${folders.length} folder(s)`} />
          <SummaryCard label="Destination" value={destination} />
          <SummaryCard label="Camera" value={`${cameraPreset} · ${rawExtensions}`} />
          <SummaryCard label="File type" value={fileType.toUpperCase()} />
          <SummaryCard
            label="Rename"
            value={`${prefix || '(no prefix)'} · ${format} · #${startNumber}`}
          />
          <SummaryCard
            label="Advanced"
            value={advanced}
            tone={fileOperation === 'move' ? 'warning' : 'normal'}
          />
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
              <span>Move mode deletes originals after successful move.</span>
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
  const icon =
    banner?.type === 'success' ? (
      <CheckCircle className="h-4 w-4" />
    ) : banner?.type === 'warning' ? (
      <AlertTriangle className="h-4 w-4" />
    ) : (
      <AlertCircle className="h-4 w-4" />
    );

  return (
    <StepFrame
      eyebrow="Step 4"
      title="Results"
      description="Inspect the dry run or execution output."
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToRules}
            className="rounded-xl border px-4 py-2 text-sm"
            style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}
          >
            Back to Rules
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
        <div className="min-h-0 flex-1">
          <LogPanel entries={entries} isDryRun={isDryRun} stats={stats} onClear={onClear} />
        </div>
      </div>
    </StepFrame>
  );
}
