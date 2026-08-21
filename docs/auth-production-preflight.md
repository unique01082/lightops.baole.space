# LightOps Authentication Production Preflight

Do not deploy the client migration or change production Authentik/API configuration until every blocking check below has direct evidence.

## Current Blocking Evidence

On 2026-08-21, both application-specific discovery requests returned HTTP 404:

```text
https://id.baole.space/application/o/lightops/.well-known/openid-configuration
https://auth.baole.space/application/o/lightops/.well-known/openid-configuration
```

This means the repository implementation can be reviewed and tested locally, but live authorization, callback, token, JWKS, and logout behavior cannot yet be validated. Do not substitute another application's provider values.

## Authentik Provider Checks

- Provision or locate the dedicated LightOps application/provider with slug `lightops`.
- Confirm it is a public OAuth2/OIDC client with client ID `lightops` and no client secret in client artifacts.
- Fetch the LightOps discovery document through `id.baole.space`; record the exact issuer, authorization, token, userinfo, JWKS, and end-session endpoints.
- Confirm `code` response type, authorization-code grant, and `S256` code challenge support.
- Confirm only `openid profile email permissions` is requested and the `permissions` scope emits `app:lightops:sync` for authorized principals.
- Confirm access tokens use audience `lightops`; do not infer this from ID tokens.
- Register the native loopback policy for `http://127.0.0.1:<dynamic-port>/auth/callback` using the narrowest redirect pattern Authentik supports.
- Register the exact post-logout URI supplied as `VITE_OIDC_POST_LOGOUT_REDIRECT_URI`.
- Verify the provider application launch URL makes Authentik's session-end Continue action safe and usable.

## Environment Changes

Client build:

```env
VITE_OIDC_AUTHORITY=https://id.baole.space/application/o/lightops/
VITE_OIDC_CLIENT_ID=lightops
VITE_OIDC_POST_LOGOUT_REDIRECT_URI=<exact-registered-https-uri>
VITE_LIGHTOPS_API_URL=https://lightops.baole.space
```

API compatibility deployment:

```env
OIDC_AUDIENCE=lightops
OIDC_TRUSTED_ISSUERS_JSON=[{"issuer":"https://id.baole.space/application/o/lightops/","jwksUri":"<new-discovered-jwks-uri>"},{"issuer":"https://auth.baole.space/application/o/lightops/","jwksUri":"<legacy-discovered-jwks-uri>"}]
```

Use only discovery-confirmed values. If the issuers intentionally share signing keys, retaining separate explicit mappings is still safe and makes ownership visible.

## Compatibility Order

1. Restore successful LightOps discovery and verify provider configuration without changing clients.
2. Deploy API issuer-to-JWKS compatibility accepting the exact new and exact legacy issuers with audience `lightops`.
3. Prove new and legacy access tokens pass the API matrix; prove cross-app, wrong-audience, ID-token, unknown-key, and expired tokens fail.
4. Release the native client configured for only the new `id.baole.space` authority.
5. Verify real desktop callback restoration, immediate sync data, reload without signed-out flash, a second app instance/tab reusing SSO without F5, app end-session, global logout, and failure recovery.
6. Stop legacy issuance. Keep compatibility for the maximum legacy access/refresh-token lifetime and until telemetry shows seven continuous days without valid legacy traffic.
7. Remove the legacy issuer mapping in a later reviewed deployment.

## Production Verification

- Inspect authorize navigation and confirm `response_type=code`, `code_challenge_method=S256`, exact client ID, exact loopback callback, and no direct `/if/flow`, `/if/user`, or `/source` integration.
- Complete one callback and confirm local tools remain on the restored surface and synchronized data is available immediately.
- Reload and confirm the account control stays in its loading state until keyring restoration completes.
- Open a second application instance and confirm Authentik SSO completes through one top-level system-browser authorization without an F5.
- Confirm the API accepts the OAuth access token and rejects the ID token where audience/type distinction permits.
- Confirm app logout reaches the discovered end-session endpoint, clears the keyring session, and offers only the registered Continue target.
- Confirm global logout is visibly separate and ends the baole.space session.
- Test foreign HTTPS, insecure HTTP, and missing post-logout targets; none may produce an unsafe Continue action.
- Verify desktop and 390x844 layouts, keyboard access, clean console/logs, and no horizontal overflow.
- Search logs and storage for authorization codes, callback URLs, access tokens, refresh tokens, ID tokens, and client secrets.

## Rollback

If the new client fails, stop distribution and restore the previous client build using the legacy authority. Keep the compatibility API deployed so both exact issuers remain valid during rollback. Do not change the API audience or permission contract. If API JWKS retrieval fails, roll back to the last reviewed API image and its previously verified key configuration; do not weaken issuer, audience, algorithm, expiry, or permission checks.

## Related

- [Migration design](superpowers/specs/2026-08-21-id-baole-space-auth-migration-design.md)
- [Implementation plan](superpowers/plans/2026-08-21-id-baole-space-auth-migration.md)
