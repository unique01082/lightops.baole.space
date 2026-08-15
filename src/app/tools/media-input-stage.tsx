import { FolderOpen, ImagePlus, Images, Trash2, X } from 'lucide-react';
import type { DragEvent } from 'react';
import { useTranslation } from 'react-i18next';

type MediaInputStageProps = {
  paths: string[];
  selectedPaths: Set<string>;
  onSelectedPathsChange: (paths: Set<string>) => void;
  onAddImages: () => void;
  onAddFolder: () => void;
  onRemove: (paths: Set<string>) => void;
  addImagesLabel?: string;
  addFolderLabel?: string;
  draggable?: boolean;
  onDragPath?: (event: DragEvent, path: string) => void;
  getDragLabel?: (path: string) => string;
};

function basename(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}

function EmptyLightTable({
  onAddImages,
  onAddFolder,
  addImagesLabel,
  addFolderLabel,
}: Pick<
  MediaInputStageProps,
  'onAddImages' | 'onAddFolder' | 'addImagesLabel' | 'addFolderLabel'
>) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="empty-light-table"
      className="relative flex min-h-[18rem] overflow-hidden rounded-2xl border border-dashed border-white/15 bg-black/15"
    >
      <div className="pointer-events-none absolute inset-0 grid grid-cols-4 gap-2 p-3 opacity-40">
        {[0, 1, 2, 3].map((cell) => (
          <div
            key={cell}
            className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.035] to-transparent"
          />
        ))}
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-44 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--tool-accent))] opacity-[0.09] blur-[55px]" />
      <div className="relative m-auto flex max-w-sm flex-col items-center px-6 py-10 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-white/[0.07] shadow-[0_18px_50px_rgba(0,0,0,0.3)]">
          <Images className="h-6 w-6 text-[rgb(var(--tool-glow))]" strokeWidth={1.5} />
        </div>
        <h3 className="mt-4 font-heading text-base font-semibold text-white">
          {t('toolWorkflow.lightTableTitle')}
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-white/42">{t('utilities.empty')}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onAddImages}
            aria-label={addImagesLabel ?? t('utilities.addImages')}
            className="flex items-center gap-2 rounded-xl bg-[rgb(var(--tool-accent))] px-4 py-2.5 text-xs font-bold text-white shadow-[0_10px_30px_rgb(var(--tool-accent)/0.22)] transition-transform duration-200 hover:-translate-y-0.5"
          >
            <ImagePlus className="h-4 w-4" />
            {addImagesLabel ?? t('utilities.addImages')}
          </button>
          <button
            type="button"
            onClick={onAddFolder}
            aria-label={addFolderLabel ?? t('utilities.addFolder')}
            className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-xs font-semibold text-white/72 hover:bg-white/[0.08]"
          >
            <FolderOpen className="h-4 w-4" />
            {addFolderLabel ?? t('utilities.addFolder')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MediaInputStage({
  paths,
  selectedPaths,
  onSelectedPathsChange,
  onAddImages,
  onAddFolder,
  onRemove,
  addImagesLabel,
  addFolderLabel,
  draggable = false,
  onDragPath,
  getDragLabel,
}: MediaInputStageProps) {
  const { t } = useTranslation();
  if (paths.length === 0) {
    return (
      <EmptyLightTable
        onAddImages={onAddImages}
        onAddFolder={onAddFolder}
        addImagesLabel={addImagesLabel}
        addFolderLabel={addFolderLabel}
      />
    );
  }

  const togglePath = (path: string, checked: boolean) => {
    const next = new Set(selectedPaths);
    if (checked) next.add(path);
    else next.delete(path);
    onSelectedPathsChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs text-white/45">
          <span className="font-mono font-semibold text-[rgb(var(--tool-glow))]">
            {paths.length}
          </span>
          <span>{t('toolWorkflow.framesLoaded')}</span>
          {selectedPaths.size > 0 && (
            <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] text-white/60">
              {selectedPaths.size} {t('toolWorkflow.selected')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onAddImages}
            aria-label={addImagesLabel ?? t('utilities.addImages')}
            className="flex items-center gap-1.5 rounded-lg bg-[rgb(var(--tool-accent)/0.16)] px-3 py-2 text-[11px] font-semibold text-[rgb(var(--tool-glow))] hover:bg-[rgb(var(--tool-accent)/0.24)]"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {addImagesLabel ?? t('utilities.addImages')}
          </button>
          <button
            type="button"
            onClick={onAddFolder}
            aria-label={addFolderLabel ?? t('utilities.addFolder')}
            className="grid h-8 w-8 place-items-center rounded-lg text-white/45 hover:bg-white/[0.08] hover:text-white"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
          <span className="mx-1 h-4 w-px bg-white/10" />
          <button
            type="button"
            disabled={selectedPaths.size === 0}
            onClick={() => onRemove(selectedPaths)}
            aria-label={t('utilities.removeSelected')}
            className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-25"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(new Set(paths))}
            aria-label={t('utilities.clear')}
            className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        {paths.map((path, index) => {
          const selected = selectedPaths.has(path);
          return (
            <label
              key={path}
              draggable={draggable}
              aria-label={draggable ? getDragLabel?.(path) : undefined}
              onDragStart={(event) => onDragPath?.(event, path)}
              className="group flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-200"
              style={{
                borderColor: selected ? 'rgb(var(--tool-accent) / 0.5)' : 'rgb(255 255 255 / 0.08)',
                background: selected ? 'rgb(var(--tool-accent) / 0.1)' : 'rgb(255 255 255 / 0.03)',
              }}
            >
              <input
                type="checkbox"
                aria-label={`${t('utilities.selectInput')} ${basename(path)}`}
                checked={selected}
                onChange={(event) => togglePath(path, event.target.checked)}
                className="accent-[rgb(var(--tool-accent))]"
              />
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-black/20 font-mono text-[10px] text-white/28">
                {String(index + 1).padStart(2, '0')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white/82">{basename(path)}</p>
                <p className="mt-0.5 truncate font-mono text-[9px] text-white/30">{path}</p>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  onRemove(new Set([path]));
                }}
                aria-label={`${t('utilities.remove')} ${basename(path)}`}
                className="grid h-7 w-7 place-items-center rounded-lg text-white/25 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-300 focus:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </label>
          );
        })}
      </div>
    </div>
  );
}
