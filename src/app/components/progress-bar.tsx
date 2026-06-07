interface ProgressBarProps {
  current: number;
  total: number;
  status: 'idle' | 'processing' | 'complete' | 'stopped' | 'error';
}

export function ProgressBar({ current, total, status }: ProgressBarProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  const getGradient = () => {
    switch (status) {
      case 'complete':
        return 'var(--accent-success)';
      case 'stopped':
        return 'var(--accent-warning)';
      case 'error':
        return 'var(--accent-danger)';
      case 'processing':
        return 'var(--accent-lightops)';
      default:
        return 'transparent';
    }
  };

  return (
    <div className="h-2 relative overflow-hidden" style={{ background: 'rgba(0, 0, 0, 0.2)' }}>
      <div
        className="h-full relative transition-[width] duration-200 ease-out"
        style={{ background: getGradient(), width: `${percentage}%` }}
      >
        {status === 'processing' && (
          <div
            className="absolute inset-0 progress-stripes"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
            }}
          />
        )}
      </div>
      {total > 0 && (
        <div
          className="absolute inset-0 flex items-center justify-center text-xs font-medium"
          style={{ color: 'var(--text-primary)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
        >
          {current.toLocaleString()} / {total.toLocaleString()} files
        </div>
      )}
    </div>
  );
}
