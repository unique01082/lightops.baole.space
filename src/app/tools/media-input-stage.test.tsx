import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MediaInputStage } from './media-input-stage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('MediaInputStage', () => {
  it('presents an illuminated empty light table with named import actions', () => {
    render(
      <MediaInputStage
        paths={[]}
        selectedPaths={new Set()}
        onSelectedPathsChange={vi.fn()}
        onAddImages={vi.fn()}
        onAddFolder={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByTestId('empty-light-table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'utilities.addImages' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'utilities.addFolder' })).toBeInTheDocument();
  });

  it('supports checkbox multi-selection, removal, and clearing', async () => {
    const user = userEvent.setup();
    const onSelectedPathsChange = vi.fn();
    const onRemove = vi.fn();
    const paths = ['/shoot/a.jpg', '/shoot/b.jpg'];

    const { rerender } = render(
      <MediaInputStage
        paths={paths}
        selectedPaths={new Set()}
        onSelectedPathsChange={onSelectedPathsChange}
        onAddImages={vi.fn()}
        onAddFolder={vi.fn()}
        onRemove={onRemove}
      />,
    );

    await user.click(screen.getByRole('checkbox', { name: 'utilities.selectInput a.jpg' }));
    expect(onSelectedPathsChange).toHaveBeenCalledWith(new Set(['/shoot/a.jpg']));

    rerender(
      <MediaInputStage
        paths={paths}
        selectedPaths={new Set(['/shoot/a.jpg'])}
        onSelectedPathsChange={onSelectedPathsChange}
        onAddImages={vi.fn()}
        onAddFolder={vi.fn()}
        onRemove={onRemove}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'utilities.removeSelected' }));
    expect(onRemove).toHaveBeenCalledWith(new Set(['/shoot/a.jpg']));
    await user.click(screen.getByRole('button', { name: 'utilities.clear' }));
    expect(onRemove).toHaveBeenCalledWith(new Set(paths));
  });
});
