import { User } from 'oidc-client-ts';
import { describe, expect, it, vi } from 'vitest';
import {
  createSystemBrowserNavigator,
  getSafeReturnTo,
  toPublicUser,
  validateAuthConfig,
} from './auth-client';

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

describe('LightOps OIDC contract', () => {
  it.each([
    ['https://evil.example/steal', '/'],
    ['//evil.example/steal', '/'],
    ['/auth/callback?code=secret&state=secret', '/'],
    ['/tools?code=secret&keep=yes#result', '/tools?keep=yes#result'],
    ['/tools\\evil', '/'],
  ])('sanitizes return target %s', (value, expected) => {
    expect(getSafeReturnTo(value)).toBe(expected);
  });

  it('requires the app-specific issuer, client id, and post-logout URI', () => {
    expect(() => validateAuthConfig({})).toThrow('VITE_OIDC_AUTHORITY');
    expect(() =>
      validateAuthConfig({
        VITE_OIDC_AUTHORITY: 'https://id.baole.space/application/o/lightops/',
        VITE_OIDC_CLIENT_ID: 'lightops',
      }),
    ).toThrow('VITE_OIDC_POST_LOGOUT_REDIRECT_URI');
  });

  it('rejects a non-LightOps provider path and client secrets', () => {
    expect(() =>
      validateAuthConfig({
        VITE_OIDC_AUTHORITY: 'https://id.baole.space/application/o/another-app/',
        VITE_OIDC_CLIENT_ID: 'lightops',
        VITE_OIDC_POST_LOGOUT_REDIRECT_URI: 'https://lightops.baole.space/auth',
      }),
    ).toThrow('LightOps provider');
    expect(() =>
      validateAuthConfig({
        VITE_OIDC_AUTHORITY: 'https://id.baole.space/application/o/lightops/',
        VITE_OIDC_CLIENT_ID: 'lightops',
        VITE_OIDC_POST_LOGOUT_REDIRECT_URI: 'https://lightops.baole.space/auth',
        VITE_OIDC_CLIENT_SECRET: 'forbidden',
      }),
    ).toThrow('client secret');
  });

  it('does not expose access or ID tokens in the public principal', () => {
    const user = new User({
      access_token: 'access-secret',
      id_token: 'id-secret',
      token_type: 'Bearer',
      profile: {
        sub: 'user-1',
        iss: 'https://id.baole.space/application/o/lightops/',
        aud: 'lightops',
        exp: Math.floor(Date.now() / 1000) + 300,
        iat: Math.floor(Date.now() / 1000),
        email: 'user@example.com',
        permissions: ['app:lightops:sync', 42],
      },
    });

    expect(toPublicUser(user)).toEqual({
      subject: 'user-1',
      email: 'user@example.com',
      name: undefined,
      permissions: ['app:lightops:sync'],
    });
    expect(JSON.stringify(toPublicUser(user))).not.toContain('secret');
  });
});
