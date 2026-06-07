import { AlertTriangle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AdvancedOptionsPanelProps {
  collapsible?: boolean;
  recursiveScan: boolean;
  fileOperation: 'copy' | 'move';
  organizeByDate: boolean;
  onlyPaired: boolean;
  includeVideo: boolean;
  onRecursiveScanChange: (value: boolean) => void;
  onFileOperationChange: (value: 'copy' | 'move') => void;
  onOrganizeByDateChange: (value: boolean) => void;
  onOnlyPairedChange: (value: boolean) => void;
  onIncludeVideoChange: (value: boolean) => void;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
      style={{
        background: checked ? 'var(--accent)' : 'var(--switch-background)',
      }}
    >
      <span
        className="absolute top-1 h-4 w-4 rounded-full bg-white transition-transform duration-200"
        style={{ transform: `translateX(${checked ? 20 : 2}px)` }}
      />
    </button>
  );
}

export function AdvancedOptionsPanel({
  collapsible = false,
  recursiveScan,
  fileOperation,
  organizeByDate,
  onlyPaired,
  includeVideo,
  onRecursiveScanChange,
  onFileOperationChange,
  onOrganizeByDateChange,
  onOnlyPairedChange,
  onIncludeVideoChange,
}: AdvancedOptionsPanelProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(!collapsible);
  const summary = [
    recursiveScan ? t('advanced.recursive') : t('advanced.topLevelOnly'),
    t(`advanced.${fileOperation}`),
    organizeByDate ? t('advanced.dateFoldersOn') : t('advanced.dateFoldersOff'),
    onlyPaired ? t('advanced.pairedOnly') : t('advanced.singlesAllowed'),
    includeVideo ? t('advanced.videosOn') : t('advanced.videosOff'),
  ].join(' · ');

  return (
    <div
      className="rounded-2xl backdrop-blur-lg border"
      style={{
        background: 'var(--glass-bg)',
        borderColor: 'var(--glass-border)',
        boxShadow: '0 8px 32px 0 rgba(139, 92, 246, 0.1)',
      }}
    >
      <button
        type="button"
        onClick={() => collapsible && setIsOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left"
        style={{ borderColor: 'var(--glass-divider)' }}
      >
        <div className="min-w-0">
          <h2 className="text-white" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('advanced.title')}
          </h2>
          {collapsible && !isOpen && (
            <p className="mt-1 truncate text-xs" style={{ color: 'var(--text-muted)' }}>
              {summary}
            </p>
          )}
        </div>
        {collapsible && (
          <ChevronDown
            className="h-4 w-4 shrink-0 transition-transform"
            style={{
              color: 'var(--text-muted)',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        )}
      </button>

      {isOpen && (
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm" style={{ color: 'var(--text-primary)' }}>
              {t('advanced.recursive')}
            </label>
            <Toggle checked={recursiveScan} onChange={onRecursiveScanChange} />
          </div>

          <div>
            <label className="block text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
              {t('advanced.fileOp')}
            </label>
            <div className="flex gap-2">
              {(['copy', 'move'] as const).map((op) => (
                <button
                  key={op}
                  onClick={() => onFileOperationChange(op)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm transition-all"
                  style={{
                    background:
                      fileOperation === op ? 'var(--accent-lightops)' : 'var(--input-background)',
                    color: fileOperation === op ? 'white' : 'var(--text-secondary)',
                    border: fileOperation === op ? 'none' : '1px solid var(--glass-border)',
                  }}
                >
                  {t(`advanced.${op}`)}
                </button>
              ))}
            </div>
            {fileOperation === 'move' && (
              <div
                className="flex items-center gap-1.5 mt-2 text-xs"
                style={{ color: 'var(--log-warn)' }}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>{t('advanced.moveWarning')}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm mr-4" style={{ color: 'var(--text-primary)' }}>
              {t('advanced.organizeByDate')}
            </label>
            <Toggle checked={organizeByDate} onChange={onOrganizeByDateChange} />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm mr-4" style={{ color: 'var(--text-primary)' }}>
              {t('advanced.onlyPaired')}
            </label>
            <Toggle checked={onlyPaired} onChange={onOnlyPairedChange} />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm mr-4" style={{ color: 'var(--text-primary)' }}>
              {t('advanced.includeVideo')}
            </label>
            <Toggle checked={includeVideo} onChange={onIncludeVideoChange} />
          </div>
        </div>
      )}
    </div>
  );
}
