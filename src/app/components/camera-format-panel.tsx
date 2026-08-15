import { Camera, FileStack } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SourceMetadata } from './workflow-steps';

interface CameraFormatPanelProps {
  metadata: SourceMetadata[];
  rawExtensions: string;
  fileType: 'both' | 'jpg' | 'raw';
  allowedFileTypes?: Array<'both' | 'jpg' | 'raw'>;
  onFileTypeChange: (value: 'both' | 'jpg' | 'raw') => void;
}

function cameraName(item: SourceMetadata, unknownCamera: string) {
  return [item.camera_make, item.camera_model].filter(Boolean).join(' ') || unknownCamera;
}

export function CameraFormatPanel({
  metadata,
  rawExtensions,
  fileType,
  allowedFileTypes = ['both', 'jpg', 'raw'],
  onFileTypeChange,
}: CameraFormatPanelProps) {
  const { t } = useTranslation();
  const unknownCamera = t('shared.unknownCamera');
  const totalJpg = metadata.reduce((sum, item) => sum + item.jpg_count, 0);
  const totalRaw = metadata.reduce((sum, item) => sum + item.raw_count, 0);
  const totalVideo = metadata.reduce((sum, item) => sum + item.video_count, 0);

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
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <h2 className="text-white" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('cameraFormat.detectedTitle')}
          </h2>
        </div>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('cameraFormat.description')}
        </p>
      </div>

      <div className="space-y-3">
        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-xl border p-3" style={{ borderColor: 'var(--glass-border)' }}>
            <p
              className="text-xs uppercase tracking-[0.2em]"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('cameraFormat.stats.jpg')}
            </p>
            <p className="mt-1 text-lg text-white">{totalJpg}</p>
          </div>
          <div className="rounded-xl border p-3" style={{ borderColor: 'var(--glass-border)' }}>
            <p
              className="text-xs uppercase tracking-[0.2em]"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('cameraFormat.stats.raw')}
            </p>
            <p className="mt-1 text-lg text-white">{totalRaw}</p>
          </div>
          <div className="rounded-xl border p-3" style={{ borderColor: 'var(--glass-border)' }}>
            <p
              className="text-xs uppercase tracking-[0.2em]"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('cameraFormat.stats.video')}
            </p>
            <p className="mt-1 text-lg text-white">{totalVideo}</p>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <FileStack className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('cameraFormat.rawExtensionsLabel')}{' '}
              {rawExtensions || t('cameraFormat.noneDetected')}
            </span>
          </div>
          <div className="grid gap-2">
            {metadata.map((item) => (
              <div
                key={item.folder}
                className="rounded-xl border px-3 py-2"
                style={{ borderColor: 'var(--glass-border)', background: 'rgba(255,255,255,0.04)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p
                    className="truncate text-sm text-white"
                    title={cameraName(item, unknownCamera)}
                  >
                    {cameraName(item, unknownCamera)}
                  </p>
                  <p className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {item.raw_extensions.join(' ') || t('cameraFormat.jpgOnly')}
                  </p>
                </div>
                <p
                  className="mt-1 truncate text-xs"
                  title={item.folder}
                  style={{ color: 'var(--text-muted)' }}
                >
                  {item.folder}
                </p>
              </div>
            ))}
          </div>
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
                disabled={!allowedFileTypes.includes(option.value)}
                onClick={() => onFileTypeChange(option.value)}
                className="flex-1 px-3 py-2 rounded-full text-xs transition-all disabled:cursor-not-allowed disabled:opacity-35"
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
