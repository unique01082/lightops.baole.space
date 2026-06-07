import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CameraFormatPanelProps {
  cameraPreset: string;
  rawExtensions: string;
  fileType: 'both' | 'jpg' | 'raw';
  onCameraChange: (value: string) => void;
  onRawExtensionsChange: (value: string) => void;
  onFileTypeChange: (value: 'both' | 'jpg' | 'raw') => void;
}

const CAMERA_PRESETS = [
  { value: 'nikon', label: 'Nikon', extensions: '.nef .nrw' },
  { value: 'canon', label: 'Canon', extensions: '.cr2 .cr3' },
  { value: 'sony', label: 'Sony', extensions: '.arw' },
  { value: 'fujifilm', label: 'Fujifilm', extensions: '.raf' },
  { value: 'panasonic', label: 'Panasonic', extensions: '.rw2' },
  { value: 'olympus', label: 'Olympus', extensions: '.orf' },
  { value: 'pentax', label: 'Pentax', extensions: '.dng .pef' },
  { value: 'leica', label: 'Leica', extensions: '.dng' },
  { value: 'custom', label: 'Custom', extensions: '' },
];

export function CameraFormatPanel({
  cameraPreset,
  rawExtensions,
  fileType,
  onCameraChange,
  onRawExtensionsChange,
  onFileTypeChange,
}: CameraFormatPanelProps) {
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
        <h2 className="text-white" style={{ fontFamily: 'var(--font-heading)' }}>
          {t('cameraFormat.title')}
        </h2>
      </div>

      <div className="space-y-2.5">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
            {t('cameraFormat.preset')}
          </label>
          <div className="relative">
            <select
              value={cameraPreset}
              onChange={(e) => {
                onCameraChange(e.target.value);
                const preset = CAMERA_PRESETS.find((p) => p.value === e.target.value);
                if (preset && preset.extensions) {
                  onRawExtensionsChange(preset.extensions);
                }
              }}
              className="w-full px-3 py-2 pr-8 rounded-lg border backdrop-blur-sm text-sm appearance-none cursor-pointer"
              style={{
                background: 'var(--input-background)',
                borderColor: 'var(--glass-border)',
                color: 'var(--text-primary)',
              }}
            >
              {CAMERA_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value} className="bg-[#1a1535]">
                  {preset.label}
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
            {t('cameraFormat.rawExtensions')}
          </label>
          <input
            type="text"
            value={rawExtensions}
            onChange={(e) => onRawExtensionsChange(e.target.value)}
            placeholder={t('cameraFormat.rawPlaceholder')}
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
            {t('cameraFormat.fileType')}
          </label>
          <div className="flex gap-2">
            {(
              [
                { value: 'both', key: 'cameraFormat.fileTypes.both' },
                { value: 'jpg', key: 'cameraFormat.fileTypes.jpg' },
                { value: 'raw', key: 'cameraFormat.fileTypes.raw' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                onClick={() => onFileTypeChange(option.value)}
                className="flex-1 px-3 py-2 rounded-full text-xs transition-all"
                style={{
                  background:
                    fileType === option.value
                      ? 'var(--accent-lightops)'
                      : 'var(--input-background)',
                  borderColor: fileType === option.value ? 'transparent' : 'var(--glass-border)',
                  color: fileType === option.value ? 'white' : 'var(--text-secondary)',
                  border: fileType === option.value ? 'none' : '1px solid',
                }}
              >
                {t(option.key)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
