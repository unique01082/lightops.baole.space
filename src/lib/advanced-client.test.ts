import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { describe, expect, it, vi } from 'vitest';
import { tauriAdvancedClient } from './advanced-client';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => false),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

vi.mock('./media-client', () => ({
  tauriMediaClient: {},
}));

describe('tauriAdvancedClient', () => {
  it('does not attach native event listeners in a regular browser preview', async () => {
    expect(vi.mocked(isTauri)()).toBe(false);

    const dispose = await tauriAdvancedClient.subscribeJobProgress?.(vi.fn());

    expect(listen).not.toHaveBeenCalled();
    expect(dispose).toEqual(expect.any(Function));
  });
});
