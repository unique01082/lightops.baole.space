/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OIDC_AUTHORITY?: string;
  readonly VITE_OIDC_CLIENT_ID?: string;
  readonly VITE_OIDC_POST_LOGOUT_REDIRECT_URI?: string;
  readonly VITE_OIDC_CLIENT_SECRET?: never;
  readonly VITE_LIGHTOPS_API_URL?: string;
}
