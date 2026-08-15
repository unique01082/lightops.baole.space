import {
  AlertTriangle,
  Check,
  Clipboard,
  Image,
  LoaderCircle,
  OctagonAlert,
  Square,
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { JobProgress, OutputAsset } from '../../lib/media-contracts';

type ToolResultStageProps = {
  progress: JobProgress | null;
  activeJobId: string | null;
  outputs: OutputAsset[];
  warnings: string[];
  error?: string | null;
  selectedOutputs: Set<string>;
  onToggleOutput: (path: string) => void;
  onCancel: () => void;
  onCopy?: (path: string) => void;
  copyStatus?: { type: 'success' | 'error'; message: string } | null;
};

function basename(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ToolResultStage({
  progress,
  activeJobId,
  outputs,
  warnings,
  error,
  selectedOutputs,
  onToggleOutput,
  onCancel,
  onCopy,
  copyStatus,
}: ToolResultStageProps) {
  const { t } = useTranslation();
  const selectedPath = useMemo(
    () => (selectedOutputs.size === 1 ? [...selectedOutputs][0] : null),
    [selectedOutputs],
  );
  const totalBytes = outputs.reduce((sum, output) => sum + output.byteSize, 0);
  const totalSavings = outputs.reduce((sum, output) => sum + Math.max(0, output.savingsBytes), 0);

  return (
    <div className="space-y-4">
      {activeJobId && (
        <div className="relative overflow-hidden rounded-2xl border border-[rgb(var(--tool-accent)/0.35)] bg-[rgb(var(--tool-accent)/0.08)] p-5">
          <div className="absolute inset-x-0 top-0 h-px bg-[rgb(var(--tool-glow))] opacity-70" />
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[rgb(var(--tool-accent)/0.18)]">
                <LoaderCircle className="h-5 w-5 animate-spin text-[rgb(var(--tool-glow))]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{t('utilities.processing')}</p>
                <p role="status" className="mt-0.5 font-mono text-[10px] text-white/42">
                  {progress
                    ? `${progress.current + 1} / ${progress.total}`
                    : t('toolWorkflow.preparing')}
                  {progress?.itemId ? ` · ${basename(progress.itemId)}` : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label={t('utilities.cancel')}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/65 hover:bg-white/[0.09]"
            >
              <Square className="h-3 w-3 fill-current" />
              {t('utilities.cancel')}
            </button>
          </div>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-black/25">
            <div
              className="h-full rounded-full bg-[rgb(var(--tool-glow))] transition-[width] duration-200"
              style={{
                width:
                  progress && progress.total > 0
                    ? `${Math.min(100, ((progress.current + 1) / progress.total) * 100)}%`
                    : '12%',
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex gap-3 rounded-2xl border border-rose-400/25 bg-rose-500/[0.08] p-4"
        >
          <OctagonAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
          <div>
            <p className="text-xs font-bold text-rose-200">{t('toolWorkflow.jobNeedsAttention')}</p>
            <p className="mt-1 text-xs leading-relaxed text-rose-100/65">{error}</p>
          </div>
        </div>
      )}

      {copyStatus && (
        <div
          role={copyStatus.type === 'error' ? 'alert' : 'status'}
          className={`rounded-xl border px-4 py-3 text-xs ${
            copyStatus.type === 'error'
              ? 'border-rose-400/25 bg-rose-500/[0.08] text-rose-100'
              : 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-100'
          }`}
        >
          {copyStatus.message}
        </div>
      )}

      {outputs.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              [t('toolWorkflow.outputs'), String(outputs.length)],
              [t('toolWorkflow.totalSize'), formatBytes(totalBytes)],
              [t('toolWorkflow.saved'), formatBytes(totalSavings)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-3"
              >
                <p className="text-[9px] uppercase tracking-[0.18em] text-white/30">{label}</p>
                <p className="mt-1 font-mono text-sm font-semibold text-white/82">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-black/10">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                {t('utilities.results')}
              </span>
              {onCopy && (
                <button
                  type="button"
                  disabled={!selectedPath}
                  onClick={() => selectedPath && onCopy(selectedPath)}
                  aria-label={t('utilities.copyImage')}
                  className="flex items-center gap-1.5 rounded-lg bg-[rgb(var(--tool-accent)/0.15)] px-3 py-2 text-[11px] font-semibold text-[rgb(var(--tool-glow))] disabled:opacity-30"
                >
                  <Clipboard className="h-3.5 w-3.5" />
                  {t('utilities.copyImage')}
                </button>
              )}
            </div>
            <div className="space-y-1.5 p-2">
              {outputs.map((output) => (
                <label
                  key={output.outputPath}
                  className="flex items-center gap-3 rounded-xl border border-transparent bg-white/[0.025] px-3 py-2.5 hover:border-white/[0.08] hover:bg-white/[0.04]"
                >
                  <input
                    type="checkbox"
                    checked={selectedOutputs.has(output.outputPath)}
                    onChange={() => onToggleOutput(output.outputPath)}
                    aria-label={basename(output.outputPath)}
                    className="accent-[rgb(var(--tool-accent))]"
                  />
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/10">
                    <Check className="h-4 w-4 text-emerald-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white/82">
                      {basename(output.outputPath)}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[9px] text-white/28">
                      {output.outputPath}
                    </p>
                  </div>
                  <span className="hidden items-center gap-1 font-mono text-[9px] text-white/34 sm:flex">
                    <Image className="h-3 w-3" />
                    {output.width}×{output.height}
                  </span>
                  <span className="w-16 text-right font-mono text-[9px] text-white/42">
                    {formatBytes(output.byteSize)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.06] p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            {t('utilities.warnings')}
          </div>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-amber-100/60">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {!activeJobId && outputs.length === 0 && !error && (
        <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-white/12 bg-black/10 text-center">
          <div>
            <Image className="mx-auto h-6 w-6 text-white/18" />
            <p className="mt-2 text-xs text-white/36">{t('toolWorkflow.resultsWaiting')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
