import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-shell';
import { User, UserManager, type INavigator, type StateStore } from 'oidc-client-ts';

const LIGHTOPS_AUTHORITY = 'https://id.baole.space/application/o/lightops/';
const GLOBAL_LOGOUT_URL = 'https://id.baole.space/logout';
const OIDC_EVENT = 'lightops://oidc-callback';
const OIDC_QUERY_KEYS = [
  'code',
  'state',
  'error',
  'error_description',
  'session_state',
  'id_token_hint',
];

type AuthEnvironment = Record<string, string | boolean | undefined>;

export type LightOpsAuthConfig = {
  authority: string;
  clientId: string;
  postLogoutRedirectUri: string;
};
export type LightOpsUser = {
  subject: string;
  email?: string;
  name?: string;
  permissions: string[];
};

const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export function getSafeReturnTo(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string') return fallback;
  const hasControlCharacter = Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    hasControlCharacter
  )
    return fallback;
  try {
    const target = new URL(value, window.location.origin);
    if (target.origin !== window.location.origin || target.pathname === '/auth/callback')
      return fallback;
    for (const key of OIDC_QUERY_KEYS) target.searchParams.delete(key);
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

export function validateAuthConfig(environment: AuthEnvironment): LightOpsAuthConfig {
  if (environment.VITE_OIDC_CLIENT_SECRET)
    throw new Error('LightOps is a public OIDC client; a client secret is forbidden');
  const authority = String(environment.VITE_OIDC_AUTHORITY ?? '').trim();
  const clientId = String(environment.VITE_OIDC_CLIENT_ID ?? '').trim();
  const postLogoutRedirectUri = String(environment.VITE_OIDC_POST_LOGOUT_REDIRECT_URI ?? '').trim();
  if (!authority) throw new Error('VITE_OIDC_AUTHORITY is required');
  if (!clientId) throw new Error('VITE_OIDC_CLIENT_ID is required');
  if (!postLogoutRedirectUri) throw new Error('VITE_OIDC_POST_LOGOUT_REDIRECT_URI is required');
  if (authority !== LIGHTOPS_AUTHORITY)
    throw new Error(`VITE_OIDC_AUTHORITY must use the LightOps provider: ${LIGHTOPS_AUTHORITY}`);
  if (clientId !== 'lightops') throw new Error('VITE_OIDC_CLIENT_ID must be lightops');
  const logoutUrl = new URL(postLogoutRedirectUri);
  if (logoutUrl.protocol !== 'https:' || logoutUrl.username || logoutUrl.password)
    throw new Error('VITE_OIDC_POST_LOGOUT_REDIRECT_URI must be a trusted HTTPS URL');
  return { authority, clientId, postLogoutRedirectUri: logoutUrl.href };
}

export function toPublicUser(user: User): LightOpsUser {
  return {
    subject: user.profile.sub,
    email: typeof user.profile.email === 'string' ? user.profile.email : undefined,
    name: typeof user.profile.name === 'string' ? user.profile.name : undefined,
    permissions: strings(user.profile.permissions),
  };
}

const credentialStateStore: StateStore = {
  set: (key, value) => invoke('set_oidc_state', { key, value }),
  get: (key) => invoke<string | null>('get_oidc_state', { key }),
  remove: (key) => invoke<string | null>('remove_oidc_state', { key }),
  getAllKeys: () => invoke<string[]>('list_oidc_state_keys'),
};

export function createSystemBrowserNavigator(
  openUrl: (url: string) => Promise<void> = open,
): INavigator {
  return {
    prepare: async () => ({
      navigate: async ({ url }) => {
        await openUrl(url);
        return { url };
      },
      close: () => undefined,
    }),
    callback: async () => undefined,
  };
}

let manager: UserManager | null = null;
let signInFlight: Promise<LightOpsUser> | null = null;
let signOutFlight: Promise<void> | null = null;

const config = () => validateAuthConfig(import.meta.env);

function createManager(redirectUri: string): UserManager {
  const settings = config();
  manager = new UserManager(
    {
      authority: settings.authority,
      client_id: settings.clientId,
      redirect_uri: redirectUri,
      post_logout_redirect_uri: settings.postLogoutRedirectUri,
      response_type: 'code',
      scope: 'openid profile email permissions',
      loadUserInfo: true,
      automaticSilentRenew: false,
      monitorSession: false,
      stateStore: credentialStateStore,
      userStore: credentialStateStore,
    },
    createSystemBrowserNavigator(),
  );
  return manager;
}

async function storedOidcUser(): Promise<User | null> {
  const session = await invoke<string | null>('load_oidc_session');
  if (!session) return null;
  const user = User.fromStorageString(session);
  if (user.expired) {
    await clearLocalSession();
    return null;
  }
  return user;
}

export async function loadSignedInUser(): Promise<LightOpsUser | null> {
  const user = await storedOidcUser();
  return user ? toPublicUser(user) : null;
}

export async function getAccessToken(): Promise<string | null> {
  return (await storedOidcUser())?.access_token ?? null;
}

export async function clearLocalSession(): Promise<void> {
  await invoke('clear_oidc_session');
}

export function signIn(returnTo = '/'): Promise<LightOpsUser> {
  if (signInFlight) return signInFlight;
  signInFlight = (async () => {
    config();
    const { redirectUri } = await invoke<{ redirectUri: string }>('start_oidc_callback_listener');
    const currentManager = createManager(redirectUri);
    return new Promise<LightOpsUser>((resolve, reject) => {
      let stopListening: (() => void) | undefined;
      let callbackStarted = false;
      void listen<string>(OIDC_EVENT, ({ payload }) => {
        if (callbackStarted) return;
        callbackStarted = true;
        void currentManager
          .signinRedirectCallback(payload)
          .then(async (user) => {
            await invoke('store_oidc_session', { session: user.toStorageString() });
            resolve(toPublicUser(user));
          })
          .catch(async (error) => {
            await currentManager.clearStaleState().catch(() => undefined);
            reject(error);
          })
          .finally(() => stopListening?.());
      })
        .then((stop) => {
          stopListening = stop;
          return currentManager.signinRedirect({ state: { returnTo: getSafeReturnTo(returnTo) } });
        })
        .catch(reject);
    });
  })().finally(() => {
    signInFlight = null;
  });
  return signInFlight;
}

export function signOut(): Promise<void> {
  if (signOutFlight) return signOutFlight;
  signOutFlight = (async () => {
    const current = await storedOidcUser();
    await clearLocalSession();
    if (!current?.id_token) return;
    const currentManager = manager ?? createManager('http://127.0.0.1/auth/callback');
    await currentManager
      .signoutRedirect({
        id_token_hint: current.id_token,
        post_logout_redirect_uri: config().postLogoutRedirectUri,
      })
      .catch(() => undefined);
  })().finally(() => {
    signOutFlight = null;
  });
  return signOutFlight;
}

export async function globalSignOut(): Promise<void> {
  await clearLocalSession();
  await open(GLOBAL_LOGOUT_URL);
}
