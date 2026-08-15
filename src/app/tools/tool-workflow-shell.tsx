import { ArrowLeft, Check, Circle, LoaderCircle, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getToolDefinition, type ToolId } from '../toolbox/tool-catalog';

export type ToolWorkflowStep = {
  id: string;
  label: string;
  description: string;
  complete?: boolean;
  disabled?: boolean;
};

export type ToolStat = {
  label: string;
  value: string;
  tone?: 'default' | 'accent' | 'warning';
};

type ToolWorkflowShellProps = {
  toolId: ToolId;
  steps: ToolWorkflowStep[];
  activeStep: string;
  statusLabel: string;
  isProcessing?: boolean;
  onBack: () => void;
  onStepChange: (stepId: string) => void;
  children: ReactNode;
};

type ToolStepFrameProps = {
  eyebrow: string;
  title: string;
  description: string;
  stats?: ToolStat[];
  footer?: ReactNode;
  children: ReactNode;
};

const ACCENTS: Record<ToolId, { rgb: string; glow: string }> = {
  ingest_rename: { rgb: '139 92 246', glow: '217 70 239' },
  resize: { rgb: '14 165 233', glow: '34 211 238' },
  minimize: { rgb: '16 185 129', glow: '45 212 191' },
  sequence_grouper: { rgb: '245 158 11', glow: '251 146 60' },
  metadata_cleaner: { rgb: '244 63 94', glow: '244 114 182' },
  before_after: { rgb: '99 102 241', glow: '167 139 250' },
};

function ToolMark({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[14px] border border-white/15 bg-white/[0.07] shadow-[0_12px_35px_rgba(0,0,0,0.28)]">
      <div className="absolute inset-x-1 top-0 h-px bg-[rgb(var(--tool-glow))] opacity-90" />
      <Icon className="relative h-5 w-5 text-white" strokeWidth={1.7} />
    </div>
  );
}

export function ToolWorkflowShell({
  toolId,
  steps,
  activeStep,
  statusLabel,
  isProcessing = false,
  onBack,
  onStepChange,
  children,
}: ToolWorkflowShellProps) {
  const { t } = useTranslation();
  const tool = getToolDefinition(toolId);
  const accent = ACCENTS[toolId];
  const style = {
    '--tool-accent': accent.rgb,
    '--tool-glow': accent.glow,
  } as CSSProperties;

  return (
    <div
      className="tool-workflow relative z-10 flex h-full min-h-0 gap-3 overflow-hidden p-3 sm:gap-4 sm:p-4"
      data-tool={toolId}
      style={style}
    >
      <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-[rgb(var(--tool-accent))] opacity-[0.07] blur-[90px]" />
      <aside className="relative flex w-[4.75rem] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d0b22]/80 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl min-[1040px]:w-52 min-[1040px]:p-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('toolWorkflow.back')}
          className="mb-3 flex h-9 items-center justify-center gap-2 rounded-xl border border-transparent text-white/55 transition-colors hover:border-white/10 hover:bg-white/[0.06] hover:text-white min-[1040px]:justify-start min-[1040px]:px-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden text-xs font-semibold min-[1040px]:inline">
            {t('toolWorkflow.back')}
          </span>
        </button>

        <div className="mb-4 flex items-center justify-center gap-3 px-1 min-[1040px]:justify-start">
          <ToolMark icon={tool.icon} />
          <div className="hidden min-w-0 min-[1040px]:block">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/35">LightOps</p>
            <h1
              className="mt-1 truncate text-[15px] font-semibold leading-tight text-white"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {t(tool.titleKey)}
            </h1>
          </div>
        </div>

        <nav aria-label={t('toolWorkflow.steps')} className="flex min-h-0 flex-1 flex-col gap-2">
          {steps.map((step, index) => {
            const isActive = step.id === activeStep;
            return (
              <button
                key={step.id}
                type="button"
                disabled={step.disabled}
                onClick={() => onStepChange(step.id)}
                aria-current={isActive ? 'step' : undefined}
                className="group flex min-h-12 items-center justify-center rounded-xl border px-2 py-2 text-left transition-[background-color,border-color,opacity] duration-200 disabled:cursor-not-allowed disabled:opacity-35 min-[1040px]:min-h-[4.25rem] min-[1040px]:justify-start min-[1040px]:gap-2.5 min-[1040px]:p-2.5"
                style={{
                  background: isActive ? 'rgb(var(--tool-accent) / 0.14)' : 'transparent',
                  borderColor: isActive ? 'rgb(var(--tool-accent) / 0.48)' : 'transparent',
                }}
              >
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-bold"
                  style={{
                    background: isActive
                      ? 'rgb(var(--tool-accent) / 0.9)'
                      : 'rgb(255 255 255 / 0.05)',
                    borderColor:
                      step.complete || isActive
                        ? 'rgb(var(--tool-accent) / 0.65)'
                        : 'rgb(255 255 255 / 0.12)',
                    color: step.complete || isActive ? 'white' : 'rgb(255 255 255 / 0.42)',
                  }}
                >
                  {step.complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className="hidden min-w-0 min-[1040px]:block">
                  <span className="block truncate text-xs font-semibold text-white/90">
                    {step.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-white/38">
                    {step.description}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-3 rounded-xl border border-white/10 bg-black/15 p-2">
          <div className="flex items-center justify-center gap-2 min-[1040px]:justify-start">
            {isProcessing ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[rgb(var(--tool-glow))]" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-[rgb(var(--tool-glow))]" />
            )}
            <span className="hidden truncate text-[10px] font-medium text-white/55 min-[1040px]:inline">
              {statusLabel}
            </span>
          </div>
          <div className="mt-2 hidden items-center gap-1.5 border-t border-white/[0.07] pt-2 text-[9px] uppercase tracking-[0.16em] text-white/28 min-[1040px]:flex">
            <ShieldCheck className="h-3 w-3" />
            {t('toolWorkflow.localOnly')}
          </div>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a081e]/80 shadow-[0_24px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-[rgb(var(--tool-glow))] to-transparent opacity-50" />
        {children}
      </main>
    </div>
  );
}

export function ToolStepFrame({
  eyebrow,
  title,
  description,
  stats = [],
  footer,
  children,
}: ToolStepFrameProps) {
  return (
    <section className="tool-step-enter flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-white/[0.08] px-5 py-4 sm:px-7 sm:py-5">
        <div className="flex items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[rgb(var(--tool-glow))]">
              {eyebrow}
            </p>
            <h2
              className="mt-1.5 truncate text-xl font-semibold tracking-[-0.025em] text-white sm:text-2xl"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {title}
            </h2>
            <p className="mt-1 max-w-2xl truncate text-xs leading-relaxed text-white/48 sm:text-[13px]">
              {description}
            </p>
          </div>
          {stats.length > 0 && (
            <dl className="hidden shrink-0 gap-2 md:flex">
              {stats.map((stat) => (
                <div
                  key={`${stat.label}-${stat.value}`}
                  className="min-w-[5.5rem] rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2"
                >
                  <dt className="text-[9px] uppercase tracking-[0.18em] text-white/32">
                    {stat.label}
                  </dt>
                  <dd
                    className={
                      stat.tone === 'warning'
                        ? 'mt-1 text-sm font-semibold text-amber-300'
                        : stat.tone === 'accent'
                          ? 'mt-1 text-sm font-semibold text-[rgb(var(--tool-glow))]'
                          : 'mt-1 text-sm font-semibold text-white/85'
                    }
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </header>

      <div
        data-testid="tool-step-scroll"
        className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6"
      >
        {children}
      </div>

      {footer && (
        <footer
          data-testid="tool-step-footer"
          className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-t border-white/[0.08] bg-black/10 px-5 py-3 sm:px-7"
        >
          {footer}
        </footer>
      )}
    </section>
  );
}
