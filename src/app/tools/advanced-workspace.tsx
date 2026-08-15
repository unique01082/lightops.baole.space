import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  FolderOpen,
  Images,
  Layers3,
  LoaderCircle,
  Play,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  tauriAdvancedClient,
  type AdvancedClient,
  type BeforeAfterPair,
  type MetadataAudit,
  type MetadataCategory,
  type SequenceGroup,
  type SequenceKind,
} from '../../lib/advanced-client';
import { recordRecentJob } from '../../lib/local-store-client';
import type { JobProgress } from '../../lib/media-contracts';
import { PresetBar } from '../toolbox/preset-bar';
import { MediaInputStage } from './media-input-stage';
import { ToolStepFrame, ToolWorkflowShell, type ToolWorkflowStep } from './tool-workflow-shell';

type AdvancedToolId = 'sequence_grouper' | 'metadata_cleaner' | 'before_after';
type AdvancedStep =
  | 'images'
  | 'analyze'
  | 'review'
  | 'export'
  | 'audit'
  | 'safe_share'
  | 'pair'
  | 'package'
  | 'results';

type AdvancedWorkspaceProps = {
  toolId: AdvancedToolId;
  onBack: () => void;
  client?: AdvancedClient;
};

const SAFE_SHARE: MetadataCategory[] = [
  'location',
  'device_identity',
  'people',
  'edit_history',
  'embedded_preview',
];
const REMOVED_TAGS: Record<MetadataCategory, string[]> = {
  location: ['GPS:*', 'XMP:Location', 'XMP:City', 'XMP:State', 'XMP:Country'],
  device_identity: ['EXIF:SerialNumber', 'EXIF:LensSerialNumber', 'XMP:OwnerName'],
  people: ['XMP:RegionInfo', 'IPTC:PersonInImage', 'XMP:PersonInImage'],
  edit_history: ['XMP:History', 'XMP:DerivedFrom', 'XMP:DocumentAncestors'],
  embedded_preview: ['ThumbnailImage', 'PreviewImage', 'JpgFromRaw'],
};
const PROTECTED_TAGS = [
  'Copyright',
  'Creator/Artist',
  'DateTimeOriginal',
  'ExposureTime',
  'FNumber',
  'ISO',
  'FocalLength',
  'ICC_Profile',
  'Orientation',
  'ImageWidth/ImageHeight',
];

const FLOW_BY_TOOL: Record<AdvancedToolId, AdvancedStep[]> = {
  sequence_grouper: ['images', 'analyze', 'review', 'export'],
  metadata_cleaner: ['images', 'audit', 'safe_share', 'results'],
  before_after: ['images', 'pair', 'package', 'results'],
};

const primaryButton =
  'flex items-center gap-2 rounded-xl bg-[rgb(var(--tool-accent))] px-5 py-2.5 text-xs font-bold text-white shadow-[0_10px_30px_rgb(var(--tool-accent)/0.22)] transition-transform duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-35';
const secondaryButton =
  'flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-2.5 text-xs font-semibold text-white/62 hover:bg-white/[0.08] hover:text-white disabled:opacity-35';
const fieldClass =
  'mt-1.5 w-full rounded-xl border border-white/10 bg-[#17152d] px-3 py-2.5 text-sm text-white outline-none focus:border-[rgb(var(--tool-accent)/0.65)]';

function basename(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}

export function AdvancedWorkspace({
  toolId,
  onBack,
  client = tauriAdvancedClient,
}: AdvancedWorkspaceProps) {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState<AdvancedStep>('images');
  const [inputs, setInputs] = useState<string[]>([]);
  const [selectedInputs, setSelectedInputs] = useState<Set<string>>(new Set());
  const [outputDir, setOutputDir] = useState('');
  const [groups, setGroups] = useState<SequenceGroup[]>([]);
  const [audits, setAudits] = useState<MetadataAudit[]>([]);
  const [pairs, setPairs] = useState<BeforeAfterPair[]>([]);
  const [categories, setCategories] = useState<MetadataCategory[]>(SAFE_SHARE);
  const [formats, setFormats] = useState(['side_by_side', 'html']);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [alignment, setAlignment] = useState({ zoom: 1, offsetX: 0, offsetY: 0 });
  const [stillFormat, setStillFormat] = useState<'jpeg' | 'png'>('png');
  const [maxGapSeconds, setMaxGapSeconds] = useState(5);
  const [busy, setBusy] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [outputCount, setOutputCount] = useState(0);
  const [progress, setProgress] = useState<JobProgress | null>(null);

  const hasAnalysis =
    toolId === 'sequence_grouper'
      ? groups.length > 0
      : toolId === 'metadata_cleaner'
        ? audits.length > 0
        : pairs.length > 0;
  const presetPayload =
    toolId === 'sequence_grouper'
      ? { maxGapSeconds }
      : toolId === 'metadata_cleaner'
        ? { categories }
        : { formats, stillFormat, alignment };

  useEffect(() => {
    if (!client.subscribeJobProgress) return;
    let unlisten: (() => void) | undefined;
    void client
      .subscribeJobProgress((event) => {
        if (event.jobId === toolId) setProgress(event);
      })
      .then((dispose) => {
        unlisten = dispose;
      });
    return () => unlisten?.();
  }, [client, toolId]);

  const applyPreset = (payload: unknown) => {
    if (!payload || typeof payload !== 'object') return;
    const value = payload as Record<string, unknown>;
    if (toolId === 'sequence_grouper' && typeof value.maxGapSeconds === 'number')
      setMaxGapSeconds(value.maxGapSeconds);
    if (toolId === 'metadata_cleaner' && Array.isArray(value.categories))
      setCategories(value.categories as MetadataCategory[]);
    if (toolId === 'before_after') {
      if (Array.isArray(value.formats)) setFormats(value.formats as string[]);
      if (value.stillFormat === 'jpeg' || value.stillFormat === 'png')
        setStillFormat(value.stillFormat);
      if (value.alignment && typeof value.alignment === 'object')
        setAlignment(value.alignment as typeof alignment);
    }
  };

  const addImages = async () => {
    const paths = await client.pickImages();
    setInputs((current) => [...new Set([...current, ...paths])]);
  };
  const addFolder = async () => {
    const paths = await client.pickInputFolder();
    setInputs((current) => [...new Set([...current, ...paths])]);
  };
  const chooseOutput = async () => {
    const directory = await client.pickOutputDirectory();
    if (directory) setOutputDir(directory);
  };
  const removeInputs = (paths: Set<string>) => {
    setInputs((current) => current.filter((path) => !paths.has(path)));
    setSelectedInputs(new Set());
    setGroups((current) =>
      current.map((group) => ({ ...group, paths: group.paths.filter((path) => !paths.has(path)) })),
    );
    setAudits((current) => current.filter((audit) => !paths.has(audit.path)));
    setPairs((current) =>
      current.filter((pair) => !paths.has(pair.beforePath) && !paths.has(pair.afterPath)),
    );
    if (paths.size === inputs.length) setActiveStep('images');
  };

  const analyze = async () => {
    setBusy(true);
    setMessage('');
    try {
      if (toolId === 'sequence_grouper') {
        setGroups(await client.analyzeSequences(inputs, maxGapSeconds));
        setActiveStep('review');
      }
      if (toolId === 'metadata_cleaner') {
        setAudits(await client.auditMetadata(inputs));
        setActiveStep('safe_share');
      }
      if (toolId === 'before_after') setPairs(await client.suggestPairs(inputs));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const exportResult = async () => {
    if (!outputDir) return;
    if (toolId !== 'sequence_grouper') setActiveStep('results');
    setBusy(true);
    setActiveJobId(toolId);
    setProgress(null);
    setMessage('');
    setWarnings([]);
    try {
      let nextCount = 0;
      let manifestPath: string | undefined;
      if (toolId === 'sequence_grouper') {
        manifestPath = await client.exportSequences(outputDir, groups);
        nextCount = groups.filter((group) => !group.excluded).length;
        setMessage(manifestPath);
      }
      if (toolId === 'metadata_cleaner') {
        const result = await client.cleanMetadata(inputs, outputDir, categories);
        nextCount = result.outputs.length;
        setWarnings(result.warnings);
        setMessage(`${result.outputs.length} ${t('advancedTools.outputsCreated')}`);
      }
      if (toolId === 'before_after') {
        const result = await client.exportBeforeAfter({
          outputDir,
          pairs,
          formats,
          longEdge: 1080,
          durationSeconds: 3,
          stillFormat,
          ...alignment,
        });
        nextCount = result.outputs.length;
        setWarnings(result.warnings);
        setMessage(`${result.outputs.length} ${t('advancedTools.outputsCreated')}`);
      }
      setOutputCount(nextCount);
      await recordRecentJob({
        id: crypto.randomUUID(),
        toolId,
        status: 'completed',
        inputCount: inputs.length,
        outputCount: nextCount,
        manifestPath,
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      setActiveJobId(null);
      setProgress(null);
    }
  };

  const toggleCategory = (category: MetadataCategory) =>
    setCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  const toggleFormat = (format: string) =>
    setFormats((current) =>
      current.includes(format) ? current.filter((item) => item !== format) : [...current, format],
    );
  const assignPairPath = (pairId: string, role: 'beforePath' | 'afterPath', path: string) => {
    if (inputs.includes(path))
      setPairs((current) =>
        current.map((pair) => (pair.id === pairId ? { ...pair, [role]: path } : pair)),
      );
  };

  const splitGroup = (group: SequenceGroup) => {
    if (group.paths.length < 2) return;
    const midpoint = Math.ceil(group.paths.length / 2);
    setGroups((current) =>
      current.flatMap((item) =>
        item.id === group.id
          ? [
              { ...item, id: crypto.randomUUID(), paths: item.paths.slice(0, midpoint) },
              { ...item, id: crypto.randomUUID(), paths: item.paths.slice(midpoint) },
            ]
          : item,
      ),
    );
    setSelectedGroups((current) => {
      const next = new Set(current);
      next.delete(group.id);
      return next;
    });
  };
  const mergeSelectedGroups = () => {
    const selected = groups.filter((group) => selectedGroups.has(group.id));
    if (selected.length < 2) return;
    const merged: SequenceGroup = {
      ...selected[0],
      id: crypto.randomUUID(),
      paths: [...new Set(selected.flatMap((group) => group.paths))],
      confidence: selected.reduce((total, group) => total + group.confidence, 0) / selected.length,
      evidence: [...new Set([...selected.flatMap((group) => group.evidence), 'Manually merged'])],
    };
    setGroups((current) => [...current.filter((group) => !selectedGroups.has(group.id)), merged]);
    setSelectedGroups(new Set());
  };

  const stepConfig: Record<AdvancedStep, { label: string; hint: string }> = {
    images: {
      label: t('toolWorkflow.advanced.images'),
      hint: t('toolWorkflow.advanced.imagesHint'),
    },
    analyze: {
      label: t('toolWorkflow.advanced.sequence.analyze'),
      hint: t('toolWorkflow.advanced.sequence.analyzeHint'),
    },
    review: {
      label: t('toolWorkflow.advanced.sequence.review'),
      hint: t('toolWorkflow.advanced.sequence.reviewHint'),
    },
    export: {
      label: t('toolWorkflow.advanced.export'),
      hint: t('toolWorkflow.advanced.exportHint'),
    },
    audit: {
      label: t('toolWorkflow.advanced.metadata.audit'),
      hint: t('toolWorkflow.advanced.metadata.auditHint'),
    },
    safe_share: {
      label: t('toolWorkflow.advanced.metadata.safeShare'),
      hint: t('toolWorkflow.advanced.metadata.safeShareHint'),
    },
    pair: {
      label: t('toolWorkflow.advanced.beforeAfter.pair'),
      hint: t('toolWorkflow.advanced.beforeAfter.pairHint'),
    },
    package: {
      label: t('toolWorkflow.advanced.beforeAfter.package'),
      hint: t('toolWorkflow.advanced.beforeAfter.packageHint'),
    },
    results: {
      label: t('toolWorkflow.advanced.results'),
      hint: t('toolWorkflow.advanced.resultsHint'),
    },
  };
  const steps: ToolWorkflowStep[] = FLOW_BY_TOOL[toolId].map((id) => ({
    id,
    label: stepConfig[id].label,
    description: stepConfig[id].hint,
    complete:
      id === 'images'
        ? inputs.length > 0
        : id === 'results' || id === 'export'
          ? outputCount > 0
          : hasAnalysis,
    disabled:
      id === 'images' ? false : id === FLOW_BY_TOOL[toolId][1] ? inputs.length === 0 : !hasAnalysis,
  }));
  const stats = [
    { label: t('toolWorkflow.frames'), value: String(inputs.length), tone: 'accent' as const },
    {
      label:
        toolId === 'sequence_grouper'
          ? t('toolWorkflow.groups')
          : toolId === 'metadata_cleaner'
            ? t('toolWorkflow.audits')
            : t('toolWorkflow.pairs'),
      value: String(
        toolId === 'sequence_grouper'
          ? groups.length
          : toolId === 'metadata_cleaner'
            ? audits.length
            : pairs.length,
      ),
    },
    { label: t('toolWorkflow.destination'), value: outputDir ? basename(outputDir) : '—' },
  ];
  const statusLabel = busy
    ? t('utilities.processing')
    : outputCount
      ? t('toolWorkflow.complete')
      : hasAnalysis
        ? t('toolWorkflow.ready')
        : inputs.length
          ? t('toolWorkflow.readyToAnalyze')
          : t('toolWorkflow.awaitingFrames');

  const footerBack = (step: AdvancedStep) => (
    <button type="button" onClick={() => setActiveStep(step)} className={secondaryButton}>
      <ArrowLeft className="h-3.5 w-3.5" />
      {t('toolWorkflow.backStep')}
    </button>
  );
  const analyzeButton = (
    <button
      type="button"
      onClick={analyze}
      disabled={!inputs.length || busy}
      aria-label={t('advancedTools.analyze')}
      className={primaryButton}
    >
      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {t('advancedTools.analyze')}
    </button>
  );
  const analysisError = message ? (
    <div
      role="alert"
      className="rounded-2xl border border-rose-300/20 bg-rose-400/[0.06] px-4 py-3 text-xs leading-relaxed text-rose-100"
    >
      {message}
    </div>
  ) : null;

  const inputStage = (
    <MediaInputStage
      paths={inputs}
      selectedPaths={selectedInputs}
      onSelectedPathsChange={setSelectedInputs}
      onAddImages={addImages}
      onAddFolder={addFolder}
      onRemove={removeInputs}
      addImagesLabel={t('advancedTools.addImages')}
      addFolderLabel={t('utilities.addFolder')}
    />
  );

  const destinationCard = (
    <button
      type="button"
      onClick={chooseOutput}
      aria-label={t('advancedTools.chooseOutput')}
      className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.03] p-4 text-left hover:bg-white/[0.05]"
    >
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-[rgb(var(--tool-accent)/0.13)]">
        <FolderOpen className="h-4 w-4 text-[rgb(var(--tool-glow))]" />
      </div>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-white/75">
          {t('advancedTools.chooseOutput')}
        </span>
        <span className="mt-1 block truncate font-mono text-[9px] text-white/30">
          {outputDir || t('toolWorkflow.utility.noDestination')}
        </span>
      </span>
      {outputDir && <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
    </button>
  );

  const renderSequenceReview = () => (
    <div className="mx-auto max-w-4xl space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5">
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">
          {groups.length} {t('toolWorkflow.groups')}
        </span>
        <button
          type="button"
          onClick={mergeSelectedGroups}
          disabled={selectedGroups.size < 2}
          className={secondaryButton}
        >
          {t('advancedTools.mergeSelected')}
        </button>
      </div>
      {groups.map((group, index) => (
        <article
          key={group.id}
          className="overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.03]"
        >
          <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.07] px-4 py-3">
            <input
              type="checkbox"
              aria-label={`${t('advancedTools.selectGroup')} ${index + 1}`}
              checked={selectedGroups.has(group.id)}
              onChange={(event) =>
                setSelectedGroups((current) => {
                  const next = new Set(current);
                  if (event.target.checked) next.add(group.id);
                  else next.delete(group.id);
                  return next;
                })
              }
            />
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[rgb(var(--tool-accent)/0.13)] font-mono text-[10px] text-[rgb(var(--tool-glow))]">
              {String(index + 1).padStart(2, '0')}
            </span>
            <select
              aria-label={`${t('advancedTools.groupType')} ${index + 1}`}
              value={group.kind}
              onChange={(event) =>
                setGroups((current) =>
                  current.map((item) =>
                    item.id === group.id
                      ? { ...item, kind: event.target.value as SequenceKind }
                      : item,
                  ),
                )
              }
              className="rounded-lg bg-[#24223d] px-2 py-1.5 text-xs"
            >
              {(['hdr', 'panorama', 'focus', 'burst', 'review'] as const).map((kind) => (
                <option key={kind} value={kind}>
                  {kind.toUpperCase()}
                </option>
              ))}
            </select>
            <strong className="font-mono text-xs text-white/85">
              {group.kind.toUpperCase()} · {Math.round(group.confidence * 100)}%
            </strong>
            <span className="text-[10px] text-white/35">{group.evidence.join(' · ')}</span>
            <label className="ml-auto flex items-center gap-2 text-[10px] text-white/40">
              <input
                type="checkbox"
                checked={group.excluded}
                onChange={(event) =>
                  setGroups((current) =>
                    current.map((item) =>
                      item.id === group.id ? { ...item, excluded: event.target.checked } : item,
                    ),
                  )
                }
              />
              {t('advancedTools.exclude')}
            </label>
          </div>
          <div className="grid gap-1.5 p-3 sm:grid-cols-2">
            {group.paths.map((path) => (
              <div key={path} className="flex items-center gap-2 rounded-lg bg-black/15 px-3 py-2">
                <Images className="h-3.5 w-3.5 text-white/28" />
                <span className="min-w-0 flex-1 truncate text-[11px] text-white/62">
                  {basename(path)}
                </span>
                <button
                  type="button"
                  aria-label={`${t('advancedTools.removeImage')} ${basename(path)}`}
                  onClick={() =>
                    setGroups((current) =>
                      current.map((item) =>
                        item.id === group.id
                          ? { ...item, paths: item.paths.filter((entry) => entry !== path) }
                          : item,
                      ),
                    )
                  }
                  className="text-[9px] text-white/30 hover:text-rose-300"
                >
                  {t('utilities.remove')}
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={group.paths.length < 2}
            onClick={() => splitGroup(group)}
            className="mx-3 mb-3 rounded-lg border border-white/10 px-3 py-1.5 text-[10px] text-white/48 disabled:opacity-35"
          >
            {t('advancedTools.splitGroup')}
          </button>
        </article>
      ))}
    </div>
  );

  const renderSafeShare = () => (
    <div className="mx-auto max-w-4xl space-y-4">
      <PresetBar toolId={toolId} payload={presetPayload} onApply={applyPreset} />
      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-2xl border border-white/[0.09] bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[rgb(var(--tool-accent)/0.13)]">
              <ShieldCheck className="h-4 w-4 text-[rgb(var(--tool-glow))]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Safe Share</h3>
              <p className="text-[10px] text-white/35">{t('advancedTools.safeShareDescription')}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {SAFE_SHARE.map((category) => (
              <label
                key={category}
                className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/10 p-3 text-xs text-white/68"
              >
                <input
                  type="checkbox"
                  checked={categories.includes(category)}
                  onChange={() => toggleCategory(category)}
                  className="accent-[rgb(var(--tool-accent))]"
                />
                {t(`advancedTools.metadata.${category}`)}
              </label>
            ))}
          </div>
        </section>
        <section className="grid gap-3">
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.05] p-4">
            <h3 className="text-xs font-semibold text-rose-200">
              {t('advancedTools.tagsRemoved')}
            </h3>
            <p className="mt-2 break-words font-mono text-[9px] leading-relaxed text-white/45">
              {[...new Set(categories.flatMap((category) => REMOVED_TAGS[category]))].join(' · ')}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
            <h3 className="text-xs font-semibold text-emerald-200">
              {t('advancedTools.tagsProtected')}
            </h3>
            <p className="mt-2 break-words font-mono text-[9px] leading-relaxed text-white/45">
              {PROTECTED_TAGS.join(' · ')}
            </p>
          </div>
          {audits.map((audit) => (
            <div
              key={audit.path}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"
            >
              <strong className="text-xs">{basename(audit.path)}</strong>
              <ul className="mt-2 max-h-28 space-y-1 overflow-auto font-mono text-[9px] text-white/42">
                {Object.keys(audit.tags)
                  .sort()
                  .map((tag) => (
                    <li key={tag} className="break-all">
                      {tag}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </div>
  );

  const renderPairs = () => (
    <div className="mx-auto max-w-5xl space-y-4">
      <MediaInputStage
        paths={inputs}
        selectedPaths={selectedInputs}
        onSelectedPathsChange={setSelectedInputs}
        onAddImages={addImages}
        onAddFolder={addFolder}
        onRemove={removeInputs}
        addImagesLabel={t('advancedTools.addImages')}
        draggable
        onDragPath={(event, path) => {
          event.dataTransfer.setData('text/lightops-path', path);
          event.dataTransfer.effectAllowed = 'copy';
        }}
        getDragLabel={(path) => `${t('advancedTools.dragImage')} ${basename(path)}`}
      />
      {pairs.map((pair, index) => (
        <article
          key={pair.id}
          className="rounded-2xl border border-white/[0.09] bg-white/[0.03] p-4"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[rgb(var(--tool-glow))]">
              PAIR {String(index + 1).padStart(2, '0')}
            </span>
            <strong className="font-mono text-xs">{Math.round(pair.confidence * 100)}%</strong>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {(
              [
                ['beforePath', 'before', 'dropBefore'],
                ['afterPath', 'after', 'dropAfter'],
              ] as const
            ).map(([role, labelKey, dropKey]) => (
              <div key={role} className="min-w-0">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`${t(`advancedTools.${dropKey}`)} ${pair.id}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'copy';
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    assignPairPath(pair.id, role, event.dataTransfer.getData('text/lightops-path'));
                  }}
                  className="mb-2 grid min-h-20 place-items-center rounded-xl border border-dashed border-[rgb(var(--tool-accent)/0.35)] bg-[rgb(var(--tool-accent)/0.05)] px-3 text-center text-[10px] text-white/45"
                >
                  <span>
                    <WandSparkles className="mx-auto mb-1 h-4 w-4 text-[rgb(var(--tool-glow))]" />
                    {t(`advancedTools.${dropKey}`)}
                    <strong className="mt-1 block text-white/75">{basename(pair[role])}</strong>
                  </span>
                </div>
                <select
                  aria-label={`${t(`advancedTools.${labelKey}`)} ${pair.id}`}
                  value={pair[role]}
                  onChange={(event) => assignPairPath(pair.id, role, event.target.value)}
                  className="w-full min-w-0 rounded-lg bg-[#24223d] px-2 py-2 text-xs"
                >
                  {inputs.map((path) => (
                    <option key={path} value={path}>
                      {t(`advancedTools.${labelKey}`)}: {basename(path)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPairs((current) => current.filter((item) => item.id !== pair.id))}
            className="mt-3 text-[10px] text-white/35 hover:text-rose-300"
          >
            {t('advancedTools.removePair')}
          </button>
        </article>
      ))}
    </div>
  );

  const renderPackage = () => (
    <div className="mx-auto max-w-4xl space-y-4">
      <PresetBar toolId={toolId} payload={presetPayload} onApply={applyPreset} />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/[0.09] bg-white/[0.03] p-5">
          <h3 className="text-sm font-semibold">
            {t('toolWorkflow.advanced.beforeAfter.alignmentTitle')}
          </h3>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {(['zoom', 'offsetX', 'offsetY'] as const).map((field) => (
              <label key={field} className="text-[10px] text-white/45">
                {t(`advancedTools.${field}`)}
                <input
                  type="number"
                  step={field === 'zoom' ? 0.05 : 1}
                  min={field === 'zoom' ? 0.25 : undefined}
                  max={field === 'zoom' ? 4 : undefined}
                  value={alignment[field]}
                  onChange={(event) =>
                    setAlignment((current) => ({ ...current, [field]: Number(event.target.value) }))
                  }
                  className={fieldClass}
                />
              </label>
            ))}
          </div>
          <label className="mt-4 block text-[10px] text-white/45">
            {t('advancedTools.stillFormat')}
            <select
              value={stillFormat}
              onChange={(event) => setStillFormat(event.target.value as 'jpeg' | 'png')}
              className={fieldClass}
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
            </select>
          </label>
        </section>
        <section className="rounded-2xl border border-white/[0.09] bg-white/[0.03] p-5">
          <h3 className="text-sm font-semibold">
            {t('toolWorkflow.advanced.beforeAfter.formatsTitle')}
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {['side_by_side', 'split', 'contact_sheet', 'html', 'mp4', 'gif'].map((format) => (
              <label
                key={format}
                className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-black/10 p-3 text-[10px] text-white/62"
              >
                <input
                  type="checkbox"
                  checked={formats.includes(format)}
                  onChange={() => toggleFormat(format)}
                  className="accent-[rgb(var(--tool-accent))]"
                />
                {format.replace(/_/g, ' ')}
              </label>
            ))}
          </div>
        </section>
      </div>
      {destinationCard}
    </div>
  );

  const renderResultDesk = () => (
    <div className="mx-auto max-w-3xl space-y-4">
      {toolId === 'metadata_cleaner' && destinationCard}
      {activeJobId && (
        <div className="rounded-2xl border border-[rgb(var(--tool-accent)/0.3)] bg-[rgb(var(--tool-accent)/0.08)] p-5">
          <div className="flex items-center gap-3">
            <LoaderCircle className="h-5 w-5 animate-spin text-[rgb(var(--tool-glow))]" />
            <div>
              <p className="text-sm font-semibold">{t('utilities.processing')}</p>
              <p role="status" className="mt-1 font-mono text-[10px] text-white/40">
                {progress
                  ? `${Math.min(progress.current + 1, progress.total)} / ${progress.total}`
                  : t('toolWorkflow.preparing')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void client.cancelJob(activeJobId)}
              aria-label={t('advancedTools.cancel')}
              className={`${secondaryButton} ml-auto`}
            >
              {t('advancedTools.cancel')}
            </button>
          </div>
        </div>
      )}
      {message && (
        <div
          role="status"
          className={`rounded-2xl border p-5 ${outputCount ? 'border-emerald-300/20 bg-emerald-400/[0.05]' : 'border-rose-300/20 bg-rose-400/[0.05]'}`}
        >
          <CheckCircle2
            className={`h-6 w-6 ${outputCount ? 'text-emerald-300' : 'text-rose-300'}`}
          />
          <p className="mt-3 break-words text-sm font-semibold text-white/78">{message}</p>
          {outputCount > 0 && (
            <p className="mt-1 font-mono text-[10px] text-white/35">
              {outputCount} {t('advancedTools.outputsCreated')}
            </p>
          )}
        </div>
      )}
      {warnings.length > 0 && (
        <ul className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-[11px] text-amber-100/60">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      {!activeJobId && !message && (
        <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-white/12 bg-black/10 text-center">
          <div>
            <FileCheck2 className="mx-auto h-7 w-7 text-white/20" />
            <p className="mt-2 text-xs text-white/38">{t('toolWorkflow.advanced.readyToExport')}</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ToolWorkflowShell
      toolId={toolId}
      steps={steps}
      activeStep={activeStep}
      statusLabel={statusLabel}
      isProcessing={busy}
      onBack={onBack}
      onStepChange={(step) => setActiveStep(step as AdvancedStep)}
    >
      {activeStep === 'images' && (
        <ToolStepFrame
          eyebrow={t('toolWorkflow.advanced.imagesEyebrow')}
          title={t('toolWorkflow.advanced.imagesTitle')}
          description={t('toolWorkflow.advanced.imagesDescription')}
          stats={stats}
          footer={
            <>
              <span className="text-[10px] text-white/34">
                {t('toolWorkflow.utility.imagePrivacy')}
              </span>
              <button
                type="button"
                disabled={!inputs.length}
                onClick={() => setActiveStep(FLOW_BY_TOOL[toolId][1])}
                className={primaryButton}
              >
                {t('toolWorkflow.continue')}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          }
        >
          {inputStage}
        </ToolStepFrame>
      )}

      {activeStep === 'analyze' && (
        <ToolStepFrame
          eyebrow={t('toolWorkflow.advanced.sequence.analyzeEyebrow')}
          title={t('toolWorkflow.advanced.sequence.analyzeTitle')}
          description={t('toolWorkflow.advanced.sequence.analyzeDescription')}
          stats={stats}
          footer={
            <>
              {footerBack('images')}
              {analyzeButton}
            </>
          }
        >
          <div className="mx-auto max-w-3xl space-y-4">
            {analysisError}
            <PresetBar toolId={toolId} payload={presetPayload} onApply={applyPreset} />
            <section className="rounded-2xl border border-white/[0.09] bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <Layers3 className="h-5 w-5 text-[rgb(var(--tool-glow))]" />
                <div>
                  <h3 className="text-sm font-semibold">{t('advancedTools.maxGapSeconds')}</h3>
                  <p className="text-[10px] text-white/35">
                    {t('toolWorkflow.advanced.sequence.gapDescription')}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex items-end gap-3">
                <label className="flex-1 text-[10px] text-white/45">
                  <input
                    type="range"
                    min="0.5"
                    max="30"
                    step="0.5"
                    value={maxGapSeconds}
                    onChange={(event) => setMaxGapSeconds(Number(event.target.value))}
                    className="w-full accent-[rgb(var(--tool-accent))]"
                  />
                </label>
                <input
                  aria-label={t('advancedTools.maxGapSeconds')}
                  type="number"
                  min="0.5"
                  max="30"
                  step="0.5"
                  value={maxGapSeconds}
                  onChange={(event) => setMaxGapSeconds(Number(event.target.value))}
                  className="w-20 rounded-xl border border-white/10 bg-[#17152d] px-3 py-2 text-center font-mono text-sm"
                />
              </div>
            </section>
          </div>
        </ToolStepFrame>
      )}

      {activeStep === 'review' && (
        <ToolStepFrame
          eyebrow={t('toolWorkflow.advanced.sequence.reviewEyebrow')}
          title={t('toolWorkflow.advanced.sequence.reviewTitle')}
          description={t('toolWorkflow.advanced.sequence.reviewDescription')}
          stats={stats}
          footer={
            <>
              {footerBack('analyze')}
              <button
                type="button"
                onClick={() => setActiveStep('export')}
                className={primaryButton}
              >
                {t('toolWorkflow.continue')}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          }
        >
          {renderSequenceReview()}
        </ToolStepFrame>
      )}

      {activeStep === 'export' && (
        <ToolStepFrame
          eyebrow={t('toolWorkflow.advanced.exportEyebrow')}
          title={t('toolWorkflow.advanced.exportTitle')}
          description={t('toolWorkflow.advanced.exportDescription')}
          stats={stats}
          footer={
            <>
              {footerBack('review')}
              <button
                type="button"
                onClick={exportResult}
                disabled={!outputDir || busy}
                aria-label={t('advancedTools.export')}
                className={primaryButton}
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                {t('advancedTools.export')}
              </button>
            </>
          }
        >
          <div className="mx-auto max-w-3xl space-y-4">
            {destinationCard}
            {renderResultDesk()}
          </div>
        </ToolStepFrame>
      )}

      {activeStep === 'audit' && (
        <ToolStepFrame
          eyebrow={t('toolWorkflow.advanced.metadata.auditEyebrow')}
          title={t('toolWorkflow.advanced.metadata.auditTitle')}
          description={t('toolWorkflow.advanced.metadata.auditDescription')}
          stats={stats}
          footer={
            <>
              {footerBack('images')}
              {analyzeButton}
            </>
          }
        >
          <div className="mx-auto max-w-3xl space-y-4">
            {analysisError}
            <div className="rounded-2xl border border-white/[0.09] bg-white/[0.03] p-6 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-[rgb(var(--tool-glow))]" />
              <h3 className="mt-3 text-sm font-semibold">
                {t('toolWorkflow.advanced.metadata.auditCardTitle')}
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-white/42">
                {t('toolWorkflow.advanced.metadata.auditCardDescription')}
              </p>
            </div>
          </div>
        </ToolStepFrame>
      )}

      {activeStep === 'safe_share' && (
        <ToolStepFrame
          eyebrow={t('toolWorkflow.advanced.metadata.safeShareEyebrow')}
          title={t('toolWorkflow.advanced.metadata.safeShareTitle')}
          description={t('toolWorkflow.advanced.metadata.safeShareDescription')}
          stats={stats}
          footer={
            <>
              {footerBack('audit')}
              <button
                type="button"
                onClick={() => setActiveStep('results')}
                className={primaryButton}
              >
                {t('toolWorkflow.continue')}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          }
        >
          {renderSafeShare()}
        </ToolStepFrame>
      )}

      {activeStep === 'pair' && (
        <ToolStepFrame
          eyebrow={t('toolWorkflow.advanced.beforeAfter.pairEyebrow')}
          title={t('toolWorkflow.advanced.beforeAfter.pairTitle')}
          description={t('toolWorkflow.advanced.beforeAfter.pairDescription')}
          stats={stats}
          footer={
            <>
              {footerBack('images')}
              {pairs.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep('package')}
                  className={primaryButton}
                >
                  {t('toolWorkflow.continue')}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                analyzeButton
              )}
            </>
          }
        >
          <div className="space-y-4">
            {analysisError}
            {renderPairs()}
          </div>
        </ToolStepFrame>
      )}

      {activeStep === 'package' && (
        <ToolStepFrame
          eyebrow={t('toolWorkflow.advanced.beforeAfter.packageEyebrow')}
          title={t('toolWorkflow.advanced.beforeAfter.packageTitle')}
          description={t('toolWorkflow.advanced.beforeAfter.packageDescription')}
          stats={stats}
          footer={
            <>
              {footerBack('pair')}
              <button
                type="button"
                onClick={exportResult}
                disabled={!outputDir || !formats.length || busy}
                aria-label={t('advancedTools.export')}
                className={primaryButton}
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                {t('advancedTools.export')}
              </button>
            </>
          }
        >
          {renderPackage()}
        </ToolStepFrame>
      )}

      {activeStep === 'results' && (
        <ToolStepFrame
          eyebrow={t('toolWorkflow.advanced.resultsEyebrow')}
          title={t('toolWorkflow.advanced.resultsTitle')}
          description={t('toolWorkflow.advanced.resultsDescription')}
          stats={stats}
          footer={
            <>
              {toolId === 'metadata_cleaner' ? footerBack('safe_share') : footerBack('package')}
              <button
                type="button"
                onClick={exportResult}
                disabled={!outputDir || busy}
                aria-label={t('advancedTools.export')}
                className={primaryButton}
              >
                {busy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current" />
                )}
                {t('advancedTools.export')}
              </button>
            </>
          }
        >
          {renderResultDesk()}
        </ToolStepFrame>
      )}
    </ToolWorkflowShell>
  );
}
