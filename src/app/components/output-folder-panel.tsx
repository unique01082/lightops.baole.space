import { FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OutputFolderPanelProps {
  outputFolder: string;
  onBrowse: () => void;
  onChange: (value: string) => void;
}

export function OutputFolderPanel({ outputFolder, onBrowse, onChange }: OutputFolderPanelProps) {
  const { t } = useTranslation();
  return (
    <div
      className="rounded-2xl p-4 backdrop-blur-lg border"
      style={{
        background: 'var(--glass-bg)',
        borderColor: 'var(--glass-border)',
        boxShadow: '0 8px 32px 0 rgba(139, 92, 246, 0.1)',
      }}
    >
      <div className="mb-3">
        <h2 className="text-white mb-0.5" style={{ fontFamily: 'var(--font-heading)' }}>
          {t('outputFolder.title')}
        </h2>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('outputFolder.subtitle')}
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          name="output-folder"
          autoComplete="off"
          aria-label={t('outputFolder.title')}
          value={outputFolder}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('outputFolder.placeholder')}
          className="flex-1 px-3 py-2 rounded-lg border backdrop-blur-sm text-sm"
          style={{
            background: 'var(--input-background)',
            borderColor: 'var(--glass-border)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          type="button"
          onClick={onBrowse}
          className="px-4 py-2 rounded-lg border flex items-center gap-2 hover:bg-white/5 transition-colors"
          style={{
            borderColor: 'var(--glass-border)',
            color: 'var(--text-secondary)',
          }}
        >
          <FolderOpen className="w-4 h-4" />
          <span className="text-sm">{t('outputFolder.browse')}</span>
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>📁</span>
        <span>{t('outputFolder.hint')}</span>
      </div>
    </div>
  );
}
