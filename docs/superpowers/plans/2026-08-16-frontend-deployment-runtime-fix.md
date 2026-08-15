# Frontend Deployment Runtime Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the Dokploy production frontend build by aligning its Docker build toolchain with the repository CI toolchain.

**Architecture:** Keep the repair isolated to the landing-page Dockerfile. Build with Node 22 and a deterministic pnpm 10.28.1, preserve the nginx runtime stage, and use the existing GitHub auto-deploy path without modifying Dokploy configuration.

**Tech Stack:** Docker, Node.js 22 Alpine, Corepack, pnpm 10.28.1, Vite, nginx Alpine, Dokploy

## Global Constraints

- Modify only `src-landing/Dockerfile` and `src-landing/package.json` for runtime behavior.
- Use `node:22-alpine` and `pnpm@10.28.1` exactly.
- Restore `pnpm.overrides.vite` at version 6.3.5 to match the existing lockfile.
- Preserve `pnpm-lock.yaml`, the Vite build command, nginx configuration, and published port 5468.
- Do not change Dokploy configuration or issue a second deployment mutation without a new preflight and approval.
- Preserve the unrelated untracked file `docs/superpowers/plans/2026-06-07-lightops-native-workflow-refactor.md`.

---

### Task 1: Align and deploy the frontend Docker toolchain

**Files:**

- Modify: `src-landing/Dockerfile:2-4`
- Modify: `src-landing/package.json:97-104`
- Include: `docs/superpowers/specs/2026-08-16-frontend-deployment-runtime-fix-design.md`
- Include: `docs/superpowers/plans/2026-08-16-frontend-deployment-runtime-fix.md`
- Test: Docker build and running nginx container

**Interfaces:**

- Consumes: Dokploy GitHub source `unique01082/lightops.baole.space`, branch `main`, build path `/src-landing`
- Produces: A Docker image whose static Vite output is served by nginx on container port 80

- [x] **Step 1: Confirm the regression fails before the change**

Run:

```bash
docker build --progress=plain --tag lightops-frontend:diagnostic src-landing
```

Expected: the original image exits 1 at `pnpm install --frozen-lockfile`, with
`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING` under Node 18.20.8. After pinning the
toolchain alone, the build reaches pnpm 10 and exits 1 with
`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`. Both failures were recorded locally.

- [x] **Step 2: Apply the minimal build-configuration change**

Replace the build toolchain declarations with:

```dockerfile
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
```

Restore the package metadata that originally produced the current lockfile:

```json
"pnpm": {
  "overrides": {
    "vite": "6.3.5"
  }
}
```

Do not alter the remaining Dockerfile instructions or package fields.

- [x] **Step 3: Build the complete image without relying on cached commands**

Run:

```bash
docker build --no-cache --progress=plain --tag lightops-frontend:verify src-landing
```

Expected: exit code 0; `pnpm install --frozen-lockfile`, `pnpm build`, and the
nginx image export all complete successfully.

- [x] **Step 4: Verify the built image serves the SPA through nginx**

Run:

```bash
verify_container_id=$(docker run --rm -d -p 127.0.0.1:15468:80 lightops-frontend:verify)
curl --fail --silent --show-error --retry 10 --retry-all-errors --retry-delay 1 http://127.0.0.1:15468/ >/dev/null
docker stop "$verify_container_id"
```

Expected: curl exits 0 with an HTTP 2xx response and the container stops cleanly.

- [x] **Step 5: Review the exact change and create one final local commit**

Run:

```bash
git diff --check
git diff -- src-landing/Dockerfile src-landing/package.json
git status --short
git add src-landing/Dockerfile src-landing/package.json docs/superpowers/specs/2026-08-16-frontend-deployment-runtime-fix-design.md docs/superpowers/plans/2026-08-16-frontend-deployment-runtime-fix.md
git commit --amend -m "fix(deploy): pin frontend build toolchain"
```

Expected: one local commit ahead of `origin/main`; the unrelated untracked plan
remains untracked and absent from the commit.

- [ ] **Step 6: Push the single approved mutation**

Run:

```bash
git push origin main
```

Expected: one push advances `origin/main`; Dokploy `autoDeploy=true` creates one
new deployment for the pushed commit. Do not call a manual deploy endpoint.

- [ ] **Step 7: Reconcile and verify production read-only**

Using Dokploy MCP, read the exact application and its deployment list until the
new deployment reaches a terminal state. Then inspect that deployment's logs,
the application runtime logs, and the HTTP response through published port 5468.

Expected:

- the deployment for the pushed commit reaches `done`;
- build logs show Node 22 with pinned pnpm 10.28.1 and no dynamic-import error;
- application logs contain no startup failure;
- the published HTTP endpoint returns a successful response.

If the push response or auto-deploy outcome is ambiguous, do not push or deploy
again. Reconcile live state read-only and prepare a new preflight if another
mutation is required.
