import { open } from '@tauri-apps/plugin-shell';
import { AlignLeft, Camera, Table } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface LogEntry {
  type: 'ok' | 'dry' | 'skip' | 'error' | 'warn' | 'section';
  source?: string;
  destination?: string;
  message?: string;
}

interface LogPanelProps {
  entries: LogEntry[];
  isDryRun: boolean;
  stats: { ok: number; skip: number; error: number };
  onClear: () => void;
}

type ViewMode = 'text' | 'table';
const MAX_RENDERED_LOG_ENTRIES = 1200;

function getParentDir(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return idx > 0 ? filePath.substring(0, idx) : filePath;
}

async function openPath(filePath: string) {
  try {
    await open(getParentDir(filePath));
  } catch {
    // fallback: copy to clipboard
    await navigator.clipboard.writeText(filePath).catch(() => {});
  }
}

export function LogPanel({ entries, isDryRun, stats, onClear }: LogPanelProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);
  const [viewMode, setViewMode] = useState<ViewMode>('text');

  useEffect(() => {
    if (!isUserScrolling.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      isUserScrolling.current = scrollTop + clientHeight < scrollHeight - 50;
    }
  };

  const getEntryColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'ok':
        return 'var(--log-ok)';
      case 'dry':
        return 'var(--log-dry)';
      case 'skip':
        return 'var(--log-skip)';
      case 'error':
        return 'var(--log-error)';
      case 'warn':
        return 'var(--log-warn)';
      default:
        return 'var(--text-primary)';
    }
  };

  const getTag = (type: LogEntry['type']) => {
    switch (type) {
      case 'ok':
        return '[OK]';
      case 'dry':
        return '[DRY]';
      case 'skip':
        return '[SKIP]';
      case 'error':
        return '[ERR]';
      case 'warn':
        return '[WARN]';
      default:
        return '';
    }
  };

  const visibleEntries =
    entries.length > MAX_RENDERED_LOG_ENTRIES
      ? entries.slice(entries.length - MAX_RENDERED_LOG_ENTRIES)
      : entries;
  // Table mode: filter to only rows with source/destination; sections become group headers
  const tableRows = visibleEntries.filter((e) => e.type !== 'section');

  const PathCell = useCallback(({ path }: { path?: string }) => {
    if (!path) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    return (
      <button
        onClick={() => openPath(path)}
        title={t('shared.openFolder', { path })}
        className="text-left w-full truncate hover:underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-80"
        style={{
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          wordBreak: 'break-all',
          whiteSpace: 'normal',
        }}
      >
        {path}
      </button>
    );
  }, [t]);

  return (
    <div
      className="rounded-2xl backdrop-blur-lg border flex flex-col h-full"
      style={{
        background: 'var(--glass-bg)',
        borderColor: 'var(--glass-border)',
        boxShadow: '0 8px 32px 0 rgba(139, 92, 246, 0.1)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b"
        style={{ borderColor: 'var(--glass-divider)' }}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-white" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('log.title')}
          </h2>
          {isDryRun && (
            <span
              className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{
                background: 'rgba(255, 210, 0, 0.1)',
                color: 'var(--log-skip)',
                border: '1px solid rgba(255, 210, 0, 0.3)',
              }}
            >
              {t('log.dryRunBadge')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs">
            <span style={{ color: 'var(--log-ok)' }}>✅ {stats.ok}</span>
            <span style={{ color: 'var(--log-skip)' }}>⚠ {stats.skip}</span>
            <span style={{ color: 'var(--log-error)' }}>❌ {stats.error}</span>
          </div>

          {/* View toggle */}
          <div
            className="flex items-center rounded-lg p-0.5 gap-0.5"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <button
              onClick={() => setViewMode('text')}
              className="p-1.5 rounded transition-all"
              title={t('log.viewText')}
              style={{
                background: viewMode === 'text' ? 'var(--accent-lightops)' : 'transparent',
              }}
            >
              <AlignLeft
                className="w-3.5 h-3.5"
                style={{
                  color: viewMode === 'text' ? 'white' : 'var(--text-secondary)',
                }}
              />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className="p-1.5 rounded transition-all"
              title={t('log.viewTable')}
              style={{
                background: viewMode === 'table' ? 'var(--accent-lightops)' : 'transparent',
              }}
            >
              <Table
                className="w-3.5 h-3.5"
                style={{
                  color: viewMode === 'table' ? 'white' : 'var(--text-secondary)',
                }}
              />
            </button>
          </div>

          <button
            onClick={onClear}
            className="text-xs hover:bg-white/5 px-2 py-1 rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            {t('log.clear')}
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto rounded-b-2xl"
        style={{ background: 'var(--log-bg)' }}
      >
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Camera className="w-12 h-12 mb-3" style={{ color: 'var(--text-muted)' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{t('log.empty')}</p>
          </div>
        ) : viewMode === 'text' ? (
          // ── Text mode ──────────────────────────────────────────────────────
          <div
            className="p-4"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              lineHeight: 1.6,
            }}
          >
            {entries.length > visibleEntries.length && (
              <div className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('log.showingLatest', {
                  visible: visibleEntries.length.toLocaleString(),
                  total: entries.length.toLocaleString(),
                })}
              </div>
            )}
            {visibleEntries.map((entry, index) => (
              <div key={index} className={entry.type === 'section' ? 'mb-2 mt-3' : 'mb-1'}>
                {entry.type === 'section' ? (
                  <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    {entry.message}
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      <span
                        className="font-medium flex-shrink-0"
                        style={{ color: getEntryColor(entry.type) }}
                      >
                        {getTag(entry.type)}
                      </span>
                      <span
                        className={entry.type === 'dry' ? 'opacity-60' : ''}
                        style={{
                          color:
                            entry.type === 'error' ? 'var(--log-error)' : 'var(--text-primary)',
                          wordBreak: 'break-all',
                        }}
                      >
                        {entry.source ?? entry.message}
                      </span>
                    </div>
                    {entry.destination && (
                      <div
                        className={`pl-12 ${entry.type === 'dry' ? 'opacity-60' : 'opacity-70'}`}
                        style={{
                          color: 'var(--text-secondary)',
                          wordBreak: 'break-all',
                        }}
                      >
                        → {entry.destination}
                      </div>
                    )}
                    {entry.message && entry.source && (
                      <div className="pl-12" style={{ color: getEntryColor(entry.type) }}>
                        {entry.message}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          // ── Table mode ─────────────────────────────────────────────────────
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--glass-divider)',
                  position: 'sticky',
                  top: 0,
                  background: 'var(--log-bg)',
                  zIndex: 1,
                }}
              >
                <th
                  className="w-8 px-3 py-2 text-left"
                  style={{
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 500,
                    fontSize: '0.65rem',
                  }}
                >
                  {t('log.tableStatus')}
                </th>
                <th
                  className="px-3 py-2 text-left"
                  style={{
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 500,
                    fontSize: '0.65rem',
                  }}
                >
                  {t('log.tableSource')}
                </th>
                <th
                  className="px-3 py-2 text-left"
                  style={{
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 500,
                    fontSize: '0.65rem',
                  }}
                >
                  {t('log.tableDestination')}
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((entry, index) => {
                if (entry.type === 'warn') {
                  return (
                    <tr
                      key={index}
                      style={{
                        borderBottom: '1px solid var(--glass-divider)',
                      }}
                    >
                      <td
                        colSpan={3}
                        className="px-3 py-1.5"
                        style={{
                          color: 'var(--log-warn)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.7rem',
                        }}
                      >
                        ⚠ {entry.message}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={index}
                    className="group"
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Status badge */}
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span
                        className="px-1.5 py-0.5 rounded text-xs font-medium"
                        style={{
                          color: getEntryColor(entry.type),
                          background: `${getEntryColor(entry.type)}18`,
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.62rem',
                        }}
                      >
                        {getTag(entry.type).replace('[', '').replace(']', '')}
                      </span>
                    </td>
                    {/* Source */}
                    <td className="px-3 py-1.5 max-w-xs">
                      <PathCell path={entry.source} />
                      {entry.message && entry.source && (
                        <div
                          className="mt-0.5"
                          style={{
                            color: getEntryColor(entry.type),
                            fontSize: '0.65rem',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {entry.message}
                        </div>
                      )}
                      {!entry.source && entry.message && (
                        <span
                          style={{
                            color: getEntryColor(entry.type),
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.7rem',
                          }}
                        >
                          {entry.message}
                        </span>
                      )}
                    </td>
                    {/* Destination */}
                    <td className="px-3 py-1.5 max-w-xs">
                      <PathCell path={entry.destination} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
