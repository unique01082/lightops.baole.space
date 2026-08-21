# LightOps id.baole.space Authentication Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate LightOps native and API authentication to the fail-closed `id.baole.space` contract while preserving its loopback callback, keyring storage, optional-sync UX, and guarded API.

**Architecture:** A central React auth provider owns one native OIDC manager and coordinates sync hydration. The API uses a fixed issuer-to-JWKS verifier so legacy and new issuers can coexist safely during rollout.

**Tech Stack:** React 18, TypeScript, Tauri 2, oidc-client-ts, NestJS 11, Passport custom strategy, jose, Vitest, Jest, Rust

**Spec:** `docs/superpowers/specs/2026-08-21-id-baole-space-auth-migration-design.md`

## Global Constraints

- Do not change Authentik, provider redirects, secrets, database/schema, production environment, deployment, or remote Git state.
- Keep Authorization Code with PKCE S256 and the native loopback callback.
- Keep OIDC state and sessions in the OS keyring; never store or log tokens in localStorage or files.
- Fail closed when required OIDC configuration is missing.
- Preserve the current optional-sync account-button UX and global API guards.

---

### Task 1: Central native OIDC service

**Files:**

- Modify: `src/lib/auth-client.ts`
- Modify: `src/lib/auth-client.test.ts`
- Modify: `src/vite-env.d.ts`

**Interfaces:**

- Produces: `getSafeReturnTo(value, fallback)`, `configureAuthClient()`, `loadSignedInUser()`, `signIn(returnTo)`, `signOut()`, `globalSignOut()`, and `getAccessToken()`.

- [ ] Add failing tests for configuration, safe redirects, public principal shape, duplicate operations, callback completion, logout, and token lookup.
- [ ] Run `pnpm vitest run src/lib/auth-client.test.ts` and confirm the new assertions fail.
- [ ] Implement one manager owner with keyring stores, loopback callback, PKCE code flow, fixed scopes, in-flight locks, and end-session logout.
- [ ] Run the focused test and confirm it passes.

### Task 2: Central React auth state and sync hydration

**Files:**

- Create: `src/app/auth/auth-context.tsx`
- Create: `src/app/auth/auth-context.test.tsx`
- Modify: `src/main.tsx`
- Modify: `src/app/toolbox/account-button.tsx`
- Modify: `src/lib/sync-outbox.ts`

**Interfaces:**

- Produces: `LightOpsAuthProvider` and `useLightOpsAuth()` with tri-state status and token-free user data.
- Consumes: native OIDC service from Task 1 and sync outbox lifecycle.

- [ ] Add failing component tests for checking state, restore, callback hydration, sign-in, app logout, and global logout.
- [ ] Implement the provider and update the account UI without changing established labels/layout.
- [ ] Ensure sync starts before authenticated state is published and stops on logout/expiry.
- [ ] Run the focused Vitest files.

### Task 3: Request authentication recovery

**Files:**

- Modify: `src/lib/sync-request.ts`
- Create: `src/lib/sync-request.test.ts`
- Modify: `src/lib/sync-outbox.ts`

**Interfaces:**

- Consumes: `getAccessToken()` and `clearLocalSession()`.
- Produces: bearer requests with one-shot 401 cleanup.

- [ ] Add failing tests for immediate token lookup, no bearer credential, and concurrent 401 responses.
- [ ] Remove access tokens from outbox inputs and resolve credentials per exchange.
- [ ] Run focused client tests.

### Task 4: Issuer-keyed API verification

**Files:**

- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/api/src/auth/jwt.strategy.ts`
- Modify: `apps/api/src/auth/jwt.strategy.spec.ts`
- Modify: `apps/api/src/app.e2e.spec.ts`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/scripts/generate-openapi.ts`

**Interfaces:**

- Produces: `OIDC_TRUSTED_ISSUERS_JSON` fixed mappings and normalized `AuthUser`.

- [ ] Add failing JWT tests for the negative/confusion/rotation matrix and complete claims.
- [ ] Add `jose` and implement an issuer-keyed Passport strategy with exact issuer/audience/RS256/required claims.
- [ ] Update E2E configuration for exact new and legacy issuer mappings.
- [ ] Run API unit and E2E tests.

### Task 5: Verification and production handoff

**Files:**

- Create: `docs/auth-production-preflight.md`
- Modify: `docs/superpowers/specs/2026-08-21-id-baole-space-auth-migration-design.md`

**Interfaces:**

- Produces: exact provider/env preflight, compatibility order, rollback, and evidence ledger.

- [ ] Run `pnpm test`, `pnpm test:api`, `pnpm typecheck`, `pnpm lint`, `pnpm build:frontend`, `pnpm build:api`, `cargo test`, and `cargo check`.
- [ ] Run the frontend preview and inspect desktop plus 390x844 layouts, console, overflow, and loading/account UX.
- [ ] Run native Tauri smoke where the environment supports it and record any provider-dependent blocker precisely.
- [ ] Review the diff for secrets, tokens, unrelated changes, and placeholders.
- [ ] Commit the implementation as a review-ready change without pushing or deploying.

## Related

- [Approved design](../specs/2026-08-21-id-baole-space-auth-migration-design.md)
