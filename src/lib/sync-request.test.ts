import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLocalSession, getAccessToken } from './auth-client';
import request, { resetUnauthorizedRecoveryForTests } from './sync-request';

vi.mock('./auth-client', () => ({ getAccessToken: vi.fn(), clearLocalSession: vi.fn() }));

describe('sync request authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetUnauthorizedRecoveryForTests();
  });

  it('reads the current access token immediately before a request', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('current-access-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }),
    );
    await request('/sync', { apiBaseUrl: 'https://api.example' });
    expect(getAccessToken).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      'https://api.example/sync',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer current-access-token' }),
      }),
    );
  });

  it('rejects locally when no OAuth access token exists', async () => {
    vi.mocked(getAccessToken).mockResolvedValue(null);
    vi.stubGlobal('fetch', vi.fn());
    await expect(request('/sync')).rejects.toThrow('Sign in to sync');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('clears the local session once for concurrent 401 responses', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('expired');
    vi.mocked(clearLocalSession).mockResolvedValue();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await Promise.allSettled([request('/a'), request('/b')]);
    expect(clearLocalSession).toHaveBeenCalledOnce();
  });
});
