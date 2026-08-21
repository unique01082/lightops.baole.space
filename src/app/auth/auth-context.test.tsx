import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSignedInUser, signIn } from '../../lib/auth-client';
import { startSyncOutbox } from '../../lib/sync-outbox';
import { LightOpsAuthProvider, useLightOpsAuth } from './auth-context';

vi.mock('../../lib/auth-client', () => ({
  clearLocalSession: vi.fn(),
  globalSignOut: vi.fn(),
  loadSignedInUser: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('../../lib/sync-outbox', () => ({ startSyncOutbox: vi.fn(), stopSyncOutbox: vi.fn() }));

function Probe() {
  const auth = useLightOpsAuth();
  return (
    <div>
      {auth.status}:{auth.user?.email ?? 'none'}
    </div>
  );
}

describe('LightOpsAuthProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps the checking state until restore and sync hydration finish', async () => {
    let finishSync: (() => void) | undefined;
    vi.mocked(loadSignedInUser).mockResolvedValue({
      subject: 'user-1',
      email: 'user@example.com',
      permissions: ['app:lightops:sync'],
    });
    vi.mocked(startSyncOutbox).mockReturnValue(
      new Promise<void>((resolve) => {
        finishSync = resolve;
      }),
    );
    render(
      <LightOpsAuthProvider>
        <Probe />
      </LightOpsAuthProvider>,
    );
    expect(screen.getByText('checking:none')).toBeInTheDocument();
    await waitFor(() => expect(startSyncOutbox).toHaveBeenCalledOnce());
    expect(screen.getByText('checking:none')).toBeInTheDocument();
    finishSync?.();
    expect(await screen.findByText('authenticated:user@example.com')).toBeInTheDocument();
  });

  it('hydrates sync before publishing a callback user', async () => {
    const user = { subject: 'user-1', email: 'user@example.com', permissions: [] };
    vi.mocked(loadSignedInUser).mockResolvedValue(null);
    vi.mocked(signIn).mockResolvedValue(user);
    vi.mocked(startSyncOutbox).mockResolvedValue();
    function SignInProbe() {
      const auth = useLightOpsAuth();
      return <button onClick={() => void auth.signIn('/tools')}>{auth.status}</button>;
    }
    render(
      <LightOpsAuthProvider>
        <SignInProbe />
      </LightOpsAuthProvider>,
    );
    const button = await screen.findByRole('button', { name: 'signed-out' });
    button.click();
    await waitFor(() => expect(startSyncOutbox).toHaveBeenCalledWith());
    expect(signIn).toHaveBeenCalledWith('/tools');
    expect(await screen.findByRole('button', { name: 'authenticated' })).toBeInTheDocument();
  });

  it('keeps the signed-out UI usable when native sign-in cannot start', async () => {
    vi.mocked(loadSignedInUser).mockResolvedValue(null);
    vi.mocked(signIn).mockRejectedValue(new Error('OIDC is not configured'));
    function FailureProbe() {
      const auth = useLightOpsAuth();
      return (
        <button onClick={() => void auth.signIn()}>
          {auth.status}:{auth.error ?? 'none'}
        </button>
      );
    }
    render(
      <LightOpsAuthProvider>
        <FailureProbe />
      </LightOpsAuthProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'signed-out:none' }));
    expect(await screen.findByText('signed-out:OIDC is not configured')).toBeInTheDocument();
  });
});
