import { useState, useEffect } from "react";
import { APP_DATA } from "../constants/app";

export interface ReleaseAssets {
  windowsExe: string;
  windowsMsi: string;
  macDmg: string;
  macTarGz: string;
  linuxAppImage: string;
  linuxDeb: string;
  linuxRpm: string;
}

export interface GithubRelease {
  version: string;
  releasePageUrl: string;
  assets: ReleaseAssets;
  loading: boolean;
  error: boolean;
}

const FALLBACK_URL = APP_DATA.githubLatestRelease;

const INITIAL_ASSETS: ReleaseAssets = {
  windowsExe: FALLBACK_URL,
  windowsMsi: FALLBACK_URL,
  macDmg: FALLBACK_URL,
  macTarGz: FALLBACK_URL,
  linuxAppImage: FALLBACK_URL,
  linuxDeb: FALLBACK_URL,
  linuxRpm: FALLBACK_URL,
};

function findAsset(
  assets: Array<{ name: string; browser_download_url: string }>,
  match: (name: string) => boolean
): string {
  return assets.find((a) => match(a.name))?.browser_download_url ?? FALLBACK_URL;
}

export function useGithubRelease(): GithubRelease {
  const [state, setState] = useState<GithubRelease>({
    version: APP_DATA.version,
    releasePageUrl: FALLBACK_URL,
    assets: INITIAL_ASSETS,
    loading: true,
    error: false,
  });

  useEffect(() => {
    const repoPath = APP_DATA.githubRepo.replace("https://github.com/", "");
    const apiUrl = `https://api.github.com/repos/${repoPath}/releases/latest`;

    fetch(apiUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const rawAssets: Array<{ name: string; browser_download_url: string }> =
          data.assets ?? [];

        setState({
          version:
            (data.tag_name as string)?.replace(/^v/, "") ?? APP_DATA.version,
          releasePageUrl: (data.html_url as string) ?? FALLBACK_URL,
          assets: {
            windowsExe: findAsset(rawAssets, (n) => n.endsWith("-setup.exe")),
            windowsMsi: findAsset(rawAssets, (n) => n.endsWith(".msi")),
            macDmg: findAsset(rawAssets, (n) => n.endsWith(".dmg")),
            macTarGz: findAsset(rawAssets, (n) => n.endsWith(".app.tar.gz")),
            linuxAppImage: findAsset(rawAssets, (n) => n.endsWith(".AppImage")),
            linuxDeb: findAsset(rawAssets, (n) => n.endsWith(".deb")),
            linuxRpm: findAsset(rawAssets, (n) => n.endsWith(".rpm")),
          },
          loading: false,
          error: false,
        });
      })
      .catch(() => {
        setState((prev) => ({ ...prev, loading: false, error: true }));
      });
  }, []);

  return state;
}
