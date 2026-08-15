import { Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  deleteToolPreset,
  listToolPresets,
  upsertToolPreset,
  type ToolPreset,
} from '../../lib/local-store-client';

type PresetBarProps = {
  toolId: string;
  payload: unknown;
  onApply: (payload: unknown) => void;
};

export function PresetBar({ toolId, payload, onApply }: PresetBarProps) {
  const { t } = useTranslation();
  const [presets, setPresets] = useState<ToolPreset[]>([]);
  const [name, setName] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const refresh = () => void listToolPresets(toolId).then(setPresets);
  useEffect(() => {
    void listToolPresets(toolId).then(setPresets);
  }, [toolId]);

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const existing = presets.find((preset) => preset.name === trimmedName);
    await upsertToolPreset({
      id: existing?.id ?? crypto.randomUUID(),
      toolId,
      name: trimmedName,
      payload,
      updatedAt: new Date().toISOString(),
    });
    setName('');
    refresh();
  };

  const remove = async () => {
    if (!selectedId) return;
    await deleteToolPreset(selectedId);
    setSelectedId('');
    refresh();
  };

  return (
    <div className="mb-4 grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <select
        aria-label={t('presets.select')}
        value={selectedId}
        onChange={(event) => {
          const id = event.target.value;
          setSelectedId(id);
          const preset = presets.find((item) => item.id === id);
          if (preset) onApply(preset.payload);
        }}
        className="rounded-lg border border-white/10 bg-[#24223d] px-3 py-2 text-sm"
      >
        <option value="">{t('presets.select')}</option>
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => void remove()}
        disabled={!selectedId}
        aria-label={t('presets.delete')}
        className="rounded-lg border border-white/10 p-2 disabled:opacity-30"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t('presets.name')}
        aria-label={t('presets.name')}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
      />
      <button
        type="button"
        onClick={() => void save()}
        disabled={!name.trim()}
        aria-label={t('presets.save')}
        className="rounded-lg bg-violet-700 p-2 disabled:opacity-30"
      >
        <Save className="h-4 w-4" />
      </button>
    </div>
  );
}
