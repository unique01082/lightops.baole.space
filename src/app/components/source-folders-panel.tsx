import { FolderOpen, Plus, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

interface SourceFoldersPanelProps {
  folders: string[];
  onAddFolder: () => void;
  onRemoveFolder: (index: number) => void;
}

export function SourceFoldersPanel({
  folders,
  onAddFolder,
  onRemoveFolder,
}: SourceFoldersPanelProps) {
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
          {t('sourceFolders.title')}
        </h2>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('sourceFolders.subtitle')}
        </p>
      </div>

      <div className="space-y-2 mb-3">
        {folders.length === 0 ? (
          <button
            type="button"
            role="button"
            tabIndex={0}
            aria-label={t('sourceFolders.empty')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onAddFolder();
              }
            }}
            className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-violet-500/50 transition-colors"
            style={{ borderColor: 'var(--glass-border)' }}
            onClick={onAddFolder}
          >
            <Plus className="w-5 h-5 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <span className="block text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('sourceFolders.empty')}
            </span>
          </button>
        ) : (
          folders.map((folder, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 p-2 rounded-lg group hover:bg-white/5"
            >
              <FolderOpen
                className="w-4 h-4 flex-shrink-0"
                style={{ color: 'var(--text-secondary)' }}
              />
              <span
                className="flex-1 text-sm truncate"
                style={{ color: 'var(--text-primary)' }}
                title={folder}
              >
                {folder}
              </span>
              <button
                type="button"
                onClick={() => onRemoveFolder(index)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20"
                aria-label={t('sourceFolders.removeTooltip')}
              >
                <X className="w-3 h-3 text-red-400" />
              </button>
            </motion.div>
          ))
        )}
      </div>

      {folders.length > 0 && (
        <button
          type="button"
          onClick={onAddFolder}
          className="w-full py-2 rounded-lg border flex items-center justify-center gap-2 hover:bg-white/5 transition-colors"
          style={{
            borderColor: 'var(--glass-border)',
            color: 'var(--text-secondary)',
          }}
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">{t('sourceFolders.addButton')}</span>
        </button>
      )}
    </div>
  );
}
