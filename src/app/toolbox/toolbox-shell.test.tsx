import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LightOpsAuthProvider } from '../auth/auth-context';
import { ToolboxShell } from './toolbox-shell';

vi.mock('../../lib/auth-client', () => ({ loadSignedInUser: vi.fn().mockResolvedValue(null) }));
vi.mock('../../lib/sync-outbox', () => ({ startSyncOutbox: vi.fn(), stopSyncOutbox: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

describe('ToolboxShell', () => {
  const renderShell = () =>
    render(
      <LightOpsAuthProvider>
        <ToolboxShell renderIngest={() => <div>Legacy workflow</div>} />
      </LightOpsAuthProvider>,
    );

  it('opens a tool and returns to the toolbox', async () => {
    const user = userEvent.setup();
    renderShell();

    expect(screen.getAllByRole('button', { name: /toolbox\.tools\./ })).toHaveLength(6);
    await user.click(screen.getByRole('button', { name: /toolbox\.tools\.resize\.title/ }));
    expect(screen.getByRole('heading', { name: 'toolbox.tools.resize.title' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'toolbox.back' }));
    expect(screen.getByRole('heading', { name: 'toolbox.title' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /toolbox\.tools\.resize\.title/ })).toHaveFocus();
  });

  it('opens the shared settings dialog', async () => {
    const user = userEvent.setup();
    renderShell();

    const settingsButton = screen.getByRole('button', { name: 'titleBar.settings' });
    await user.click(settingsButton);
    expect(screen.getByRole('dialog', { name: 'settings.title' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(settingsButton).toHaveFocus();
  });
});
