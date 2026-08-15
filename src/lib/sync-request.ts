import { loadSignedInUser } from './auth-client';

export type SyncRequestOptions = RequestInit & {
  params?: Record<string, unknown>;
  data?: unknown;
  apiBaseUrl?: string;
  accessToken?: string;
};

export default async function request<T>(
  url: string,
  options: SyncRequestOptions = {},
): Promise<T> {
  const user = options.accessToken ? null : await loadSignedInUser();
  const accessToken = options.accessToken ?? user?.accessToken;
  if (!accessToken) throw new Error('Sign in to sync LightOps settings and presets');
  const apiBaseUrl =
    options.apiBaseUrl ?? import.meta.env.VITE_LIGHTOPS_API_URL ?? 'https://lightops.baole.space';
  const requestOptions = { ...options };
  delete requestOptions.data;
  delete requestOptions.apiBaseUrl;
  delete requestOptions.accessToken;
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}${url}`, {
    ...requestOptions,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
    body: options.data === undefined ? options.body : JSON.stringify(options.data),
  });
  if (!response.ok) throw new Error(`Sync request failed (${response.status})`);
  return (await response.json()) as T;
}
