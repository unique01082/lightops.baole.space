import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { test } from 'node:test';

import { hashDirectory } from './configure-release.mjs';

const root = resolve(import.meta.dirname, '..');

test('desktop window supports both acceptance viewports without page resizing below 900x640', () => {
  const config = JSON.parse(readFileSync(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8'));
  const window = config.app.windows.find((candidate) => candidate.label === 'main');
  assert.deepEqual(
    {
      width: window.width,
      height: window.height,
      minWidth: window.minWidth,
      minHeight: window.minHeight,
    },
    { width: 1200, height: 780, minWidth: 900, minHeight: 640 },
  );
});

test('desktop release creates signed updater artifacts', () => {
  const config = JSON.parse(readFileSync(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8'));
  assert.equal(config.bundle.createUpdaterArtifacts, true);
  assert.match(config.plugins.updater.endpoints[0], /releases\/latest\/download\/latest\.json$/);
});

test('release matrix builds every supported v2 platform target', () => {
  const workflow = readFileSync(resolve(root, '.github/workflows/release.yml'), 'utf8');
  for (const target of [
    'universal-apple-darwin',
    'x86_64-pc-windows-msvc',
    'aarch64-pc-windows-msvc',
  ]) {
    assert.match(workflow, new RegExp(`--target ${target}`));
  }
  assert.match(workflow, /TAURI_SIGNING_PRIVATE_KEY/);
  assert.match(workflow, /TAURI_UPDATER_PUBLIC_KEY/);
});

test('release builds pinned sidecars without private download URL secrets', () => {
  const workflow = readFileSync(resolve(root, '.github/workflows/release.yml'), 'utf8');
  assert.match(workflow, /prepare-sidecars-macos\.sh/);
  assert.match(workflow, /prepare-sidecars-windows\.ps1/);
  assert.doesNotMatch(workflow, /LIGHTOPS_SIDECAR_URL_/);
  assert.match(workflow, /LIGHTOPS_SIDECAR_SHA256/);
});

test('sidecar checksum is independent of relative or absolute directory paths', () => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'lightops-sidecar-hash-'));
  mkdirSync(resolve(fixture, 'nested'));
  writeFileSync(resolve(fixture, 'nested', 'sidecar'), 'pinned binary');

  const relativeFixture = `.${process.platform === 'win32' ? '\\' : '/'}${relative(process.cwd(), fixture)}`;
  assert.equal(hashDirectory(relativeFixture), hashDirectory(fixture));
});
