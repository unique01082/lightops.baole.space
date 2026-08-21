import { Cloud, Globe2, LogIn, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLightOpsAuth } from '../auth/auth-context';

export function AccountButton() {
  const { t } = useTranslation();
  const { user, status, busy, error, signIn, signOut, globalSignOut } = useLightOpsAuth();
  const checking = status === 'checking';

  return (
    <div className="flex items-center gap-1" aria-busy={busy || checking}>
      <button
        type="button"
        onClick={() => void (user ? signOut() : signIn('/'))}
        disabled={busy || checking}
        aria-label={user ? t('account.signOut') : t('account.signIn')}
        title={error ?? undefined}
        className="flex max-w-44 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/65 disabled:opacity-40"
      >
        {user ? (
          <Cloud className="h-3.5 w-3.5 text-emerald-300" />
        ) : (
          <LogIn className="h-3.5 w-3.5" />
        )}
        <span className="truncate">
          {checking ? t('utilities.processing') : (user?.email ?? t('account.signIn'))}
        </span>
        {user && <LogOut className="h-3 w-3 shrink-0" />}
      </button>
      {user && (
        <button
          type="button"
          onClick={() => void globalSignOut()}
          disabled={busy}
          aria-label={t('account.globalSignOut')}
          title={t('account.globalSignOut')}
          className="rounded-full border border-white/10 bg-white/5 p-2 text-white/55 disabled:opacity-40"
        >
          <Globe2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
