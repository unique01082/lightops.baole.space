# Frontend Deployment Runtime Fix

## Context

The Dokploy production application `Frontend` builds from `src-landing` on the
`main` branch. Its Docker build currently starts from Node 18 and asks Corepack
for `pnpm@latest`. On 2026-08-16, that resolves to pnpm 11, which cannot execute
under the selected Node runtime and fails before dependency installation with
`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`.

The repository CI already uses Node 22 and pnpm 10.28.1. The landing-page
Dockerfile is the remaining inconsistent build environment. The landing package
also lost its `pnpm.overrides` declaration while its lockfile retained the same
override metadata, causing pnpm 10 frozen installs to reject the lockfile.

## Design

Change the landing build configuration only:

- use `node:22-alpine` for the build stage;
- activate the explicitly pinned `pnpm@10.28.1` through Corepack;
- restore `pnpm.overrides.vite` at version 6.3.5 in
  `src-landing/package.json`, matching the existing lockfile metadata;
- leave the lockfile, build command, nginx runtime stage, ports, and Dokploy
  configuration unchanged.

Pinning both tools makes the container build deterministic and matches the
versions already exercised by CI. Restoring the deleted override declaration
repairs the package-to-lockfile contract without regenerating dependency data.

## Verification

Use the existing failing Docker build as the regression test:

1. Record that the unmodified Dockerfile fails at `pnpm install` with the same
   error observed in Dokploy.
2. Apply the two version changes and restore the matching pnpm override.
3. Run a clean Docker build of `src-landing` and require exit code 0.
4. Inspect the built container locally and require an HTTP response from nginx.
5. Push one final commit to `main`; Dokploy `autoDeploy=true` will trigger one
   production deployment.
6. Verify the deployment status, fresh build/runtime logs, and HTTP behavior on
   the configured published port 5468.

## Operational Safety

The application has no attached database, volume, mount, build secret, or
domain. It is currently in `error`, so there is no healthy runtime to interrupt.
Dokploy has no recorded successful deployment or active rollback point for this
application. Recovery therefore consists of reverting the Git commit and
allowing the same auto-deploy path to rebuild the prior source state.

No Dokploy configuration will be changed and no manual redeploy will be issued
unless the approved auto-deploy outcome is first reconciled read-only.

## Related

- [Native workflow refactor design](2026-06-07-lightops-native-workflow-refactor-design.md) - Existing LightOps architecture design
