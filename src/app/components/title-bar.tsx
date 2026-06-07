import { getCurrentWindow } from '@tauri-apps/api/window';
import { Aperture, Bell, Minus, Settings, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface UpdateInfo {
  available: boolean;
  version?: string;
}

interface TitleBarProps {
  onSettingsClick: () => void;
  updateInfo?: UpdateInfo | null;
  language: string;
  onLanguageChange: (lang: string) => void;
}

export function TitleBar({
  onSettingsClick,
  updateInfo,
  language,
  onLanguageChange,
}: TitleBarProps) {
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized);
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between px-6 py-3 border-b select-none"
      style={{
        background: 'var(--titlebar-bg)',
        borderColor: 'var(--glass-border)',
      }}
    >
      <div className="flex items-center gap-3" data-tauri-drag-region>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-500">
          <Aperture className="w-4 h-4 text-white" />
        </div>
        <div className="flex items-center gap-3" data-tauri-drag-region>
          <h1 className="text-white" style={{ fontFamily: 'var(--font-heading)' }}>
            LightOps
          </h1>
          <span className="text-xs opacity-45" style={{ color: 'var(--text-muted)' }}>
            {t('titleBar.subtitle')}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {updateInfo?.available && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
            style={{
              background: 'rgba(102, 126, 234, 0.15)',
              border: '1px solid rgba(102, 126, 234, 0.3)',
              color: '#667eea',
            }}
          >
            <Bell className="w-3 h-3" />
            <span>{t('titleBar.updateAvailable', { version: updateInfo.version })}</span>
          </div>
        )}
        {/* Language toggle */}
        <div
          className="flex items-center gap-0.5 rounded-lg p-1"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          {(['en', 'vi'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => onLanguageChange(lang)}
              className="px-2.5 py-1 rounded text-xs font-medium transition-all"
              style={{
                background: language === lang ? 'var(--accent-lightops)' : 'transparent',
                color: language === lang ? 'white' : 'var(--text-secondary)',
              }}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          aria-label={t('titleBar.settings')}
        >
          <Settings className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => appWindow.minimize()}
            className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/10 transition-colors"
            aria-label={t('titleBar.minimize')}
          >
            <Minus className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button
            onClick={() => appWindow.toggleMaximize()}
            className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/10 transition-colors"
            aria-label={isMaximized ? t('titleBar.restore') : t('titleBar.maximize')}
          >
            <Square className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button
            onClick={() => appWindow.close()}
            className="w-7 h-7 rounded flex items-center justify-center hover:bg-red-500/70 transition-colors group"
            aria-label={t('titleBar.close')}
          >
            <X
              className="w-3.5 h-3.5 group-hover:text-white transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
