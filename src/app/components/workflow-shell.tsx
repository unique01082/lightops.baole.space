import { CheckCircle, Circle, HelpCircle, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type WorkflowStepKey = 'source' | 'scan' | 'rules' | 'review' | 'results';

export interface WorkflowStep {
  key: WorkflowStepKey;
  label: string;
  description: string;
  disabled?: boolean;
  complete?: boolean;
}

interface WorkflowShellProps {
  steps: WorkflowStep[];
  activeStep: WorkflowStepKey;
  statusLabel: string;
  isProcessing: boolean;
  onStepChange: (step: WorkflowStepKey) => void;
  onOpenHelp: () => void;
  children: ReactNode;
}

export function WorkflowShell({
  steps,
  activeStep,
  statusLabel,
  isProcessing,
  onStepChange,
  onOpenHelp,
  children,
}: WorkflowShellProps) {
  const { t } = useTranslation();
  return (
    <div className="relative z-10 flex h-full min-h-0 gap-4 p-4">
      <aside
        className="flex w-52 shrink-0 flex-col rounded-2xl border p-3"
        style={{
          background: 'var(--glass-bg)',
          borderColor: 'var(--glass-border)',
        }}
      >
        <div className="mb-4 px-2">
          <p className="text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--text-muted)' }}>
            LightOps
          </p>
          <h1 className="mt-1 text-lg text-white" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('workflowShell.title')}
          </h1>
        </div>

        <nav className="flex flex-1 flex-col gap-2">
          {steps.map((step, index) => {
            const isActive = step.key === activeStep;
            return (
              <button
                key={step.key}
                type="button"
                disabled={step.disabled}
                onClick={() => onStepChange(step.key)}
                aria-current={isActive ? 'step' : undefined}
                className="group rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: isActive ? 'rgba(139, 92, 246, 0.18)' : 'rgba(255,255,255,0.03)',
                  borderColor: isActive ? 'rgba(139, 92, 246, 0.55)' : 'var(--glass-border)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                    style={{
                      background: isActive ? 'var(--accent-lightops)' : 'rgba(255,255,255,0.08)',
                      color: 'white',
                    }}
                  >
                    {step.complete ? (
                      <CheckCircle className="h-3.5 w-3.5" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </span>
                  <span className="text-sm font-semibold text-white">{step.label}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {step.description}
                </p>
              </button>
            );
          })}
        </nav>

        <div className="mt-4 rounded-xl border p-2" style={{ borderColor: 'var(--glass-border)' }}>
          <div
            className="flex items-center gap-2 px-1 py-1 text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            {isProcessing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Circle className="h-3.5 w-3.5" />
            )}
            <span>{statusLabel}</span>
          </div>
          <button
            type="button"
            onClick={onOpenHelp}
            className="mt-2 flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span className="flex items-center gap-2">
              <HelpCircle className="h-3.5 w-3.5" />
              {t('workflowShell.help')}
            </span>
            <kbd
              className="rounded border px-1.5 py-0.5"
              style={{ borderColor: 'var(--glass-border)' }}
            >
              ?
            </kbd>
          </button>
        </div>
      </aside>

      <main
        className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border"
        style={{
          background: 'rgba(10, 8, 30, 0.72)',
          borderColor: 'var(--glass-border)',
          boxShadow: '0 20px 70px rgba(0,0,0,0.28)',
        }}
      >
        {children}
      </main>
    </div>
  );
}
