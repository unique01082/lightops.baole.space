import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { AlertCircle, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InfoModal, InfoPage } from './components/info-modal';
import { LogEntry } from './components/log-panel';
import { Preset } from './components/preset-panel';
import { SettingsModal } from './components/settings-modal';
import { WorkflowShell, WorkflowStep, WorkflowStepKey } from './components/workflow-shell';
import {
  FolderTimeOffset,
  ResultsStep,
  ReviewRunStep,
  RulesStep,
  ScanStep,
  SourceMetadata,
  SourceStep,
} from './components/workflow-steps';

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
  welcomeSeen: 'lightops-welcome-seen',
};

const MENU_EVENT = 'lightops://menu';

type MenuActions = {
  addFolder: () => void;
  browseOutput: () => void;
  changeLanguage: (lang: string) => void;
  checkUpdates: (showNoUpdateBanner?: boolean) => void;
  run: (dryRun: boolean) => void;
  showResults: () => void;
  stop: () => void;
};

function safelyUnlisten(unlisten: () => void) {
  try {
    unlisten();
  } catch (error) {
    console.warn('Failed to unregister Tauri listener:', error);
  }
}

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

function getStatusLabel(status: AppStatus, t: (key: string) => string) {
  switch (status) {
    case 'processing':
      return t('status.processing');
    case 'complete':
      return t('status.complete');
    case 'stopped':
      return t('status.stopped');
    case 'error':
      return t('status.error');
    default:
      return t('status.ready');
  }
}

function getStepForInputs(folders: string[]): WorkflowStepKey {
  return folders.length > 0 ? 'scan' : 'source';
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
  const [sourceMetadata, setSourceMetadata] = useState<SourceMetadata[]>([]);
  const [timeOffsets, setTimeOffsets] = useState<FolderTimeOffset[]>([]);
  const [isScanningSources, setIsScanningSources] = useState(false);

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
  const [savePresetDialogOpen, setSavePresetDialogOpen] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [infoPage, setInfoPage] = useState<InfoPage | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      return localStorage.getItem(STORAGE.welcomeSeen) !== 'true';
    } catch {
      return true;
    }
  });

  const logRef = useRef<LogEntry[]>([]);
  const pendingLogRef = useRef<LogEntry[]>([]);
  const pendingProgressRef = useRef<{
    progress: { current: number; total: number };
    stats: { ok: number; skip: number; error: number };
  } | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuActionsRef = useRef<MenuActions | null>(null);

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
    const timer = window.setTimeout(() => setShowSplash(false), 900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  const handleAddFolder = useCallback(async () => {
    try {
      const folder = await invoke<string | null>('pick_folder');
      if (folder) {
        setSourceMetadata([]);
        setTimeOffsets([]);
        setFolders((prev) => (prev.includes(folder) ? prev : [...prev, folder]));
      }
    } catch (e) {
      console.error('pick_folder failed:', e);
    }
  }, []);

  const handleRemoveFolder = useCallback(
    (index: number) => {
      const removed = folders[index];
      if (removed) {
        setSourceMetadata((items) => items.filter((item) => item.folder !== removed));
        setTimeOffsets((items) => items.filter((item) => item.folder !== removed));
      }
      setFolders((prev) => prev.filter((_, i) => i !== index));
    },
    [folders],
  );

  const handleBrowseOutput = useCallback(async () => {
    try {
      const folder = await invoke<string | null>('pick_folder');
      if (folder) setOutputFolder(folder);
    } catch (e) {
      console.error('pick_folder failed:', e);
    }
  }, []);

  const applyScanRules = useCallback(
    (metadata: SourceMetadata[]) => {
      const rawExts = Array.from(
        new Set(metadata.flatMap((item) => item.raw_extensions).filter(Boolean)),
      ).sort();
      if (rawExts.length > 0) {
        setRawExtensions(rawExts.join(' '));
      }
      setCameraPreset('detected');

      const hasJpg = metadata.some((item) => item.jpg_count > 0);
      const hasRaw = metadata.some((item) => item.raw_count > 0);
      if (!hasRaw) {
        setFileType('jpg');
      } else if (!hasJpg) {
        setFileType('raw');
      }
    },
    [setRawExtensions],
  );

  const handleScanSources = useCallback(async () => {
    if (folders.length === 0) {
      setActiveStep('source');
      setBanner({ type: 'error', message: t('errors.noFolders') });
      return;
    }

    setIsScanningSources(true);
    setBanner(null);
    setActiveStep('scan');
    try {
      const metadata = await invoke<SourceMetadata[]>('scan_source_metadata', { folders });
      setSourceMetadata(metadata);
      setTimeOffsets((prev) =>
        metadata.map((item) => {
          const existing = prev.find((offset) => offset.folder === item.folder);
          return {
            folder: item.folder,
            offset_ms: existing?.offset_ms ?? 0,
            label:
              existing?.label ??
              ([item.camera_make, item.camera_model].filter(Boolean).join(' ') ||
                t('shared.unknownCamera')),
          };
        }),
      );
      applyScanRules(metadata);
    } catch (e) {
      setBanner({ type: 'error', message: t('workflow.run.scanFailed', { error: String(e) }) });
    } finally {
      setIsScanningSources(false);
    }
  }, [applyScanRules, folders, t]);

  const handleOffsetChange = useCallback((folder: string, offsetMs: number) => {
    const normalized = Math.trunc(offsetMs);
    setTimeOffsets((prev) =>
      prev.map((offset) =>
        offset.folder === folder ? { ...offset, offset_ms: normalized } : offset,
      ),
    );
  }, []);

  const handleOffsetLabelChange = useCallback((folder: string, label: string) => {
    setTimeOffsets((prev) =>
      prev.map((offset) => (offset.folder === folder ? { ...offset, label } : offset)),
    );
  }, []);

  const handleRun = useCallback(
    async (dryRun: boolean) => {
      if (folders.length === 0) {
        setActiveStep('source');
        setBanner({ type: 'error', message: t('errors.noFolders') });
        return;
      }

      if (sourceMetadata.length === 0) {
        setActiveStep('scan');
        setBanner({ type: 'warning', message: t('workflow.run.scanFirst') });
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
        message: dryRun ? t('workflow.run.dryRunStarted') : t('workflow.run.processingStarted'),
      });

      let unlistenProgress: (() => void) | undefined;
      const cleanupProgressListener = () => {
        if (!unlistenProgress) return;
        const unlisten = unlistenProgress;
        unlistenProgress = undefined;
        safelyUnlisten(unlisten);
      };

      try {
        addLog({
          type: 'section',
          message: t('workflow.run.scanningFolders', { count: folders.length }),
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
          message: t('workflow.run.foundGroups', {
            total: scanStats.total_pairs,
            paired: scanStats.both,
            jpgOnly: scanStats.jpg_only,
            rawOnly: scanStats.raw_only,
            video:
              scanStats.video_count > 0
                ? t('workflow.run.videoCount', { count: scanStats.video_count })
                : '',
          }),
        });

        if (scanResult.pairs.length === 0) {
          addLog({ type: 'warn', message: t('workflow.run.noFilesFound') });
          setStatus('complete');
          setActiveStep('results');
          setBanner({ type: 'warning', message: t('workflow.run.noFilesFound') });
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
            time_offsets: timeOffsets.map(({ folder, offset_ms }) => ({
              folder,
              offset_ms,
            })),
          },
        });

        if (planResult.skipped_count > 0) {
          addLog({
            type: 'warn',
            message: t('workflow.run.skippedGroups', { count: planResult.skipped_count }),
          });
        }

        if (planResult.plan.length === 0) {
          addLog({ type: 'warn', message: t('workflow.run.nothingToRename') });
          setStatus('complete');
          setActiveStep('results');
          setBanner({ type: 'warning', message: t('workflow.run.nothingToRename') });
          return;
        }

        setProgress({ current: 0, total: planResult.plan.length });
        addLog({
          type: 'section',
          message: t('workflow.run.renamingFiles', { count: planResult.plan.length }),
        });

        unlistenProgress = await listen<ProgressEvent>('progress', (event) => {
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

        let result: ExecuteResult;
        try {
          result = await invoke<ExecuteResult>('execute_plan', {
            plan: planResult.plan,
            opts: {
              output_dir: outputFolder.trim() || null,
              dry_run: dryRun,
              use_date_subdir: organizeByDate,
              file_op: fileOperation,
            },
          });
        } finally {
          cleanupProgressListener();
        }

        flushProgressBuffer();
        setActiveStep('results');

        if (result.cancelled) {
          setStatus('stopped');
          setBanner({
            type: 'warning',
            message: t('workflow.run.stoppedAt', { ok: result.ok, total: planResult.plan.length }),
          });
        } else {
          setStatus('complete');
          addLog({ type: 'section', message: t('workflow.run.completedSection') });
          setBanner({
            type: result.errors > 0 ? 'warning' : 'success',
            message: t('workflow.run.completed', {
              ok: result.ok,
              mode: dryRun
                ? t('workflow.run.wouldBeRenamed')
                : t('workflow.run.renamedSuccessfully'),
              errors: result.errors ? t('workflow.run.errorsCount', { count: result.errors }) : '',
            }),
          });
        }
      } catch (e) {
        cleanupProgressListener();
        flushProgressBuffer();
        setStatus('error');
        setActiveStep('results');
        addLog({ type: 'error', message: String(e) });
        setBanner({ type: 'error', message: t('workflow.run.error', { error: String(e) }) });
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
      sourceMetadata.length,
      startNumber,
      t,
      timeOffsets,
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

  const handleSavePreset = useCallback(async () => {
    const name = savePresetName.trim();
    if (!name) return;

    setIsSavingPreset(true);
    try {
      const preset: Preset = {
        name,
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
      await invoke('save_preset', { preset });
      setSavePresetDialogOpen(false);
      setSavePresetName('');
      setBanner({ type: 'success', message: `Preset "${name}" saved.` });
      window.setTimeout(() => setBanner(null), 3000);
    } catch (e) {
      setBanner({ type: 'error', message: `Failed to save preset: ${e}` });
    } finally {
      setIsSavingPreset(false);
    }
  }, [
    cameraPreset,
    fileOperation,
    fileType,
    format,
    includeVideo,
    onlyPaired,
    organizeByDate,
    prefix,
    rawExtensions,
    recursiveScan,
    savePresetName,
    startNumber,
  ]);

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

  menuActionsRef.current = {
    addFolder: () => {
      void handleAddFolder();
    },
    browseOutput: () => {
      void handleBrowseOutput();
    },
    changeLanguage: handleLanguageChange,
    checkUpdates: (showNoUpdateBanner = false) => {
      void checkForUpdates(showNoUpdateBanner);
    },
    run: (dryRun: boolean) => {
      void handleRun(dryRun);
    },
    showResults: () => {
      if (logRef.current.length > 0 || status !== 'idle') setActiveStep('results');
    },
    stop: () => {
      void handleStop();
    },
  };

  useEffect(() => {
    let disposed = false;
    let unlistenMenu: (() => void) | undefined;

    const setupMenuListener = async () => {
      const unlisten = await listen<string>(MENU_EVENT, (event) => {
        const actions = menuActionsRef.current;
        if (!actions) return;

        switch (event.payload) {
          case 'menu:add-source':
            actions.addFolder();
            break;
          case 'menu:choose-output':
            actions.browseOutput();
            break;
          case 'menu:save-preset':
            setActiveStep('rules');
            setSavePresetDialogOpen(true);
            break;
          case 'menu:settings':
            setIsSettingsOpen(true);
            break;
          case 'menu:dry-run':
            actions.run(true);
            break;
          case 'menu:run':
            actions.run(false);
            break;
          case 'menu:stop':
            actions.stop();
            break;
          case 'menu:show-results':
            actions.showResults();
            break;
          case 'menu:language-en':
            actions.changeLanguage('en');
            break;
          case 'menu:language-vi':
            actions.changeLanguage('vi');
            break;
          case 'menu:check-updates':
            actions.checkUpdates(true);
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
        safelyUnlisten(unlisten);
        return;
      }
      unlistenMenu = unlisten;
    };

    setupMenuListener().catch((error) => {
      console.error('Failed to set up menu listener:', error);
    });

    return () => {
      disposed = true;
      if (unlistenMenu) {
        safelyUnlisten(unlistenMenu);
        unlistenMenu = undefined;
      }
    };
  }, []);

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

  const allowedFileTypes = useMemo<Array<'both' | 'jpg' | 'raw'>>(() => {
    const hasJpg = sourceMetadata.some((item) => item.jpg_count > 0);
    const hasRaw = sourceMetadata.some((item) => item.raw_count > 0);
    if (hasJpg && hasRaw) return ['both', 'jpg', 'raw'];
    if (hasRaw) return ['raw'];
    return ['jpg'];
  }, [sourceMetadata]);

  const steps: WorkflowStep[] = useMemo(
    () => [
      {
        key: 'source',
        label: t('workflow.source.title'),
        description: t('workflow.source.navDescription'),
        complete: folders.length > 0,
        disabled: isProcessing,
      },
      {
        key: 'scan',
        label: t('workflow.scan.title'),
        description: t('workflow.scan.navDescription'),
        complete: sourceMetadata.length > 0,
        disabled: folders.length === 0 || isProcessing,
      },
      {
        key: 'rules',
        label: t('workflow.rules.title'),
        description: t('workflow.rules.navDescription'),
        complete: sourceMetadata.length > 0,
        disabled: sourceMetadata.length === 0 || isProcessing,
      },
      {
        key: 'review',
        label: t('workflow.review.title'),
        description: t('workflow.review.navDescription'),
        complete: hasResults,
        disabled: sourceMetadata.length === 0 && !isProcessing,
      },
      {
        key: 'results',
        label: t('workflow.results.title'),
        description: t('workflow.results.navDescription'),
        disabled: !hasResults,
      },
    ],
    [folders.length, hasResults, isProcessing, sourceMetadata.length, t],
  );

  const goToStep = (step: WorkflowStepKey) => {
    const target = steps.find((item) => item.key === step);
    if (target?.disabled) return;
    if (step === 'scan' && sourceMetadata.length === 0 && folders.length > 0) {
      handleScanSources();
      return;
    }
    setActiveStep(step);
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

      if (['1', '2', '3', '4', '5'].includes(event.key)) {
        event.preventDefault();
        const nextStep = (['source', 'scan', 'rules', 'review', 'results'] as const)[
          Number(event.key) - 1
        ];
        const target = steps.find((step) => step.key === nextStep);
        if (!target?.disabled) {
          if (nextStep === 'scan' && sourceMetadata.length === 0 && folders.length > 0) {
            handleScanSources();
          } else {
            setActiveStep(nextStep);
          }
        }
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
    handleScanSources,
    handleStop,
    hasResults,
    infoPage,
    isProcessing,
    isSettingsOpen,
    folders.length,
    sourceMetadata.length,
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

  const renderSavePresetDialog = () => {
    if (!savePresetDialogOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-preset-title"
          className="w-full max-w-md rounded-3xl border p-5 shadow-2xl"
          style={{
            background: 'rgba(15, 12, 41, 0.98)',
            borderColor: 'var(--glass-border)',
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className="text-xs uppercase tracking-[0.28em]"
                style={{ color: 'var(--text-muted)' }}
              >
                {t('workflow.savePreset.eyebrow')}
              </p>
              <h2 id="save-preset-title" className="mt-1 text-xl text-white">
                {t('workflow.savePreset.title')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSavePresetDialogOpen(false)}
              className="rounded-lg p-2 transition-colors hover:bg-white/10"
              aria-label={t('workflow.savePreset.close')}
            >
              <X className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
          <label className="mt-5 block text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('workflow.savePreset.nameLabel')}
            <input
              autoFocus
              value={savePresetName}
              onChange={(event) => setSavePresetName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSavePreset();
                if (event.key === 'Escape') setSavePresetDialogOpen(false);
              }}
              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
              style={{
                background: 'var(--input-background)',
                borderColor: 'var(--glass-border)',
                color: 'var(--text-primary)',
              }}
              placeholder={t('workflow.savePreset.placeholder')}
            />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSavePresetDialogOpen(false)}
              className="rounded-xl border px-4 py-2 text-sm"
              style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}
            >
              {t('workflow.savePreset.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSavePreset}
              disabled={isSavingPreset || !savePresetName.trim()}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: 'var(--accent-lightops)' }}
            >
              {isSavingPreset ? t('workflow.savePreset.saving') : t('workflow.savePreset.save')}
            </button>
          </div>
        </div>
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
            onNext={handleScanSources}
          />
        );
      case 'scan':
        return (
          <ScanStep
            folders={folders}
            metadata={sourceMetadata}
            offsets={timeOffsets}
            isScanning={isScanningSources}
            onScan={handleScanSources}
            onOffsetChange={handleOffsetChange}
            onLabelChange={handleOffsetLabelChange}
            onBack={() => setActiveStep('source')}
            onNext={() => setActiveStep('rules')}
          />
        );
      case 'rules':
        return (
          <RulesStep
            metadata={sourceMetadata}
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
            allowedFileTypes={allowedFileTypes}
            currentSettings={currentSettings}
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
            onSavePresetClick={() => setSavePresetDialogOpen(true)}
            onBack={() => setActiveStep('scan')}
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
            metadata={sourceMetadata}
            offsets={timeOffsets}
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

  const dismissWelcome = () => {
    setShowWelcome(false);
    try {
      localStorage.setItem(STORAGE.welcomeSeen, 'true');
    } catch {
      /* ignore */
    }
  };

  if (showSplash) {
    return (
      <div className="relative flex h-screen items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,0.2),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(79,172,254,0.14),transparent_28%),linear-gradient(135deg,#0f0c29,#24243e)]" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <img src="/icons/lightops.svg" alt="" className="h-20 w-20 rounded-3xl shadow-2xl" />
          <h1 className="mt-5 text-4xl text-white" style={{ fontFamily: 'var(--font-heading)' }}>
            LightOps
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('titleBar.subtitle')}
          </p>
        </div>
      </div>
    );
  }

  if (showWelcome) {
    return (
      <div className="relative flex h-screen items-center justify-center overflow-hidden p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,0.18),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(79,172,254,0.12),transparent_28%),linear-gradient(135deg,#0f0c29,#24243e)]" />
        <div
          className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[2rem] border shadow-2xl lg:grid-cols-[1fr_1.1fr]"
          style={{
            background: 'rgba(10, 8, 30, 0.78)',
            borderColor: 'var(--glass-border)',
          }}
        >
          <div
            className="flex flex-col justify-between border-b p-7 lg:border-b-0 lg:border-r"
            style={{ borderColor: 'var(--glass-divider)' }}
          >
            <div>
              <img src="/icons/lightops.svg" alt="" className="h-16 w-16 rounded-2xl" />
              <h1
                className="mt-6 text-4xl text-white"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {t('workflow.welcome.title')}
              </h1>
              <p
                className="mt-4 text-sm leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('workflow.welcome.body')}
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  dismissWelcome();
                  handleAddFolder();
                }}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ background: 'var(--accent-lightops)' }}
              >
                {t('workflow.welcome.addSource')}
              </button>
              <button
                type="button"
                onClick={dismissWelcome}
                className="rounded-xl border px-4 py-2 text-sm"
                style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}
              >
                {t('workflow.welcome.openWorkflow')}
              </button>
            </div>
          </div>
          <div className="p-7">
            <p
              className="text-xs uppercase tracking-[0.28em]"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('workflow.welcome.eyebrow')}
            </p>
            <div className="mt-4 grid gap-3">
              {[
                [
                  'source',
                  t('workflow.welcome.steps.source.title'),
                  t('workflow.welcome.steps.source.body'),
                ],
                [
                  'scan',
                  t('workflow.welcome.steps.scan.title'),
                  t('workflow.welcome.steps.scan.body'),
                ],
                [
                  'rules',
                  t('workflow.welcome.steps.rules.title'),
                  t('workflow.welcome.steps.rules.body'),
                ],
                [
                  'review',
                  t('workflow.welcome.steps.review.title'),
                  t('workflow.welcome.steps.review.body'),
                ],
                [
                  'results',
                  t('workflow.welcome.steps.results.title'),
                  t('workflow.welcome.steps.results.body'),
                ],
              ].map(([key, title, body]) => (
                <div
                  key={key}
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: 'var(--glass-border)',
                    background: 'rgba(255,255,255,0.04)',
                  }}
                >
                  <h2 className="text-sm font-semibold text-white">{title}</h2>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,0.18),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(79,172,254,0.12),transparent_28%),linear-gradient(135deg,#0f0c29,#24243e)]" />
      {renderBanner()}
      <div className="min-h-0 flex-1">
        <WorkflowShell
          steps={steps}
          activeStep={activeStep}
          statusLabel={getStatusLabel(status, t)}
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
      {renderSavePresetDialog()}
    </div>
  );
}

export default App;
