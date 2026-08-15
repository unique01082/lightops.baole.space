import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-shell';
import { User, UserManager, type INavigator, type StateStore } from 'oidc-client-ts';

const authority =
  import.meta.env.VITE_OIDC_AUTHORITY ?? 'https://auth.baole.space/application/o/lightops/';

export type LightOpsUser = {
  subject: string;
  email?: string;
  name?: string;
  accessToken: string;
};

function publicUser(user: User): LightOpsUser {
  return {
    subject: user.profile.sub,
    email: user.profile.email,
    name: user.profile.name,
    accessToken: user.access_token,
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

export async function loadSignedInUser(): Promise<LightOpsUser | null> {
  const session = await invoke<string | null>('load_oidc_session');
  if (!session) return null;
  const user = User.fromStorageString(session);
  if (user.expired) {
    await invoke('clear_oidc_session');
    return null;
  }
  return publicUser(user);
}

export async function signIn(): Promise<LightOpsUser> {
  const { redirectUri } = await invoke<{ redirectUri: string }>('start_oidc_callback_listener');
  const manager = new UserManager(
    {
      authority,
      client_id: 'lightops',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid profile email permissions',
      loadUserInfo: true,
      automaticSilentRenew: false,
      stateStore: credentialStateStore,
      userStore: credentialStateStore,
    },
    createSystemBrowserNavigator(),
  );

  return new Promise<LightOpsUser>((resolve, reject) => {
    let unlisten: (() => void) | undefined;
    void listen<string>('lightops://oidc-callback', async ({ payload }) => {
      try {
        const user = await manager.signinRedirectCallback(payload);
        await invoke('store_oidc_session', { session: user.toStorageString() });
        unlisten?.();
        resolve(publicUser(user));
      } catch (error) {
        unlisten?.();
        reject(error);
      }
    })
      .then((stop) => {
        unlisten = stop;
        return manager.signinRedirect();
      })
      .catch(reject);
  });
}

export async function signOut() {
  await invoke('clear_oidc_session');
}
