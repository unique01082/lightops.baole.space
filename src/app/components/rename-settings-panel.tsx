import { ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface RenameSettingsPanelProps {
  prefix: string;
  format: string;
  startNumber: number;
  onPrefixChange: (value: string) => void;
  onFormatChange: (value: string) => void;
  onStartNumberChange: (value: number) => void;
}

const FORMAT_OPTIONS = [
  { value: 'NNNN', label: 'NNNN only (no date/time)' },
  { value: 'YYYYMMDD_NNNN', label: 'YYYYMMDD_NNNN (date only)' },
  { value: 'YYYYMMDD_HHMMSS_NNNN', label: 'YYYYMMDD_HHMMSS_NNNN' },
  { value: 'YYYY-MM-DD_HH-MM-SS_NNNN', label: 'YYYY-MM-DD_HH-MM-SS_NNNN' },
];

export function RenameSettingsPanel({
  prefix,
  format,
  startNumber,
  onPrefixChange,
  onFormatChange,
  onStartNumberChange,
}: RenameSettingsPanelProps) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState('');
  const [shouldHighlight, setShouldHighlight] = useState(false);

  useEffect(() => {
    let filename = prefix;
    const num = String(startNumber).padStart(4, '0');
    switch (format) {
      case 'YYYYMMDD_HHMMSS_NNNN':
        filename += '20240315_143022_' + num;
        break;
      case 'YYYY-MM-DD_HH-MM-SS_NNNN':
        filename += '2024-03-15_14-30-22_' + num;
        break;
      case 'YYYYMMDD_NNNN':
        filename += '20240315_' + num;
        break;
      case 'NNNN':
        filename += num;
        break;
    }
    filename += '.nef';
    setPreview(filename);
    setShouldHighlight(true);
    const timer = setTimeout(() => setShouldHighlight(false), 300);
    return () => clearTimeout(timer);
  }, [prefix, format, startNumber]);

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
        <h2 className="text-white" style={{ fontFamily: 'var(--font-heading)' }}>
          {t('renameSettings.title')}
        </h2>
      </div>

      <div className="space-y-2.5">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
            {t('renameSettings.prefix')}
          </label>
          <input
            type="text"
            value={prefix}
            onChange={(e) => onPrefixChange(e.target.value)}
            placeholder={t('renameSettings.prefixPlaceholder')}
            className="w-full px-3 py-2 rounded-lg border backdrop-blur-sm text-sm"
            style={{
              background: 'var(--input-background)',
              borderColor: 'var(--glass-border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
            {t('renameSettings.format')}
          </label>
          <div className="relative">
            <select
              value={format}
              onChange={(e) => onFormatChange(e.target.value)}
              className="w-full px-3 py-2 pr-8 rounded-lg border backdrop-blur-sm text-sm appearance-none cursor-pointer"
              style={{
                background: 'var(--input-background)',
                borderColor: 'var(--glass-border)',
                color: 'var(--text-primary)',
              }}
            >
              {FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#1a1535]">
                  {t(`renameSettings.patterns.${option.value}`)}
                </option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
            {t('renameSettings.startNumber')}
          </label>
          <input
            type="number"
            value={startNumber}
            onChange={(e) =>
              onStartNumberChange(Math.max(1, Math.min(99999, parseInt(e.target.value) || 1)))
            }
            min="1"
            max="99999"
            className="w-full px-3 py-2 rounded-lg border backdrop-blur-sm text-sm"
            style={{
              background: 'var(--input-background)',
              borderColor: 'var(--glass-border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
            {t('renameSettings.preview')}
          </label>
          <motion.div
            animate={{
              backgroundColor: shouldHighlight
                ? 'rgba(139, 92, 246, 0.2)'
                : 'rgba(255, 255, 255, 0.05)',
            }}
            transition={{ duration: 0.3 }}
            className="px-3 py-2 rounded-full border text-sm"
            style={{
              borderColor: 'var(--glass-border)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent)',
            }}
          >
            {preview}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
