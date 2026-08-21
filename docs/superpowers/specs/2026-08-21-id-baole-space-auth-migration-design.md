# LightOps id.baole.space Authentication Migration Design

## Scope

Migrate the LightOps Tauri client and NestJS sync API from the legacy LightOps issuer to the current baole.space identity contract without changing Authentik, production configuration, database schema, deployment state, or product navigation.

The native application remains usable without authentication. Authentication enables cloud synchronization; it does not become a gate around local media tools.

## Verified Current Contract

- Native OAuth client: `lightops`
- Legacy issuer configured by the repository: `https://auth.baole.space/application/o/lightops/`
- Requested scopes: `openid profile email permissions`
- API audience: `lightops`
- Permission: `app:lightops:sync`
- Callback: dynamically allocated loopback URI `http://127.0.0.1:<port>/auth/callback`
- OIDC session and transaction state: operating-system keyring service `space.baole.lightops`
- API: NestJS with globally registered authentication and permission guards

On 2026-08-21, both the legacy and proposed `id.baole.space` LightOps discovery URLs returned HTTP 404. The implementation must therefore fail closed when explicit configuration is absent and the production preflight must require provisioning or correcting the LightOps application/provider before rollout.

## Client Architecture

One native `UserManager` owner coordinates bootstrap, sign-in, callback completion, logout, and access-token retrieval. React consumes a central `LightOpsAuthProvider` exposing a token-free display principal and tri-state status (`checking`, `authenticated`, or `signed-out`).

Authorization always starts through the configured provider authority. `oidc-client-ts` uses Authorization Code with PKCE S256 and opens the authorize URL in the system browser. The loopback callback and Tauri event name remain stable. OIDC state and the serialized OIDC user remain in the OS keyring; app-owned localStorage and ordinary files never store tokens.

Sign-in stores a validated relative `returnTo` in OIDC state. Since LightOps has internal workspace state rather than URL routes, `/` is the current restoration target; the validator is retained for future route surfaces and rejects absolute, protocol-relative, backslash, control-character, and callback targets.

Callback processing has a shared in-flight promise. It publishes the session only after the sync outbox has been started, preventing an authenticated-but-unhydrated UI. Bootstrap retains the existing processing surface until keyring restoration completes. A missing local session may trigger one system-browser authorization attempt when the user explicitly signs in; Authentik can reuse its SSO session without an F5.

App logout clears local state and initiates the provider end-session request with the current ID token and exact configured post-logout URI. Global logout is a separate action using a fixed `https://id.baole.space/logout` target. Failures leave a usable signed-out application and never log callback URLs or tokens.

API requests obtain the current access token immediately before each request. A shared one-shot 401 handler clears the local session and stops sync without redirect storms.

## API Architecture

The NestJS API remains guarded by default. Health liveness/readiness remain the only public routes. Sync exchange continues to require `app:lightops:sync`, with missing or invalid authentication returning 401 and insufficient permission returning 403.

JWT verification moves from one frozen JWKS document to `jose` with a fixed `OIDC_TRUSTED_ISSUERS_JSON` list. Each entry binds one exact HTTPS issuer to one exact HTTPS JWKS URI. The unverified `iss` is used only as a lookup key; signature verification then requires RS256, the same exact issuer, audience `lightops`, expiration, and required `sub`, `iss`, `aud`, and `exp` claims. Claims are normalized once and retain roles, permissions, groups, issuer, audience, and timestamps.

The migration configuration may contain the new issuer and the exact legacy issuer during an approved compatibility window. No JWKS URL is derived from token input. Remote key caching supports rotation and fails closed when keys or discovery are unavailable.

## Verification

Client tests cover safe return targets, configuration failure, PKCE authorization parameters, duplicate sign-in/callback/logout suppression, restored and expired sessions, callback hydration, token-free public principal, immediate API token lookup, one-shot 401 cleanup, and app/global logout separation.

API tests cover valid new and legacy issuers, unknown issuer, wrong audience, wrong algorithm, bad signature, expiry, malformed tokens, unknown key IDs, issuer/key confusion, attacker-controlled JWKS input, rotation refresh, required claims, permission normalization, public routes, and 401/403 behavior.

Build, typecheck, lint, Vitest, Jest, Cargo tests, and Tauri checks must pass. Browser preview is verified at desktop and 390x844 for clean console output and no horizontal overflow. Native loopback callback and system-browser behavior require Tauri runtime verification; browser preview cannot prove them.

## Production Preflight and Rollback

Before deployment, operators must verify the LightOps discovery document, issuer, authorization endpoint, token endpoint, JWKS URI, end-session endpoint, public-client type, PKCE S256, client ID, exact audience, permission scope mapping, dynamic loopback redirect policy, and exact post-logout URI. API compatibility deploys before the new client. Rollback restores the prior client authority while the API continues accepting the exact legacy issuer. Legacy issuer removal occurs only after issuance stops, token lifetimes drain, and telemetry shows seven continuous days without valid legacy traffic.

## Related

- [Implementation plan](../plans/2026-08-21-id-baole-space-auth-migration.md)

