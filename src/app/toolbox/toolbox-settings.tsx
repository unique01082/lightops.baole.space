import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { setUserSetting } from '../../lib/local-store-client';

type ToolboxSettingsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAfterClose: () => void;
};

export function ToolboxSettings({ open, onOpenChange, onAfterClose }: ToolboxSettingsProps) {
  const { t, i18n } = useTranslation();

  const changeLanguage = async (language: 'en' | 'vi') => {
    await i18n.changeLanguage(language);
    await setUserSetting('language', language);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onAfterClose();
          }}
          className="fixed left-1/2 top-1/2 z-[71] w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-[#17151f] p-6 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-heading text-xl font-semibold">
                {t('settings.title')}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-white/50">
                {t('settings.localSyncDescription')}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="rounded-lg p-2 text-white/60 hover:bg-white/10"
              aria-label={t('settings.done')}
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <fieldset className="mt-6">
            <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              {t('settings.language')}
            </legend>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(['en', 'vi'] as const).map((language) => (
                <button
                  key={language}
                  type="button"
                  onClick={() => void changeLanguage(language)}
                  aria-pressed={i18n.language.startsWith(language)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold aria-pressed:border-violet-400 aria-pressed:bg-violet-700"
                >
                  {language === 'en' ? 'English' : 'Tiếng Việt'}
                </button>
              ))}
            </div>
          </fieldset>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
