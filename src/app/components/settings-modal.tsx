import { motion, AnimatePresence } from 'motion/react';
import { X, Globe, Settings as SettingsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCamera: string;
  defaultFileOperation: 'copy' | 'move';
  defaultRecursiveScan: boolean;
  defaultOrganizeByDate: boolean;
  language: string;
  onDefaultCameraChange: (value: string) => void;
  onDefaultFileOperationChange: (value: 'copy' | 'move') => void;
  onDefaultRecursiveScanChange: (value: boolean) => void;
  onDefaultOrganizeByDateChange: (value: boolean) => void;
  onLanguageChange: (value: string) => void;
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'vi', name: 'Tiếng Việt' },
];

const CAMERA_OPTIONS = [
  { value: 'nikon', label: 'Nikon (.nef, .nrw)' },
  { value: 'canon', label: 'Canon (.cr2, .cr3)' },
  { value: 'sony', label: 'Sony (.arw)' },
  { value: 'fujifilm', label: 'Fujifilm (.raf)' },
  { value: 'panasonic', label: 'Panasonic (.rw2)' },
  { value: 'olympus', label: 'Olympus (.orf)' },
  { value: 'pentax', label: 'Pentax (.pef, .dng)' },
  { value: 'leica', label: 'Leica (.dng)' },
];

export function SettingsModal({
  isOpen, onClose,
  defaultCamera, defaultFileOperation, defaultRecursiveScan, defaultOrganizeByDate, language,
  onDefaultCameraChange, onDefaultFileOperationChange, onDefaultRecursiveScanChange,
  onDefaultOrganizeByDateChange, onLanguageChange
}: SettingsModalProps) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="w-full max-w-lg rounded-3xl border backdrop-blur-xl shadow-2xl"
              style={{ background: 'rgba(15, 12, 41, 0.95)', borderColor: 'var(--glass-border)', boxShadow: '0 24px 64px 0 rgba(139, 92, 246, 0.2)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--glass-divider)' }}>
                <div className="flex items-center gap-3">
                  <SettingsIcon className="w-5 h-5" style={{ color: '#8b5cf6' }} />
                  <div>
                    <h2 className="text-xl text-white" style={{ fontFamily: 'var(--font-heading)' }}>{t('settings.title')}</h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('settings.subtitle')}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                    <h3 className="text-sm font-semibold text-white" style={{ fontFamily: 'var(--font-heading)' }}>{t('settings.language')}</h3>
                  </div>
                  <div className="flex gap-2">
                    {LANGUAGES.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => onLanguageChange(lang.code)}
                        className="flex-1 px-4 py-2.5 rounded-lg border transition-all text-sm"
                        style={{
                          background: language === lang.code ? 'var(--accent-lightops)' : 'transparent',
                          borderColor: language === lang.code ? 'transparent' : 'var(--glass-border)',
                          color: language === lang.code ? 'white' : 'var(--text-secondary)'
                        }}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px" style={{ background: 'var(--glass-divider)' }} />

                <div>
                  <h3 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: 'var(--font-heading)' }}>{t('settings.defaults')}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('settings.defaultCamera')}</label>
                      <select
                        value={defaultCamera}
                        onChange={(e) => onDefaultCameraChange(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                        style={{ background: 'var(--input-background)', borderColor: 'var(--glass-border)', color: 'var(--text-primary)' }}
                      >
                        {CAMERA_OPTIONS.map(o => (
                          <option key={o.value} value={o.value} className="bg-[#1a1535]">{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('settings.defaultFileOp')}</label>
                      <div className="flex gap-2">
                        {(['copy', 'move'] as const).map(op => (
                          <button
                            key={op}
                            onClick={() => onDefaultFileOperationChange(op)}
                            className="flex-1 px-3 py-2 rounded-lg text-sm capitalize transition-all"
                            style={{
                              background: defaultFileOperation === op ? 'var(--accent-lightops)' : 'transparent',
                              border: '1px solid',
                              borderColor: defaultFileOperation === op ? 'transparent' : 'var(--glass-border)',
                              color: defaultFileOperation === op ? 'white' : 'var(--text-secondary)'
                            }}
                          >{t(`settings.operation${op.charAt(0).toUpperCase() + op.slice(1)}`)}</button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <label className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('settings.defaultRecursive')}</label>
                      <button
                        onClick={() => onDefaultRecursiveScanChange(!defaultRecursiveScan)}
                        className="relative w-11 h-6 rounded-full flex-shrink-0"
                        style={{ background: defaultRecursiveScan ? 'var(--accent)' : 'var(--switch-background)' }}
                      >
                        <motion.div
                          animate={{ x: defaultRecursiveScan ? 20 : 2 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className="absolute top-1 w-4 h-4 bg-white rounded-full"
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <label className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('settings.defaultOrganize')}</label>
                      <button
                        onClick={() => onDefaultOrganizeByDateChange(!defaultOrganizeByDate)}
                        className="relative w-11 h-6 rounded-full flex-shrink-0"
                        style={{ background: defaultOrganizeByDate ? 'var(--accent)' : 'var(--switch-background)' }}
                      >
                        <motion.div
                          animate={{ x: defaultOrganizeByDate ? 20 : 2 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className="absolute top-1 w-4 h-4 bg-white rounded-full"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t flex justify-end" style={{ borderColor: 'var(--glass-divider)' }}>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-lg text-white transition-all"
                  style={{ background: 'var(--accent-lightops)' }}
                >
                  {t('settings.done')}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
