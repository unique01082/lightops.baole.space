import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  globalSignOut as globalSignOutClient,
  loadSignedInUser,
  signIn as signInClient,
  signOut as signOutClient,
  type LightOpsUser,
} from '../../lib/auth-client';
import { startSyncOutbox, stopSyncOutbox } from '../../lib/sync-outbox';

export type AuthStatus = 'checking' | 'authenticated' | 'signed-out';
type AuthContextValue = {
  status: AuthStatus;
  user: LightOpsUser | null;
  busy: boolean;
  error: string | null;
  signIn: (returnTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  globalSignOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useLightOpsAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useLightOpsAuth must be used inside LightOpsAuthProvider');
  return value;
}

export function LightOpsAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [user, setUser] = useState<LightOpsUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operation = useRef<Promise<void> | null>(null);

  const publish = useCallback(async (candidate: LightOpsUser | null) => {
    if (candidate) {
      await startSyncOutbox();
      setUser(candidate);
      setStatus('authenticated');
    } else {
      stopSyncOutbox();
      setUser(null);
      setStatus('signed-out');
    }
  }, []);

  useEffect(() => {
    let active = true;
    void loadSignedInUser()
      .then((candidate) => {
        if (active) return publish(candidate);
      })
      .catch(() => {
        if (active) return publish(null);
      });
    return () => {
      active = false;
    };
  }, [publish]);

  const run = useCallback((work: () => Promise<void>) => {
    if (operation.current) return operation.current;
    setBusy(true);
    setError(null);
    operation.current = work()
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : 'Authentication failed');
      })
      .finally(() => {
        operation.current = null;
        setBusy(false);
      });
    return operation.current;
  }, []);

  const signIn = useCallback(
    (returnTo = '/') => run(async () => publish(await signInClient(returnTo))),
    [publish, run],
  );
  const signOut = useCallback(
    () =>
      run(async () => {
        await signOutClient();
        await publish(null);
      }),
    [publish, run],
  );
  const globalSignOut = useCallback(
    () =>
      run(async () => {
        await globalSignOutClient();
        await publish(null);
      }),
    [publish, run],
  );

  const value = useMemo(
    () => ({ status, user, busy, error, signIn, signOut, globalSignOut }),
    [status, user, busy, error, signIn, signOut, globalSignOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
