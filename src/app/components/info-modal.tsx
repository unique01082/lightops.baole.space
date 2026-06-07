import { Aperture, BookOpen, Keyboard, UserRound, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type InfoPage = 'help' | 'shortcuts' | 'about';

interface InfoModalProps {
  page: InfoPage | null;
  onPageChange: (page: InfoPage) => void;
  onClose: () => void;
}

export function InfoModal({ page, onPageChange, onClose }: InfoModalProps) {
  const { t } = useTranslation();
  if (!page) return null;

  const pages: Array<{
    key: InfoPage;
    label: string;
    icon: typeof BookOpen;
  }> = [
    { key: 'help', label: t('info.pages.help'), icon: BookOpen },
    { key: 'shortcuts', label: t('info.pages.shortcuts'), icon: Keyboard },
    { key: 'about', label: t('info.pages.about'), icon: UserRound },
  ];

  const shortcuts = [
    [t('info.shortcuts.addSource'), '⌘/Ctrl O'],
    [t('info.shortcuts.chooseOutput'), '⌘/Ctrl ⇧ O'],
    [t('info.shortcuts.goSource'), '⌘/Ctrl 1'],
    [t('info.shortcuts.goScan'), '⌘/Ctrl 2'],
    [t('info.shortcuts.goRules'), '⌘/Ctrl 3'],
    [t('info.shortcuts.goReview'), '⌘/Ctrl 4'],
    [t('info.shortcuts.goResults'), '⌘/Ctrl 5'],
    [t('info.shortcuts.dryRun'), '⌘/Ctrl ⇧ Enter'],
    [t('info.shortcuts.run'), '⌘/Ctrl Enter'],
    [t('info.shortcuts.stop'), 'Esc'],
    [t('info.shortcuts.settings'), '⌘/Ctrl ,'],
    [t('info.shortcuts.help'), 'F1'],
    [t('info.shortcuts.showHelp'), '?'],
    [t('info.shortcuts.keyboard'), '⌘/Ctrl /'],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lightops-info-title"
        className="grid max-h-[82vh] w-full max-w-3xl overflow-hidden rounded-3xl border shadow-2xl md:grid-cols-[180px_1fr]"
        style={{
          background: 'rgba(15, 12, 41, 0.98)',
          borderColor: 'var(--glass-border)',
          boxShadow: '0 24px 64px rgba(139, 92, 246, 0.22)',
        }}
      >
        <aside
          className="border-b p-4 md:border-b-0 md:border-r"
          style={{ borderColor: 'var(--glass-divider)' }}
        >
          <div className="mb-4 flex items-center gap-2">
            <Aperture className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-semibold text-white">LightOps</span>
          </div>
          <div className="flex gap-2 md:flex-col">
            {pages.map((item) => {
              const Icon = item.icon;
              const active = item.key === page;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onPageChange(item.key)}
                  className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors md:flex-none"
                  style={{
                    background: active ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                    color: active ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          <header
            className="flex items-center justify-between border-b px-5 py-4"
            style={{ borderColor: 'var(--glass-divider)' }}
          >
            <div>
              <p
                className="text-xs uppercase tracking-[0.28em]"
                style={{ color: 'var(--text-muted)' }}
              >
                LightOps
              </p>
              <h2 id="lightops-info-title" className="mt-1 text-xl text-white">
                {page === 'help' && t('info.titles.help')}
                {page === 'shortcuts' && t('info.titles.shortcuts')}
                {page === 'about' && t('info.titles.about')}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:bg-white/10"
              aria-label="Close info"
            >
              <X className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {page === 'help' && (
              <div
                className="space-y-4 text-sm leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                <p>{t('info.help.body')}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    [t('info.help.steps.source.title'), t('info.help.steps.source.body')],
                    [t('info.help.steps.scan.title'), t('info.help.steps.scan.body')],
                    [t('info.help.steps.rules.title'), t('info.help.steps.rules.body')],
                    [t('info.help.steps.review.title'), t('info.help.steps.review.body')],
                    [t('info.help.steps.results.title'), t('info.help.steps.results.body')],
                  ].map(([title, body]) => (
                    <div
                      key={title}
                      className="rounded-xl border p-3"
                      style={{
                        borderColor: 'var(--glass-border)',
                        background: 'rgba(255,255,255,0.04)',
                      }}
                    >
                      <h3 className="text-sm font-semibold text-white">{title}</h3>
                      <p className="mt-1 text-xs">{body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {page === 'shortcuts' && (
              <div className="grid gap-2">
                {shortcuts.map(([label, shortcut]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 rounded-xl border px-3 py-2"
                    style={{
                      borderColor: 'var(--glass-border)',
                      background: 'rgba(255,255,255,0.04)',
                    }}
                  >
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {label}
                    </span>
                    <kbd
                      className="rounded-lg border px-2 py-1 text-xs"
                      style={{
                        borderColor: 'var(--glass-border)',
                        color: 'var(--text-primary)',
                        background: 'rgba(0,0,0,0.24)',
                      }}
                    >
                      {shortcut}
                    </kbd>
                  </div>
                ))}
              </div>
            )}

            {page === 'about' && (
              <div
                className="space-y-4 text-sm leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                <div
                  className="flex items-center gap-4 rounded-2xl border p-4"
                  style={{
                    borderColor: 'var(--glass-border)',
                    background: 'rgba(255,255,255,0.04)',
                  }}
                >
                  <img
                    src="/icons/lightops.svg"
                    alt=""
                    className="h-14 w-14 rounded-xl"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                  <div>
                    <h3 className="text-lg text-white">{t('info.about.title')}</h3>
                    <p>{t('info.about.body')}</p>
                  </div>
                </div>
                <p>{t('info.about.author')}</p>
                <p>{t('info.about.stack')}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
