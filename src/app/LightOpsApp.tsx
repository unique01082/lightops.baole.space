import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { listUserSettings } from '../lib/local-store-client';
import { ToolboxShell } from './toolbox/toolbox-shell';

const IngestRenameApp = lazy(() => import('./App'));
const AdvancedWorkspace = lazy(() =>
  import('./tools/advanced-workspace').then((module) => ({ default: module.AdvancedWorkspace })),
);
const UtilityWorkspace = lazy(() =>
  import('./tools/utility-workspace').then((module) => ({ default: module.UtilityWorkspace })),
);

export default function LightOpsApp() {
  const { i18n, t } = useTranslation();

  useEffect(() => {
    void listUserSettings().then((settings) => {
      if (settings.language === 'en' || settings.language === 'vi') {
        void i18n.changeLanguage(settings.language);
      }
    });
  }, [i18n]);

  const loading = (
    <div className="grid h-full place-items-center text-sm text-white/55" role="status">
      {t('utilities.processing')}
    </div>
  );

  return (
    <ToolboxShell
      renderIngest={() => (
        <Suspense fallback={loading}>
          <IngestRenameApp />
        </Suspense>
      )}
      renderTool={(toolId, onBack) => {
        if (toolId === 'resize' || toolId === 'minimize') {
          return (
            <Suspense fallback={loading}>
              <UtilityWorkspace toolId={toolId} onBack={onBack} />
            </Suspense>
          );
        }
        return (
          <Suspense fallback={loading}>
            <AdvancedWorkspace toolId={toolId} onBack={onBack} />
          </Suspense>
        );
      }}
    />
  );
}
