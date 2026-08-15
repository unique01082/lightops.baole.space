import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { configureUpdater, hashDirectory, validateReleaseSidecars } from './configure-release.mjs';

function fixture(platform = 'darwin') {
  const directory = mkdtempSync(join(tmpdir(), 'lightops-release-'));
  const suffix = platform === 'win32' ? '.exe' : '';
  for (const name of ['ffmpeg', 'exiftool', 'jpegtran']) {
    writeFileSync(join(directory, `${name}${suffix}`), name);
  }
  return directory;
}

function executor(platform, { gpl = false, encoder = true } = {}) {
  return (path, args) => {
    if (path.includes('ffmpeg') && args.includes('-version')) {
      return gpl ? 'ffmpeg --enable-gpl libx264' : 'ffmpeg LGPL build';
    }
    if (path.includes('ffmpeg') && args.includes('-encoders')) {
      if (!encoder) return 'encoders';
      return platform === 'win32' ? 'h264_mf' : 'h264_videotoolbox';
    }
    if (path.includes('exiftool')) return '13.33';
    return 'jpegtran 3.1';
  };
}

test('validates macOS and Windows sidecar bundles and required H.264 encoders', () => {
  for (const platform of ['darwin', 'win32']) {
    const binDirectory = fixture(platform);
    const result = validateReleaseSidecars({
      binDirectory,
      expectedHash: hashDirectory(binDirectory),
      updaterPublicKey: 'fixture-public-key',
      platform,
      execute: executor(platform),
    });
    assert.equal(result.encoder, platform === 'win32' ? 'h264_mf' : 'h264_videotoolbox');
  }
});

test('rejects checksum mismatch, missing encoder, and GPL FFmpeg', () => {
  const binDirectory = fixture();
  const common = { binDirectory, updaterPublicKey: 'key', platform: 'darwin' };
  assert.throws(
    () =>
      validateReleaseSidecars({
        ...common,
        expectedHash: '0'.repeat(64),
        execute: executor('darwin'),
      }),
    /checksum mismatch/,
  );
  const expectedHash = hashDirectory(binDirectory);
  assert.throws(
    () =>
      validateReleaseSidecars({
        ...common,
        expectedHash,
        execute: executor('darwin', { encoder: false }),
      }),
    /h264_videotoolbox/,
  );
  assert.throws(
    () =>
      validateReleaseSidecars({
        ...common,
        expectedHash,
        execute: executor('darwin', { gpl: true }),
      }),
    /GPL\/libx264/,
  );
});

test('writes the signing key only when an HTTPS updater endpoint exists', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lightops-updater-'));
  const configPath = join(directory, 'tauri.conf.json');
  mkdirSync(join(directory, 'unused'));
  writeFileSync(
    configPath,
    JSON.stringify({
      plugins: { updater: { pubkey: '', endpoints: ['https://example.com/latest.json'] } },
    }),
  );
  configureUpdater(configPath, 'signed-public-key');
  assert.equal(
    JSON.parse(readFileSync(configPath, 'utf8')).plugins.updater.pubkey,
    'signed-public-key',
  );

  writeFileSync(
    configPath,
    JSON.stringify({
      plugins: { updater: { pubkey: '', endpoints: ['http://example.com/latest.json'] } },
    }),
  );
  assert.throws(() => configureUpdater(configPath, 'key'), /HTTPS/);
});
