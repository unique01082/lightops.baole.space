import { Cloud, LogIn, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadSignedInUser, signIn, signOut, type LightOpsUser } from '../../lib/auth-client';
import { startSyncOutbox, stopSyncOutbox } from '../../lib/sync-outbox';

export function AccountButton() {
  const { t } = useTranslation();
  const [user, setUser] = useState<LightOpsUser | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadSignedInUser()
      .then((signedInUser) => {
        setUser(signedInUser);
        if (signedInUser) startSyncOutbox(signedInUser);
      })
      .catch(() => setUser(null));
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      if (user) {
        await signOut();
        stopSyncOutbox();
        setUser(null);
      } else {
        const signedInUser = await signIn();
        setUser(signedInUser);
        startSyncOutbox(signedInUser);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={user ? t('account.signOut') : t('account.signIn')}
      className="flex max-w-44 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/65 disabled:opacity-40"
    >
      {user ? (
        <Cloud className="h-3.5 w-3.5 text-emerald-300" />
      ) : (
        <LogIn className="h-3.5 w-3.5" />
      )}
      <span className="truncate">{user?.email ?? t('account.signIn')}</span>
      {user && <LogOut className="h-3 w-3 shrink-0" />}
    </button>
  );
}
