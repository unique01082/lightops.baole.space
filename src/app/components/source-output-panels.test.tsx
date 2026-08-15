import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OutputFolderPanel } from './output-folder-panel';
import { SourceFoldersPanel } from './source-folders-panel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('Ingest source and output panels', () => {
  it('makes the empty source drop zone a keyboard-operable button', async () => {
    const user = userEvent.setup();
    const onAddFolder = vi.fn();
    render(<SourceFoldersPanel folders={[]} onAddFolder={onAddFolder} onRemoveFolder={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'sourceFolders.empty' }));
    expect(onAddFolder).toHaveBeenCalledOnce();
  });

  it('gives the output path field an accessible name', () => {
    render(<OutputFolderPanel outputFolder="" onBrowse={vi.fn()} onChange={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: 'outputFolder.title' })).toBeInTheDocument();
  });
});
