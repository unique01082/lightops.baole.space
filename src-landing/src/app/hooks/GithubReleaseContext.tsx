import { createContext, useContext, type ReactNode } from 'react';
import { APP_DATA } from '../constants/app';
import { useGithubRelease, type GithubRelease } from './useGithubRelease';

const FALLBACK_URL = APP_DATA.githubLatestRelease;

const defaultValue: GithubRelease = {
  version: APP_DATA.version,
  releasePageUrl: FALLBACK_URL,
  assets: {
    windowsExe: FALLBACK_URL,
    windowsMsi: FALLBACK_URL,
    windowsArm64Exe: FALLBACK_URL,
    windowsArm64Msi: FALLBACK_URL,
    macDmg: FALLBACK_URL,
    macTarGz: FALLBACK_URL,
    linuxAppImage: FALLBACK_URL,
    linuxDeb: FALLBACK_URL,
    linuxRpm: FALLBACK_URL,
  },
  loading: true,
  error: false,
};

const GithubReleaseContext = createContext<GithubRelease>(defaultValue);

export function GithubReleaseProvider({ children }: { children: ReactNode }) {
  const release = useGithubRelease();
  return <GithubReleaseContext.Provider value={release}>{children}</GithubReleaseContext.Provider>;
}

export function useGithubReleaseContext(): GithubRelease {
  return useContext(GithubReleaseContext);
}
