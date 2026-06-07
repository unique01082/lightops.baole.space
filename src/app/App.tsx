import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InfoModal, InfoPage } from './components/info-modal';
import { LogEntry } from './components/log-panel';
import { Preset } from './components/preset-panel';
import { SettingsModal } from './components/settings-modal';
import { WorkflowShell, WorkflowStep, WorkflowStepKey } from './components/workflow-shell';
import { ResultsStep, ReviewRunStep, RulesStep, SourceStep } from './components/workflow-steps';

interface FilePair {
  jpg?: string;
  raw?: string;
  video?: string;
}

interface ScanResult {
  pairs: FilePair[];
  stats: {
    total_pairs: number;
    both: number;
    jpg_only: number;
    raw_only: number;
    video_count: number;
  };
}

interface RenameEntry {
  old_path: string;
  new_name: string;
  ts?: string;
}

interface BuildPlanResult {
  plan: RenameEntry[];
  skipped_count: number;
}

interface ProgressEvent {
  current: number;
  total: number;
  entry: {
    entry_type: string;
    source?: string;
    destination?: string;
    message?: string;
  };
  stats: { ok: number; skip: number; error: number };
}

interface ExecuteResult {
  ok: number;
  errors: number;
  cancelled: boolean;
}

interface UpdateInfo {
  available: boolean;
  version?: string;
  body?: string;
}

const FORMAT_TO_STRFTIME: Record<string, string | null> = {
  YYYYMMDD_HHMMSS_NNNN: '%Y%m%d_%H%M%S',
  'YYYY-MM-DD_HH-MM-SS_NNNN': '%Y-%m-%d_%H-%M-%S',
  YYYYMMDD_NNNN: '%Y%m%d',
  NNNN: null,
};

type AppStatus = 'idle' | 'processing' | 'complete' | 'stopped' | 'error';

const STORAGE = {
  camera: 'lightops-default-camera',
  fileOp: 'lightops-default-file-op',
  recursive: 'lightops-default-recursive',
  organize: 'lightops-default-organize',
};

const MENU_EVENT = 'lightops://menu';

function loadDefaults() {
  try {
    return {
      camera: localStorage.getItem(STORAGE.camera) ?? 'nikon',
      fileOp: (localStorage.getItem(STORAGE.fileOp) ?? 'copy') as 'copy' | 'move',
      recursive: localStorage.getItem(STORAGE.recursive) === 'true',
      organize: localStorage.getItem(STORAGE.organize) === 'true',
    };
  } catch {
    return {
      camera: 'nikon',
      fileOp: 'copy' as const,
      recursive: false,
      organize: false,
    };
  }
}

function getStatusLabel(status: AppStatus) {
  switch (status) {
    case 'processing':
      return 'Processing';
    case 'complete':
      return 'Complete';
    case 'stopped':
      return 'Stopped';
    case 'error':
      return 'Error';
    default:
      return 'Ready';
  }
}

function getStepForInputs(folders: string[]): WorkflowStepKey {
  return folders.length > 0 ? 'rules' : 'source';
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  );
}

function App() {
  const { t, i18n } = useTranslation();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [defaults] = useState(loadDefaults);
  const [defaultCamera, setDefaultCamera] = useState(defaults.camera);
  const [defaultFileOperation, setDefaultFileOperation] = useState<'copy' | 'move'>(
    defaults.fileOp,
  );
  const [defaultRecursiveScan, setDefaultRecursiveScan] = useState(defaults.recursive);
  const [defaultOrganizeByDate, setDefaultOrganizeByDate] = useState(defaults.organize);

  const [folders, setFolders] = useState<string[]>([]);
  const [outputFolder, setOutputFolder] = useState('');

  const [cameraPreset, setCameraPreset] = useState(defaults.camera);
  const [rawExtensions, setRawExtensions] = useState(() => {
    const presets: Record<string, string> = {
      nikon: '.nef .nrw',
      canon: '.cr2 .cr3',
      sony: '.arw',
      fujifilm: '.raf',
      panasonic: '.rw2',
      olympus: '.orf',
      pentax: '.dng .pef',
      leica: '.dng',
    };
    return presets[defaults.camera] ?? '.nef .nrw';
  });
  const [fileType, setFileType] = useState<'both' | 'jpg' | 'raw'>('both');

  const [prefix, setPrefix] = useState('');
  const [format, setFormat] = useState('NNNN');
  const [startNumber, setStartNumber] = useState(1);

  const [recursiveScan, setRecursiveScan] = useState(defaults.recursive);
  const [fileOperation, setFileOperation] = useState<'copy' | 'move'>(defaults.fileOp);
  const [organizeByDate, setOrganizeByDate] = useState(defaults.organize);
  const [onlyPaired, setOnlyPaired] = useState(false);
  const [includeVideo, setIncludeVideo] = useState(false);

  const [status, setStatus] = useState<AppStatus>('idle');
  const [activeStep, setActiveStep] = useState<WorkflowStepKey>('source');
  const [isDryRun, setIsDryRun] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState({ ok: 0, skip: 0, error: 0 });
  const [banner, setBanner] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [savePresetSignal, setSavePresetSignal] = useState(0);
  const [infoPage, setInfoPage] = useState<InfoPage | null>(null);

  const logRef = useRef<LogEntry[]>([]);
  const pendingLogRef = useRef<LogEntry[]>([]);
  const pendingProgressRef = useRef<{
    progress: { current: number; total: number };
    stats: { ok: number; skip: number; error: number };
  } | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushProgressBuffer = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    if (pendingLogRef.current.length > 0) {
      logRef.current = [...logRef.current, ...pendingLogRef.current];
      pendingLogRef.current = [];
      setLogEntries(logRef.current);
    }

    if (pendingProgressRef.current) {
      setProgress(pendingProgressRef.current.progress);
      setStats(pendingProgressRef.current.stats);
      pendingProgressRef.current = null;
    }
  }, []);

  const scheduleProgressFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(flushProgressBuffer, 120);
  }, [flushProgressBuffer]);

  const addLog = useCallback(
    (entry: LogEntry, buffered = false) => {
      if (buffered) {
        pendingLogRef.current.push(entry);
        scheduleProgressFlush();
        return;
      }

      flushProgressBuffer();
      logRef.current = [...logRef.current, entry];
      setLogEntries(logRef.current);
    },
    [flushProgressBuffer, scheduleProgressFlush],
  );

  const checkForUpdates = useCallback(
    async (showNoUpdateBanner = false) => {
      try {
        const info = await invoke<UpdateInfo>('check_update');
        setUpdateInfo(info);
        if (info.available) {
          setBanner({ type: 'warning', message: `${t('update.available')} v${info.version}` });
        } else if (showNoUpdateBanner) {
          setBanner({ type: 'success', message: 'LightOps is up to date.' });
          setTimeout(() => setBanner(null), 3000);
        }
      } catch (e) {
        if (showNoUpdateBanner) {
          setBanner({ type: 'error', message: `Update check failed: ${e}` });
        }
      }
    },
    [t],
  );

  useEffect(() => {
    checkForUpdates(false);
  }, [checkForUpdates]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  const handleAddFolder = useCallback(async () => {
    try {
      const folder = await invoke<string | null>('pick_folder');
      if (folder) {
        setFolders((prev) => (prev.includes(folder) ? prev : [...prev, folder]));
      }
    } catch (e) {
      console.error('pick_folder failed:', e);
    }
  }, []);

  const handleRemoveFolder = useCallback((index: number) => {
    setFolders((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleBrowseOutput = useCallback(async () => {
    try {
      const folder = await invoke<string | null>('pick_folder');
      if (folder) setOutputFolder(folder);
    } catch (e) {
      console.error('pick_folder failed:', e);
    }
  }, []);

  const handleRun = useCallback(
    async (dryRun: boolean) => {
      if (folders.length === 0) {
        setActiveStep('source');
        setBanner({ type: 'error', message: t('errors.noFolders') });
        return;
      }

      const rawExts = rawExtensions.split(/\s+/).filter((e) => e.startsWith('.'));

      if (fileType !== 'jpg' && rawExts.length === 0) {
        setActiveStep('rules');
        setBanner({ type: 'error', message: t('errors.noRawExt') });
        return;
      }

      setActiveStep('review');
      setStatus('processing');
      setIsDryRun(dryRun);
      setBanner(null);
      setStats({ ok: 0, skip: 0, error: 0 });
      setProgress({ current: 0, total: 0 });
      pendingLogRef.current = [];
      pendingProgressRef.current = null;
      logRef.current = [];
      setLogEntries([]);

      addLog({
        type: 'section',
        message: `=== ${dryRun ? 'DRY RUN' : 'PROCESSING'} STARTED ===`,
      });

      try {
        addLog({
          type: 'section',
          message: `Scanning ${folders.length} folder(s)...`,
        });
        const scanResult = await invoke<ScanResult>('scan_folders', {
          folders,
          rawExts,
          recursive: recursiveScan,
          includeVideo,
        });

        const { stats: scanStats } = scanResult;
        addLog({
          type: 'section',
          message: [
            `Found ${scanStats.total_pairs} groups`,
            `${scanStats.both} paired`,
            `${scanStats.jpg_only} JPG-only`,
            `${scanStats.raw_only} RAW-only`,
            ...(scanStats.video_count > 0 ? [`${scanStats.video_count} video`] : []),
          ].join(' · '),
        });

        if (scanResult.pairs.length === 0) {
          addLog({ type: 'warn', message: 'No files found in the selected folders.' });
          setStatus('complete');
          setActiveStep('results');
          setBanner({ type: 'warning', message: 'No files found in the selected folders.' });
          return;
        }

        const planResult = await invoke<BuildPlanResult>('build_rename_plan', {
          pairs: scanResult.pairs,
          opts: {
            prefix,
            fmt_pattern: FORMAT_TO_STRFTIME[format] ?? null,
            file_mode: fileType,
            only_paired: onlyPaired,
            start_num: startNumber,
            include_video: includeVideo,
          },
        });

        if (planResult.skipped_count > 0) {
          addLog({
            type: 'warn',
            message: `${planResult.skipped_count} group(s) skipped — no readable EXIF data.`,
          });
        }

        if (planResult.plan.length === 0) {
          addLog({ type: 'warn', message: 'Nothing to rename.' });
          setStatus('complete');
          setActiveStep('results');
          setBanner({ type: 'warning', message: 'Nothing to rename.' });
          return;
        }

        setProgress({ current: 0, total: planResult.plan.length });
        addLog({
          type: 'section',
          message: `Renaming ${planResult.plan.length} files...`,
        });

        const unlisten = await listen<ProgressEvent>('progress', (event) => {
          const { entry, current, total, stats: eventStats } = event.payload;
          pendingProgressRef.current = {
            progress: { current, total },
            stats: { ok: eventStats.ok, skip: eventStats.skip, error: eventStats.error },
          };
          addLog(
            {
              type: entry.entry_type as LogEntry['type'],
              source: entry.source,
              destination: entry.destination,
              message: entry.message,
            },
            true,
          );
        });

        const result = await invoke<ExecuteResult>('execute_plan', {
          plan: planResult.plan,
          opts: {
            output_dir: outputFolder.trim() || null,
            dry_run: dryRun,
            use_date_subdir: organizeByDate,
            file_op: fileOperation,
          },
        });

        unlisten();
        flushProgressBuffer();
        setActiveStep('results');

        if (result.cancelled) {
          setStatus('stopped');
          setBanner({
            type: 'warning',
            message: `Stopped at ${result.ok} / ${planResult.plan.length} files`,
          });
        } else {
          setStatus('complete');
          addLog({ type: 'section', message: '=== COMPLETED ===' });
          setBanner({
            type: result.errors > 0 ? 'warning' : 'success',
            message: `Completed: ${result.ok} file(s) ${
              dryRun ? 'would be renamed' : 'renamed successfully'
            }${result.errors ? `, ${result.errors} error(s)` : ''}`,
          });
        }
      } catch (e) {
        flushProgressBuffer();
        setStatus('error');
        setActiveStep('results');
        addLog({ type: 'error', message: String(e) });
        setBanner({ type: 'error', message: `Error: ${e}` });
      }
    },
    [
      addLog,
      fileOperation,
      fileType,
      flushProgressBuffer,
      folders,
      format,
      includeVideo,
      onlyPaired,
      organizeByDate,
      outputFolder,
      prefix,
      rawExtensions,
      recursiveScan,
      startNumber,
      t,
    ],
  );

  const handleStop = useCallback(async () => {
    try {
      await invoke('cancel_execution');
    } catch (e) {
      console.error('cancel_execution failed:', e);
    }
  }, []);

  const handleApplyPreset = useCallback((preset: Preset) => {
    setCameraPreset(preset.camera_preset);
    setRawExtensions(preset.raw_extensions);
    setFileType(preset.file_type);
    const fmtKey =
      Object.entries(FORMAT_TO_STRFTIME).find(([, value]) => value === preset.fmt_pattern)?.[0] ??
      'NNNN';
    setFormat(fmtKey);
    setStartNumber(preset.start_num);
    setFileOperation(preset.file_op);
    setRecursiveScan(preset.recursive);
    setOrganizeByDate(preset.organize_by_date);
    setOnlyPaired(preset.only_paired);
    setIncludeVideo(preset.include_video);
  }, []);

  const handleClearLog = useCallback(() => {
    pendingLogRef.current = [];
    pendingProgressRef.current = null;
    flushProgressBuffer();
    logRef.current = [];
    setLogEntries([]);
    setStats({ ok: 0, skip: 0, error: 0 });
    setProgress({ current: 0, total: 0 });
    setBanner(null);
    setStatus('idle');
    setActiveStep(getStepForInputs(folders));
  }, [flushProgressBuffer, folders]);

  const handleLanguageChange = useCallback(
    (lang: string) => {
      i18n.changeLanguage(lang);
      try {
        localStorage.setItem('lightops-language', lang);
      } catch {
        /* ignore */
      }
    },
    [i18n],
  );

  const handleDefaultCameraChange = useCallback((value: string) => {
    setDefaultCamera(value);
    try {
      localStorage.setItem(STORAGE.camera, value);
    } catch {
      /* ignore */
    }
  }, []);

  const handleDefaultFileOperationChange = useCallback((value: 'copy' | 'move') => {
    setDefaultFileOperation(value);
    try {
      localStorage.setItem(STORAGE.fileOp, value);
    } catch {
      /* ignore */
    }
  }, []);

  const handleDefaultRecursiveScanChange = useCallback((value: boolean) => {
    setDefaultRecursiveScan(value);
    try {
      localStorage.setItem(STORAGE.recursive, String(value));
    } catch {
      /* ignore */
    }
  }, []);

  const handleDefaultOrganizeByDateChange = useCallback((value: boolean) => {
    setDefaultOrganizeByDate(value);
    try {
      localStorage.setItem(STORAGE.organize, String(value));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    const setupMenuListener = async () => {
      const unlisten = await listen<string>(MENU_EVENT, (event) => {
        switch (event.payload) {
          case 'menu:add-source':
            handleAddFolder();
            break;
          case 'menu:choose-output':
            handleBrowseOutput();
            break;
          case 'menu:save-preset':
            setActiveStep('rules');
            setSavePresetSignal((value) => value + 1);
            break;
          case 'menu:settings':
            setIsSettingsOpen(true);
            break;
          case 'menu:dry-run':
            handleRun(true);
            break;
          case 'menu:run':
            handleRun(false);
            break;
          case 'menu:stop':
            handleStop();
            break;
          case 'menu:show-results':
            if (logRef.current.length > 0 || status !== 'idle') setActiveStep('results');
            break;
          case 'menu:language-en':
            handleLanguageChange('en');
            break;
          case 'menu:language-vi':
            handleLanguageChange('vi');
            break;
          case 'menu:check-updates':
            checkForUpdates(true);
            break;
          case 'menu:help':
            setInfoPage('help');
            break;
          case 'menu:shortcuts':
            setInfoPage('shortcuts');
            break;
          case 'menu:about':
            setInfoPage('about');
            break;
        }
      });

      if (disposed) {
        unlisten();
      }
      return unlisten;
    };

    const unlistenPromise = setupMenuListener();
    return () => {
      disposed = true;
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [
    checkForUpdates,
    handleAddFolder,
    handleBrowseOutput,
    handleLanguageChange,
    handleRun,
    handleStop,
    status,
  ]);

  const isProcessing = status === 'processing';
  const hasResults = logEntries.length > 0 || status !== 'idle';
  const currentSettings: Omit<Preset, 'name'> = {
    camera_preset: cameraPreset,
    raw_extensions: rawExtensions,
    file_type: fileType,
    prefix,
    fmt_pattern: FORMAT_TO_STRFTIME[format] ?? null,
    start_num: startNumber,
    file_op: fileOperation,
    recursive: recursiveScan,
    organize_by_date: organizeByDate,
    only_paired: onlyPaired,
    include_video: includeVideo,
  };

  const steps: WorkflowStep[] = useMemo(
    () => [
      {
        key: 'source',
        label: 'Source',
        description: 'Folders and destination',
        complete: folders.length > 0,
        disabled: isProcessing,
      },
      {
        key: 'rules',
        label: 'Rules',
        description: 'Camera and rename settings',
        complete: folders.length > 0,
        disabled: folders.length === 0 || isProcessing,
      },
      {
        key: 'review',
        label: 'Review',
        description: 'Dry run or execute',
        complete: hasResults,
        disabled: folders.length === 0 && !isProcessing,
      },
      {
        key: 'results',
        label: 'Results',
        description: 'Logs and output',
        disabled: !hasResults,
      },
    ],
    [folders.length, hasResults, isProcessing],
  );

  const goToStep = (step: WorkflowStepKey) => {
    const target = steps.find((item) => item.key === step);
    if (!target?.disabled) setActiveStep(step);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      const editable = isEditableTarget(event.target);

      if (event.key === 'Escape') {
        if (infoPage) {
          event.preventDefault();
          setInfoPage(null);
          return;
        }
        if (isSettingsOpen) {
          event.preventDefault();
          setIsSettingsOpen(false);
          return;
        }
        if (isProcessing) {
          event.preventDefault();
          handleStop();
        }
        return;
      }

      if (!modifier && event.key === '?' && !editable) {
        event.preventDefault();
        setInfoPage('shortcuts');
        return;
      }

      if (!modifier && event.key === 'F1' && !editable) {
        event.preventDefault();
        setInfoPage('help');
        return;
      }

      if (!modifier) return;

      if (event.key === '/' && !editable) {
        event.preventDefault();
        setInfoPage('shortcuts');
        return;
      }

      if (['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        const nextStep = (['source', 'rules', 'review', 'results'] as const)[Number(event.key) - 1];
        const target = steps.find((step) => step.key === nextStep);
        if (!target?.disabled) setActiveStep(nextStep);
        return;
      }

      if (event.key.toLowerCase() === 'o' && !editable) {
        event.preventDefault();
        if (event.shiftKey) {
          handleBrowseOutput();
        } else {
          handleAddFolder();
        }
        return;
      }

      if (event.key === ',' && !editable) {
        event.preventDefault();
        setIsSettingsOpen(true);
        return;
      }

      if (event.key.toLowerCase() === 'l' && !editable) {
        event.preventDefault();
        if (hasResults) setActiveStep('results');
        return;
      }

      if (event.key === 'Enter' && !editable) {
        event.preventDefault();
        handleRun(event.shiftKey);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleAddFolder,
    handleBrowseOutput,
    handleRun,
    handleStop,
    hasResults,
    infoPage,
    isProcessing,
    isSettingsOpen,
    steps,
  ]);

  const renderBanner = () => {
    if (!banner || activeStep === 'results') return null;
    const Icon =
      banner.type === 'success'
        ? CheckCircle
        : banner.type === 'warning'
          ? AlertTriangle
          : AlertCircle;
    return (
      <div
        className="relative z-20 mx-4 mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm"
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
          background: 'rgba(0,0,0,0.25)',
        }}
      >
        <Icon className="h-4 w-4" />
        <span>{banner.message}</span>
      </div>
    );
  };

  const renderActiveStep = () => {
    switch (activeStep) {
      case 'source':
        return (
          <SourceStep
            folders={folders}
            outputFolder={outputFolder}
            onAddFolder={handleAddFolder}
            onRemoveFolder={handleRemoveFolder}
            onBrowseOutput={handleBrowseOutput}
            onOutputChange={setOutputFolder}
            onNext={() => setActiveStep('rules')}
          />
        );
      case 'rules':
        return (
          <RulesStep
            cameraPreset={cameraPreset}
            rawExtensions={rawExtensions}
            fileType={fileType}
            prefix={prefix}
            format={format}
            startNumber={startNumber}
            recursiveScan={recursiveScan}
            fileOperation={fileOperation}
            organizeByDate={organizeByDate}
            onlyPaired={onlyPaired}
            includeVideo={includeVideo}
            currentSettings={currentSettings}
            savePresetSignal={savePresetSignal}
            onCameraChange={setCameraPreset}
            onRawExtensionsChange={setRawExtensions}
            onFileTypeChange={setFileType}
            onPrefixChange={setPrefix}
            onFormatChange={setFormat}
            onStartNumberChange={setStartNumber}
            onRecursiveScanChange={setRecursiveScan}
            onFileOperationChange={setFileOperation}
            onOrganizeByDateChange={setOrganizeByDate}
            onOnlyPairedChange={setOnlyPaired}
            onIncludeVideoChange={setIncludeVideo}
            onApplyPreset={handleApplyPreset}
            onBack={() => setActiveStep('source')}
            onNext={() => setActiveStep('review')}
          />
        );
      case 'results':
        return (
          <ResultsStep
            banner={banner}
            entries={logEntries}
            isDryRun={isDryRun}
            stats={stats}
            onClear={handleClearLog}
            onBackToRules={() => setActiveStep('rules')}
          />
        );
      case 'review':
      default:
        return (
          <ReviewRunStep
            folders={folders}
            outputFolder={outputFolder}
            cameraPreset={cameraPreset}
            rawExtensions={rawExtensions}
            fileType={fileType}
            prefix={prefix}
            format={format}
            startNumber={startNumber}
            recursiveScan={recursiveScan}
            fileOperation={fileOperation}
            organizeByDate={organizeByDate}
            onlyPaired={onlyPaired}
            includeVideo={includeVideo}
            status={status}
            progress={progress}
            stats={stats}
            isProcessing={isProcessing}
            onRun={() => handleRun(false)}
            onDryRun={() => handleRun(true)}
            onStop={handleStop}
            onBack={() => setActiveStep('rules')}
          />
        );
    }
  };

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,0.18),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(79,172,254,0.12),transparent_28%),linear-gradient(135deg,#0f0c29,#24243e)]" />
      {renderBanner()}
      <div className="min-h-0 flex-1">
        <WorkflowShell
          steps={steps}
          activeStep={activeStep}
          statusLabel={getStatusLabel(status)}
          isProcessing={isProcessing}
          onStepChange={goToStep}
          onOpenHelp={() => setInfoPage('help')}
        >
          {renderActiveStep()}
        </WorkflowShell>
      </div>
      {updateInfo?.available && activeStep !== 'results' && (
        <div
          className="absolute bottom-4 right-4 z-20 rounded-xl border px-4 py-3 text-sm"
          style={{
            background: 'rgba(102,126,234,0.15)',
            borderColor: 'rgba(102,126,234,0.3)',
            color: 'var(--text-secondary)',
          }}
        >
          {t('update.available')} v{updateInfo.version}
        </div>
      )}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        language={i18n.language}
        onLanguageChange={handleLanguageChange}
        defaultCamera={defaultCamera}
        onDefaultCameraChange={handleDefaultCameraChange}
        defaultFileOperation={defaultFileOperation}
        onDefaultFileOperationChange={handleDefaultFileOperationChange}
        defaultRecursiveScan={defaultRecursiveScan}
        onDefaultRecursiveScanChange={handleDefaultRecursiveScanChange}
        defaultOrganizeByDate={defaultOrganizeByDate}
        onDefaultOrganizeByDateChange={handleDefaultOrganizeByDateChange}
      />
      <InfoModal page={infoPage} onPageChange={setInfoPage} onClose={() => setInfoPage(null)} />
    </div>
  );
}

export default App;
