import { describe, expect, it, vi } from 'vitest';
import { createSystemBrowserNavigator } from './auth-client';

describe('createSystemBrowserNavigator', () => {
  it('opens the authorization URL in the system browser without navigating the webview', async () => {
    const openUrl = vi.fn().mockResolvedValue(undefined);
    const navigator = createSystemBrowserNavigator(openUrl);
    const handle = await navigator.prepare({});

    const response = await handle.navigate({ url: 'https://auth.example/authorize' });

    expect(openUrl).toHaveBeenCalledWith('https://auth.example/authorize');
    expect(response).toEqual({ url: 'https://auth.example/authorize' });
  });
});
