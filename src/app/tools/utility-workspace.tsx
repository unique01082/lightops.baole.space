import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FolderOpen,
  Gauge,
  Image as ImageIcon,
  Play,
  ScanLine,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { recordRecentJob } from '../../lib/local-store-client';
import { tauriMediaClient, type MediaClient } from '../../lib/media-client';
import type {
  JobProgress,
  JobResult,
  MinimizeOptions,
  ResizeOptions,
  ToolJobRequest,
} from '../../lib/media-contracts';
import { PresetBar } from '../toolbox/preset-bar';
import { MediaInputStage } from './media-input-stage';
import { ToolResultStage } from './tool-result-stage';
import { ToolStepFrame, ToolWorkflowShell, type ToolWorkflowStep } from './tool-workflow-shell';

type UtilityWorkspaceProps = {
  toolId: 'resize' | 'minimize';
  onBack: () => void;
  client?: MediaClient;
};

type UtilityStep = 'images' | 'settings' | 'review' | 'results';

const initialResize: ResizeOptions = {
  type: 'resize',
  mode: 'long_edge',
  value: 2048,
  allowUpscale: false,
  outputFormat: 'source',
  quality: 90,
  suffix: '-resized',
};

const initialMinimize: MinimizeOptions = {
  type: 'minimize',
  mode: 'compressed',
  quality: 82,
  outputFormat: 'source',
  suffix: '-min',
};

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-white/10 bg-[#17152d] px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-[rgb(var(--tool-accent)/0.65)]';
const secondaryButton =
  'flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-2.5 text-xs font-semibold text-white/62 hover:bg-white/[0.08] hover:text-white';
const primaryButton =
  'flex items-center gap-2 rounded-xl bg-[rgb(var(--tool-accent))] px-5 py-2.5 text-xs font-bold text-white shadow-[0_10px_30px_rgb(var(--tool-accent)/0.22)] transition-transform duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-35';

function optionLabel(value: string) {
  return value.replace('_', ' ');
}

export function UtilityWorkspace({
  toolId,
  onBack,
  client = tauriMediaClient,
}: UtilityWorkspaceProps) {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState<UtilityStep>('images');
  const [inputs, setInputs] = useState<string[]>([]);
  const [selectedInputs, setSelectedInputs] = useState<Set<string>>(new Set());
  const [outputDir, setOutputDir] = useState('');
  const [resize, setResize] = useState(initialResize);
  const [minimize, setMinimize] = useState(initialMinimize);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [result, setResult] = useState<JobResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const options = toolId === 'resize' ? resize : minimize;

  const addImages = async () => {
    const paths = await client.pickImages();
    setInputs((current) => [...new Set([...current, ...paths])]);
  };

  const addFolder = async () => {
    const paths = await client.pickInputFolder();
    setInputs((current) => [...new Set([...current, ...paths])]);
  };

  const chooseOutput = async () => {
    const selectedDirectory = await client.pickOutputDirectory();
    if (selectedDirectory) setOutputDir(selectedDirectory);
  };

  const run = async () => {
    if (!inputs.length || !outputDir) return;
    setError(null);
    setResult(null);
    setProgress(null);
    setSelected(new Set());
    const jobId = crypto.randomUUID();
    setRunningJobId(jobId);
    setActiveStep('results');
    const request: ToolJobRequest = {
      schemaVersion: 1,
      jobId,
      toolId,
      inputs,
      outputDir,
      options,
    };
    try {
      const nextResult = await client.runJob(request, setProgress);
      setResult(nextResult);
      await recordRecentJob({
        id: jobId,
        toolId,
        status: nextResult.status,
        inputCount: inputs.length,
        outputCount: nextResult.outputs.length,
        manifestPath: nextResult.manifestPath,
        finishedAt: new Date().toISOString(),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunningJobId(null);
    }
  };

  const toggleOutput = (path: string) => {
    setCopyStatus(null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const copyOutput = async (path: string) => {
    setCopyStatus(null);
    try {
      await client.copyOutputImage(path);
      setCopyStatus({ type: 'success', message: t('utilities.copySucceeded') });
    } catch (caught) {
      setCopyStatus({
        type: 'error',
        message: caught instanceof Error ? caught.message : String(caught),
      });
    }
  };

  const removeInputs = (paths: Set<string>) => {
    setInputs((current) => current.filter((path) => !paths.has(path)));
    setSelectedInputs(new Set());
    if (paths.size === inputs.length) {
      setOutputDir('');
      setActiveStep('images');
    }
  };

  const steps: ToolWorkflowStep[] = [
    {
      id: 'images',
      label: t('toolWorkflow.utility.images'),
      description: t('toolWorkflow.utility.imagesHint'),
      complete: inputs.length > 0,
    },
    {
      id: 'settings',
      label: t('toolWorkflow.utility.settings'),
      description: t('toolWorkflow.utility.settingsHint'),
      complete: inputs.length > 0 && Boolean(outputDir),
      disabled: inputs.length === 0,
    },
    {
      id: 'review',
      label: t('toolWorkflow.utility.review'),
      description: t('toolWorkflow.utility.reviewHint'),
      complete: Boolean(result),
      disabled: inputs.length === 0 || !outputDir,
    },
    {
      id: 'results',
      label: t('toolWorkflow.utility.results'),
      description: t('toolWorkflow.utility.resultsHint'),
      complete: result?.status === 'completed',
      disabled: !runningJobId && !result && !error,
    },
  ];

  const statusLabel = runningJobId
    ? t('utilities.processing')
    : result
      ? t('toolWorkflow.complete')
      : inputs.length
        ? t('toolWorkflow.ready')
        : t('toolWorkflow.awaitingFrames');

  const stats = [
    { label: t('toolWorkflow.frames'), value: String(inputs.length), tone: 'accent' as const },
    {
      label: t('toolWorkflow.format'),
      value: options.outputFormat === 'source' ? 'SOURCE' : options.outputFormat.toUpperCase(),
    },
    {
      label: t('toolWorkflow.recipe'),
      value:
        toolId === 'resize'
          ? `${optionLabel(resize.mode).toUpperCase()} ${resize.value}`
          : minimize.mode.toUpperCase(),
    },
  ];

  const renderOptions = () => (
    <div className="mx-auto max-w-4xl space-y-4">
      <PresetBar
        toolId={toolId}
        payload={options}
        onApply={(payload) => {
          const preset = payload as ResizeOptions | MinimizeOptions;
          if (toolId === 'resize' && preset.type === 'resize') setResize(preset);
          if (toolId === 'minimize' && preset.type === 'minimize') setMinimize(preset);
        }}
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[rgb(var(--tool-accent)/0.14)]">
              {toolId === 'resize' ? (
                <ScanLine className="h-4 w-4 text-[rgb(var(--tool-glow))]" />
              ) : (
                <Gauge className="h-4 w-4 text-[rgb(var(--tool-glow))]" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {t('toolWorkflow.utility.recipeTitle')}
              </h3>
              <p className="mt-0.5 text-[10px] text-white/35">
                {t('toolWorkflow.utility.recipeDescription')}
              </p>
            </div>
          </div>

          {toolId === 'resize' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-white/55">
                  {t('utilities.resizeMode')}
                  <select
                    value={resize.mode}
                    onChange={(event) =>
                      setResize((current) => ({
                        ...current,
                        mode: event.target.value as ResizeOptions['mode'],
                      }))
                    }
                    className={fieldClass}
                  >
                    <option value="width">{t('utilities.width')}</option>
                    <option value="height">{t('utilities.height')}</option>
                    <option value="long_edge">{t('utilities.longEdge')}</option>
                    <option value="percentage">{t('utilities.percentage')}</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-white/55">
                  {t('utilities.value')}
                  <input
                    type="number"
                    min="1"
                    value={resize.value}
                    onChange={(event) =>
                      setResize((current) => ({ ...current, value: Number(event.target.value) }))
                    }
                    className={fieldClass}
                  />
                </label>
              </div>
              <label className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-black/10 px-3 py-3 text-xs text-white/55">
                <span>
                  <span className="block font-semibold text-white/75">
                    {t('utilities.allowUpscale')}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-white/30">
                    {t('toolWorkflow.utility.upscaleHint')}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={resize.allowUpscale}
                  onChange={(event) =>
                    setResize((current) => ({ ...current, allowUpscale: event.target.checked }))
                  }
                  className="h-4 w-4 accent-[rgb(var(--tool-accent))]"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(['lossless', 'compressed'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={minimize.mode === mode}
                    onClick={() =>
                      setMinimize((current) => ({
                        ...current,
                        mode,
                        outputFormat: mode === 'lossless' ? 'source' : current.outputFormat,
                      }))
                    }
                    className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-xs font-semibold text-white/55 aria-pressed:border-[rgb(var(--tool-accent)/0.55)] aria-pressed:bg-[rgb(var(--tool-accent)/0.13)] aria-pressed:text-[rgb(var(--tool-glow))]"
                  >
                    {t(`utilities.${mode}`)}
                  </button>
                ))}
              </div>
              {minimize.mode === 'compressed' && (
                <div className="space-y-4">
                  <label className="block text-xs font-medium text-white/55">
                    <span className="flex justify-between">
                      <span>{t('utilities.quality')}</span>
                      <span className="font-mono text-[rgb(var(--tool-glow))]">
                        {minimize.quality}
                      </span>
                    </span>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={minimize.quality}
                      disabled={minimize.targetBytes !== undefined}
                      onChange={(event) =>
                        setMinimize((current) => ({
                          ...current,
                          quality: Number(event.target.value),
                        }))
                      }
                      className="mt-3 w-full accent-[rgb(var(--tool-accent))]"
                    />
                  </label>
                  <label className="block text-xs font-medium text-white/55">
                    {t('utilities.targetSizeKb')}
                    <input
                      type="number"
                      min="1"
                      value={minimize.targetBytes ? Math.round(minimize.targetBytes / 1024) : ''}
                      placeholder={t('utilities.optional')}
                      onChange={(event) =>
                        setMinimize((current) => ({
                          ...current,
                          targetBytes: event.target.value
                            ? Number(event.target.value) * 1024
                            : undefined,
                        }))
                      }
                      className={fieldClass}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06]">
              <Settings2 className="h-4 w-4 text-white/55" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {t('toolWorkflow.utility.deliveryTitle')}
              </h3>
              <p className="mt-0.5 text-[10px] text-white/35">
                {t('toolWorkflow.utility.deliveryDescription')}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-white/55">
              {t('utilities.outputFormat')}
              <select
                value={options.outputFormat}
                disabled={toolId === 'minimize' && minimize.mode === 'lossless'}
                onChange={(event) => {
                  const outputFormat = event.target.value as ResizeOptions['outputFormat'];
                  if (toolId === 'resize') setResize((current) => ({ ...current, outputFormat }));
                  else setMinimize((current) => ({ ...current, outputFormat }));
                }}
                className={fieldClass}
              >
                {['source', 'jpg', 'png', 'tiff', 'webp'].map((format) => (
                  <option key={format} value={format}>
                    {format === 'source' ? t('utilities.sourceFormat') : format.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-white/55">
              {t('utilities.suffix')}
              <input
                value={options.suffix}
                onChange={(event) => {
                  if (toolId === 'resize')
                    setResize((current) => ({ ...current, suffix: event.target.value }));
                  else setMinimize((current) => ({ ...current, suffix: event.target.value }));
                }}
                className={fieldClass}
              />
            </label>
          </div>
          {options.outputFormat !== 'source' && (
            <p
              role="status"
              className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-3 py-2.5 text-[10px] leading-relaxed text-amber-100/65"
            >
              {t('utilities.formatWarning')}
            </p>
          )}
          <button
            type="button"
            onClick={chooseOutput}
            aria-label={t('utilities.chooseOutput')}
            className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-3 text-left text-xs hover:bg-white/[0.04]"
          >
            <FolderOpen className="h-4 w-4 shrink-0 text-[rgb(var(--tool-glow))]" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-white/70">
                {t('utilities.chooseOutput')}
              </span>
              <span className="mt-0.5 block truncate font-mono text-[9px] text-white/30">
                {outputDir || t('toolWorkflow.utility.noDestination')}
              </span>
            </span>
            {outputDir && <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
          </button>
        </section>
      </div>
    </div>
  );

  return (
    <ToolWorkflowShell
      toolId={toolId}
      steps={steps}
      activeStep={activeStep}
      statusLabel={statusLabel}
      isProcessing={Boolean(runningJobId)}
      onBack={onBack}
      onStepChange={(step) => setActiveStep(step as UtilityStep)}
    >
      {activeStep === 'images' && (
        <ToolStepFrame
          eyebrow={t('toolWorkflow.utility.imagesEyebrow')}
          title={t('toolWorkflow.utility.imagesTitle')}
          description={t('toolWorkflow.utility.imagesDescription')}
          stats={stats}
          footer={
            <>
              <span className="text-[10px] text-white/34">
                {t('toolWorkflow.utility.imagePrivacy')}
              </span>
              <button
                type="button"
                disabled={!inputs.length}
                onClick={() => setActiveStep('settings')}
                className={primaryButton}
              >
                {t('toolWorkflow.continue')} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          }
        >
          <MediaInputStage
            paths={inputs}
            selectedPaths={selectedInputs}
            onSelectedPathsChange={setSelectedInputs}
            onAddImages={addImages}
            onAddFolder={addFolder}
            onRemove={removeInputs}
          />
        </ToolStepFrame>
      )}

      {activeStep === 'settings' && (
        <ToolStepFrame
          eyebrow={t('toolWorkflow.utility.settingsEyebrow')}
          title={
            toolId === 'resize'
              ? t('toolWorkflow.utility.resizeTitle')
              : t('toolWorkflow.utility.minimizeTitle')
          }
          description={
            toolId === 'resize'
              ? t('toolWorkflow.utility.resizeDescription')
              : t('toolWorkflow.utility.minimizeDescription')
          }
          stats={stats}
          footer={
            <>
              <button
                type="button"
                onClick={() => setActiveStep('images')}
                className={secondaryButton}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> {t('toolWorkflow.backStep')}
              </button>
              <button
                type="button"
                disabled={!outputDir}
                onClick={() => setActiveStep('review')}
                className={primaryButton}
              >
                {t('toolWorkflow.reviewBatch')} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          }
        >
          {renderOptions()}
        </ToolStepFrame>
      )}

      {activeStep === 'review' && (
        <ToolStepFrame
          eyebrow={t('toolWorkflow.utility.reviewEyebrow')}
          title={t('toolWorkflow.utility.reviewTitle')}
          description={t('toolWorkflow.utility.reviewDescription')}
          stats={stats}
          footer={
            <>
              <button
                type="button"
                onClick={() => setActiveStep('settings')}
                className={secondaryButton}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> {t('toolWorkflow.editSettings')}
              </button>
              <button
                type="button"
                onClick={run}
                disabled={Boolean(runningJobId)}
                aria-label={t('utilities.run')}
                className={primaryButton}
              >
                <Play className="h-3.5 w-3.5 fill-current" /> {t('utilities.run')}
              </button>
            </>
          }
        >
          <div className="mx-auto grid max-w-4xl gap-3 lg:grid-cols-3">
            {[
              {
                icon: ImageIcon,
                label: t('toolWorkflow.utility.batchCard'),
                value: `${inputs.length} ${t('toolWorkflow.frames')}`,
                detail: inputs[0] ?? '',
              },
              {
                icon: Sparkles,
                label: t('toolWorkflow.utility.recipeCard'),
                value: stats[2].value,
                detail: `${options.outputFormat.toUpperCase()} · ${options.suffix}`,
              },
              {
                icon: FolderOpen,
                label: t('toolWorkflow.utility.destinationCard'),
                value: outputDir.split(/[\\/]/).pop() || outputDir,
                detail: outputDir,
              },
            ].map(({ icon: Icon, label, value, detail }) => (
              <article
                key={label}
                className="relative overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.03] p-5"
              >
                <div className="absolute inset-x-6 top-0 h-px bg-[rgb(var(--tool-glow))] opacity-35" />
                <Icon className="h-5 w-5 text-[rgb(var(--tool-glow))]" strokeWidth={1.5} />
                <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.2em] text-white/32">
                  {label}
                </p>
                <p className="mt-1.5 truncate text-sm font-semibold text-white/85">{value}</p>
                <p className="mt-2 truncate font-mono text-[9px] text-white/28">{detail}</p>
              </article>
            ))}
          </div>
          <div className="mx-auto mt-4 flex max-w-4xl items-center gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.045] px-4 py-3 text-[11px] text-emerald-100/55">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
            {t('toolWorkflow.utility.sourceSafe')}
          </div>
        </ToolStepFrame>
      )}

      {activeStep === 'results' && (
        <ToolStepFrame
          eyebrow={t('toolWorkflow.utility.resultsEyebrow')}
          title={t('toolWorkflow.utility.resultsTitle')}
          description={t('toolWorkflow.utility.resultsDescription')}
          stats={stats}
          footer={
            <>
              <span className="text-[10px] text-white/34">
                {result
                  ? `${result.outputs.length} ${t('toolWorkflow.outputsReady')}`
                  : t('toolWorkflow.processingLocally')}
              </span>
              {!runningJobId && (
                <button
                  type="button"
                  onClick={() => setActiveStep(result || error ? 'review' : 'images')}
                  className={secondaryButton}
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> {t('toolWorkflow.backToReview')}
                </button>
              )}
            </>
          }
        >
          <ToolResultStage
            progress={progress}
            activeJobId={runningJobId}
            outputs={result?.outputs ?? []}
            warnings={result?.warnings ?? []}
            error={error}
            copyStatus={copyStatus}
            selectedOutputs={selected}
            onToggleOutput={toggleOutput}
            onCancel={() => runningJobId && void client.cancelJob(runningJobId)}
            onCopy={(path) => void copyOutput(path)}
          />
        </ToolStepFrame>
      )}
    </ToolWorkflowShell>
  );
}
