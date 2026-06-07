import { Aperture, BookOpen, Keyboard, UserRound, X } from 'lucide-react';

export type InfoPage = 'help' | 'shortcuts' | 'about';

interface InfoModalProps {
  page: InfoPage | null;
  onPageChange: (page: InfoPage) => void;
  onClose: () => void;
}

const pages: Array<{
  key: InfoPage;
  label: string;
  icon: typeof BookOpen;
}> = [
  { key: 'help', label: 'Help', icon: BookOpen },
  { key: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { key: 'about', label: 'Author', icon: UserRound },
];

const shortcuts = [
  ['Add source folder', '⌘/Ctrl O'],
  ['Choose output folder', '⌘/Ctrl ⇧ O'],
  ['Go to Source', '⌘/Ctrl 1'],
  ['Go to Rules', '⌘/Ctrl 2'],
  ['Go to Review', '⌘/Ctrl 3'],
  ['Go to Results', '⌘/Ctrl 4'],
  ['Dry run', '⌘/Ctrl ⇧ Enter'],
  ['Run', '⌘/Ctrl Enter'],
  ['Stop processing', 'Esc'],
  ['Settings', '⌘/Ctrl ,'],
  ['LightOps help', 'F1'],
  ['Show help', '?'],
  ['Keyboard shortcuts', '⌘/Ctrl /'],
];

export function InfoModal({ page, onPageChange, onClose }: InfoModalProps) {
  if (!page) return null;

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
                {page === 'help' && 'How LightOps Works'}
                {page === 'shortcuts' && 'Keyboard Shortcuts'}
                {page === 'about' && 'Author & App Info'}
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
                <p>
                  LightOps scans source folders, pairs JPG/RAW files by folder and filename stem,
                  builds a rename plan from capture time, then copies, moves, or renames files.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    [
                      '1. Source',
                      'Choose one or more source folders and an optional output folder.',
                    ],
                    [
                      '2. Rules',
                      'Pick camera RAW extensions, file type, rename format, and advanced options.',
                    ],
                    ['3. Review', 'Check the summary, run a dry run, then execute when ready.'],
                    ['4. Results', 'Review output as text or table after a dry run or execution.'],
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
                    <h3 className="text-lg text-white">LightOps</h3>
                    <p>Desktop photo file manager for fast camera-card cleanup.</p>
                  </div>
                </div>
                <p>
                  Author: Bao Le. LightOps is part of the baole.space tool family and uses the
                  LightOps icon set from baole.space.
                </p>
                <p>
                  The app is built with Tauri, Rust, React, and TypeScript. File operations run in
                  Rust; the UI provides a keyboard-friendly workflow and native OS menus.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
