import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(import.meta.dirname, '..');

export function hashDirectory(directory) {
  directory = resolve(directory);
  const hash = createHash('sha256');
  const visit = (path) => {
    for (const name of readdirSync(path).sort()) {
      const child = join(path, name);
      const relative = child.slice(directory.length + 1);
      const stats = statSync(child);
      if (stats.isDirectory()) visit(child);
      else {
        hash.update(relative);
        hash.update(readFileSync(child));
      }
    }
  };
  visit(directory);
  return hash.digest('hex');
}

export function validateReleaseSidecars({
  binDirectory,
  expectedHash,
  updaterPublicKey,
  platform = process.platform,
  execute = execFileSync,
}) {
  if (!expectedHash) throw new Error('LIGHTOPS_SIDECAR_SHA256 is required');
  const actualHash = hashDirectory(binDirectory);
  if (actualHash !== expectedHash.toLowerCase()) {
    throw new Error(`sidecar directory checksum mismatch (received ${actualHash})`);
  }
  if (!updaterPublicKey) throw new Error('TAURI_UPDATER_PUBLIC_KEY is required');

  const isWindows = platform === 'win32';
  const ffmpeg = join(binDirectory, isWindows ? 'ffmpeg.exe' : 'ffmpeg');
  const exiftool = join(binDirectory, isWindows ? 'exiftool.exe' : 'exiftool');
  const jpegtran = join(binDirectory, isWindows ? 'jpegtran.exe' : 'jpegtran');
  const encoder = isWindows ? 'h264_mf' : 'h264_videotoolbox';
  let ffmpegVersion;
  let encoders;
  let exiftoolVersion;
  let jpegtranVersion;
  try {
    ffmpegVersion = execute(ffmpeg, ['-version'], { encoding: 'utf8', timeout: 10_000 });
    encoders = execute(ffmpeg, ['-hide_banner', '-encoders'], {
      encoding: 'utf8',
      timeout: 10_000,
    });
    exiftoolVersion = execute(exiftool, ['-ver'], { encoding: 'utf8', timeout: 10_000 });
    jpegtranVersion = execute(jpegtran, ['-version'], {
      encoding: 'utf8',
      timeout: 10_000,
    });
  } catch (error) {
    throw new Error(`sidecar self-check could not execute: ${error.message}`, { cause: error });
  }
  if (!encoders.includes(encoder))
    throw new Error(`${basename(ffmpeg)} does not provide ${encoder}`);
  if (/--enable-(?:gpl|libx264)(?:\s|$)/i.test(ffmpegVersion)) {
    throw new Error('FFmpeg bundle contains GPL/libx264 components; an LGPL build is required');
  }
  return { ffmpegVersion, exiftoolVersion, jpegtranVersion, encoder };
}

export function configureUpdater(configPath, updaterPublicKey) {
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  if (
    !Array.isArray(config.plugins?.updater?.endpoints) ||
    !config.plugins.updater.endpoints.length
  ) {
    throw new Error('Tauri updater endpoint is required');
  }
  if (!config.plugins.updater.endpoints.every((endpoint) => endpoint.startsWith('https://'))) {
    throw new Error('Tauri updater endpoints must use HTTPS');
  }
  config.plugins.updater.pubkey = updaterPublicKey;
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

function main() {
  try {
    const result = validateReleaseSidecars({
      binDirectory: join(root, 'src-tauri', 'resources', 'bin'),
      expectedHash: process.env.LIGHTOPS_SIDECAR_SHA256,
      updaterPublicKey: process.env.TAURI_UPDATER_PUBLIC_KEY,
    });
    configureUpdater(
      join(root, 'src-tauri', 'tauri.conf.json'),
      process.env.TAURI_UPDATER_PUBLIC_KEY,
    );
    process.stdout.write(
      `Verified FFmpeg ${result.ffmpegVersion.split('\n')[0]} with ${result.encoder}; ExifTool ${result.exiftoolVersion.trim()}; ${result.jpegtranVersion.trim()}\n`,
    );
  } catch (error) {
    process.stderr.write(`Release preflight failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
