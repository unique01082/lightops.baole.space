import { Play, Search, Square } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

interface ActionButtonsProps {
  isProcessing: boolean;
  onRun: () => void;
  onDryRun: () => void;
  onStop: () => void;
  showStop?: boolean;
}

export function ActionButtons({
  isProcessing,
  onRun,
  onDryRun,
  onStop,
  showStop = true,
}: ActionButtonsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-2">
      <button
        onClick={onDryRun}
        disabled={isProcessing}
        className="flex-1 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 border transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5"
        style={{
          borderColor: 'rgba(139, 92, 246, 0.6)',
          color: isProcessing ? 'var(--text-muted)' : '#8b5cf6',
        }}
      >
        <Search className="w-4 h-4" />
        <span className="font-semibold">{t('actions.dryRun')}</span>
      </button>
      <button
        onClick={onRun}
        disabled={isProcessing}
        className="flex-1 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] hover:shadow-lg disabled:hover:scale-100"
        style={{
          background: isProcessing ? 'var(--muted)' : 'var(--accent-lightops)',
          color: 'white',
          boxShadow: isProcessing ? 'none' : '0 8px 24px rgba(139, 92, 246, 0.3)',
        }}
      >
        <Play className="w-4 h-4" fill="currentColor" />
        <span className="font-semibold">{t('actions.run')}</span>
      </button>
      {showStop && (
        <motion.button
          onClick={onStop}
          disabled={!isProcessing}
          animate={
            isProcessing
              ? {
                  boxShadow: [
                    '0 0 0 0 rgba(245, 87, 108, 0.4)',
                    '0 0 0 8px rgba(245, 87, 108, 0)',
                    '0 0 0 0 rgba(245, 87, 108, 0)',
                  ],
                }
              : {}
          }
          transition={{ duration: 1.5, repeat: Infinity }}
          className="px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: isProcessing ? 'rgba(245, 87, 108, 0.8)' : 'rgba(245, 87, 108, 0.1)',
            color: isProcessing ? 'white' : 'var(--text-muted)',
          }}
        >
          <Square className="w-4 h-4" fill="currentColor" />
          <span className="font-semibold">{t('actions.stop')}</span>
        </motion.button>
      )}
    </div>
  );
}
