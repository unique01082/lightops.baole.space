import { invoke } from '@tauri-apps/api/core';
import { BookMarked, Check, ChevronDown, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface Preset {
  name: string;
  camera_preset: string;
  raw_extensions: string;
  file_type: 'both' | 'jpg' | 'raw';
  prefix: string;
  fmt_pattern: string | null;
  start_num: number;
  file_op: 'copy' | 'move';
  recursive: boolean;
  organize_by_date: boolean;
  only_paired: boolean;
  include_video: boolean;
}

interface PresetPanelProps {
  currentSettings: Omit<Preset, 'name'>;
  onApply: (preset: Preset) => void;
  saveRequestedToken?: number;
}

export function PresetPanel({
  currentSettings,
  onApply,
  saveRequestedToken = 0,
}: PresetPanelProps) {
  const { t } = useTranslation();
  const [presetNames, setPresetNames] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const names = await invoke<string[]>('list_presets');
      setPresetNames(names);
    } catch {
      // silently ignore if no presets dir yet
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveRequestedToken === 0) return;
    setSaveDialogOpen(true);
    setSaveName(selected || '');
  }, [saveRequestedToken, selected]);

  const handleApply = async () => {
    if (!selected) return;
    setApplying(true);
    try {
      const preset = await invoke<Preset>('load_preset', { name: selected });
      onApply(preset);
    } catch (e) {
      console.error('Failed to load preset:', e);
    } finally {
      setApplying(false);
    }
  };

  const handleSave = async () => {
    const name = saveName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const preset: Preset = { name, ...currentSettings };
      await invoke('save_preset', { preset });
      await refresh();
      setSelected(name);
      setSaveDialogOpen(false);
      setSaveName('');
    } catch (e) {
      console.error('Failed to save preset:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      await invoke('delete_preset', { name: selected });
      setSelected('');
      await refresh();
    } catch (e) {
      console.error('Failed to delete preset:', e);
    }
  };

  return (
    <div
      className="rounded-2xl p-4 backdrop-blur-lg border"
      style={{
        background: 'var(--glass-bg)',
        borderColor: 'var(--glass-border)',
        boxShadow: '0 8px 32px 0 rgba(139, 92, 246, 0.1)',
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookMarked className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <h2 className="text-white" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('presets.title')}
          </h2>
        </div>
        <button
          onClick={() => {
            setSaveDialogOpen(true);
            setSaveName(selected || '');
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
          style={{
            background: 'var(--input-background)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-secondary)',
          }}
          title={t('presets.saveTooltip')}
        >
          <Save className="w-3 h-3" />
          {t('presets.save')}
        </button>
      </div>

      {saveDialogOpen && (
        <div className="mb-3 flex gap-2">
          <input
            autoFocus
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') setSaveDialogOpen(false);
            }}
            placeholder={t('presets.namePlaceholder')}
            className="flex-1 px-3 py-2 rounded-lg border text-sm"
            style={{
              background: 'var(--input-background)',
              borderColor: 'var(--glass-border)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={handleSave}
            disabled={saving || !saveName.trim()}
            className="px-3 py-2 rounded-lg text-xs transition-all"
            style={{
              background: 'var(--accent-lightops)',
              color: 'white',
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      )}

      {presetNames.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('presets.empty')}
        </p>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full px-3 py-2 pr-8 rounded-lg border text-sm appearance-none"
              style={{
                background: 'var(--input-background)',
                borderColor: 'var(--glass-border)',
                color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              <option value="" className="bg-[#1a1535]">
                {t('presets.selectPlaceholder')}
              </option>
              {presetNames.map((name) => (
                <option key={name} value={name} className="bg-[#1a1535]">
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
          </div>

          <button
            onClick={handleApply}
            disabled={!selected || applying}
            className="px-3 py-2 rounded-lg text-xs transition-all"
            style={{
              background: selected ? 'var(--accent-lightops)' : 'var(--input-background)',
              color: selected ? 'white' : 'var(--text-muted)',
              border: selected ? 'none' : '1px solid var(--glass-border)',
              opacity: applying ? 0.6 : 1,
            }}
          >
            {t('presets.apply')}
          </button>

          <button
            onClick={handleDelete}
            disabled={!selected}
            className="px-3 py-2 rounded-lg text-xs transition-all"
            style={{
              background: 'var(--input-background)',
              border: '1px solid var(--glass-border)',
              color: selected ? 'var(--log-error)' : 'var(--text-muted)',
            }}
            title={t('presets.deleteTooltip')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
