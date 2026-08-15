import { ArrowLeft, CheckCircle2, CloudOff, Settings } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listRecentJobs,
  subscribeToRecentJobs,
  type RecentJob,
} from '../../lib/local-store-client';
import { AccountButton } from './account-button';
import { TOOL_CATALOG, getToolDefinition, type ToolId } from './tool-catalog';
import { ToolboxSettings } from './toolbox-settings';

type ToolboxShellProps = {
  renderIngest: () => ReactNode;
  renderTool?: (toolId: Exclude<ToolId, 'ingest_rename'>, onBack: () => void) => ReactNode;
};

function ToolWorkspace({ toolId, onBack }: { toolId: ToolId; onBack: () => void }) {
  const { t } = useTranslation();
  const tool = getToolDefinition(toolId);
  const Icon = tool.icon;

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-4 border-b border-white/10 px-6 py-4">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('toolbox.back')}
          className="rounded-xl border border-white/10 bg-white/5 p-2.5 transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className={`rounded-xl bg-gradient-to-br ${tool.accent} p-2.5`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/45">
            {t('toolbox.workspace')}
          </p>
          <h1 className="font-heading text-xl font-semibold">{t(tool.titleKey)}</h1>
        </div>
      </header>
      <section className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-5xl rounded-2xl border border-dashed border-white/15 bg-black/10 p-8 text-center">
          <Icon className="mx-auto mb-4 h-8 w-8 text-white/55" />
          <p className="text-sm text-white/60">{t(tool.descriptionKey)}</p>
        </div>
      </section>
    </main>
  );
}

export function ToolboxShell({ renderIngest, renderTool }: ToolboxShellProps) {
  const { t, i18n } = useTranslation();
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const toolButtonRefs = useRef(new Map<ToolId, HTMLButtonElement>());
  const returnFocusToolRef = useRef<ToolId | null>(null);

  useEffect(() => {
    const refresh = () => void listRecentJobs().then(setRecentJobs);
    refresh();
    return subscribeToRecentJobs(refresh);
  }, []);

  useLayoutEffect(() => {
    if (activeTool !== null || returnFocusToolRef.current === null) return;
    toolButtonRefs.current.get(returnFocusToolRef.current)?.focus();
    returnFocusToolRef.current = null;
  }, [activeTool]);

  const openTool = (toolId: ToolId) => {
    returnFocusToolRef.current = toolId;
    setActiveTool(toolId);
  };

  const closeTool = () => setActiveTool(null);

  if (activeTool === 'ingest_rename') {
    return (
      <div className="relative h-full min-h-0">
        <button
          type="button"
          onClick={closeTool}
          aria-label={t('toolbox.back')}
          className="absolute left-4 top-3 z-50 rounded-lg border border-white/10 bg-black/40 p-2 backdrop-blur transition hover:bg-black/60"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        {renderIngest()}
      </div>
    );
  }

  if (activeTool) {
    const customTool = renderTool?.(activeTool, closeTool);
    return customTool ?? <ToolWorkspace toolId={activeTool} onBack={closeTool} />;
  }

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden" aria-labelledby="toolbox-title">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">
            baole.space
          </p>
          <h1 id="toolbox-title" className="font-heading text-2xl font-semibold">
            {t('toolbox.title')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <AccountButton />
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/55 sm:flex">
            <CloudOff className="h-3.5 w-3.5" />
            {t('toolbox.offline')}
          </div>
          <div
            className="flex rounded-lg bg-white/5 p-1"
            role="group"
            aria-label={t('settings.language')}
          >
            {(['en', 'vi'] as const).map((language) => (
              <button
                key={language}
                type="button"
                onClick={() => i18n.changeLanguage(language)}
                aria-pressed={i18n.language.startsWith(language)}
                className="rounded-md px-2 py-1 text-xs font-semibold text-white/65 aria-pressed:bg-violet-700 aria-pressed:text-white"
              >
                {language.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            ref={settingsButtonRef}
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/65"
            aria-label={t('titleBar.settings')}
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      <ToolboxSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onAfterClose={() => settingsButtonRef.current?.focus()}
      />

      <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5">
            <h2 className="font-heading text-lg font-semibold">{t('toolbox.chooseTool')}</h2>
            <p className="mt-1 text-sm text-white/50">{t('toolbox.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {TOOL_CATALOG.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  ref={(element) => {
                    if (element) toolButtonRefs.current.set(tool.id, element);
                    else toolButtonRefs.current.delete(tool.id);
                  }}
                  type="button"
                  onClick={() => openTool(tool.id)}
                  aria-label={t(tool.titleKey)}
                  className="group min-h-36 rounded-2xl border border-white/10 bg-white/[0.045] p-5 text-left transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.075]"
                >
                  <div className={`mb-4 w-fit rounded-xl bg-gradient-to-br ${tool.accent} p-2.5`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-heading font-semibold">{t(tool.titleKey)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/50">
                    {t(tool.descriptionKey)}
                  </p>
                </button>
              );
            })}
          </div>

          <section className="mt-5 rounded-2xl border border-white/10 bg-black/10 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading font-semibold">{t('toolbox.recentJobs')}</h2>
                {recentJobs.length === 0 ? (
                  <p className="mt-1 text-sm text-white/45">{t('toolbox.recentJobsEmpty')}</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm text-white/55">
                    {recentJobs.slice(0, 5).map((job) => (
                      <li key={job.id}>
                        {t(getToolDefinition(job.toolId as ToolId).titleKey)} · {job.outputCount}{' '}
                        {t('toolbox.outputs')}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <CheckCircle2 className="h-5 w-5 text-white/25" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
