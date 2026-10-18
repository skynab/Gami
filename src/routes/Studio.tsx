import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { StudioIcon } from '../app/icons';
import { TopBar } from '../app/TopBar';
import { AccountButton, SignInDialog } from '../auth/AccountButton';
import { useAuth } from '../auth/store';

const StudioEditor = lazy(() => import('./StudioEditor'));

/**
 * The Studio, for creators. Everyone else sees why they can't use it yet and what to do about it.
 * This only decides what to show: the database's row-level security is what actually guards saved models.
 */
export default function Studio() {
  const { t } = useTranslation();
  const status = useAuth((s) => s.status);
  const role = useAuth((s) => s.role);

  if (status === 'signed-in' && (role === 'creator' || role === 'admin')) {
    return (
      <Suspense fallback={null}>
        <StudioEditor end={<AccountButton />} cloud />
      </Suspense>
    );
  }

  return (
    <div className="app">
      <TopBar center={t('common.studio')} end={<AccountButton />} />
      <main className="stage">
        <div className="stage-empty">
          <StudioIcon className="stage-icon" />
          <h1>{t('gate.heading')}</h1>
          <Gate />
          <Link to="/" className="muted small">
            {t('common.backToGallery')}
          </Link>
        </div>
      </main>
    </div>
  );
}

function Gate() {
  const { t } = useTranslation();
  const { status, role, request } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  if (status === 'off') return <p className="muted">{t('gate.off')}</p>;
  if (status === 'loading' || (status === 'signed-in' && !role)) return <p className="muted">{t('gate.checking')}</p>;
  if (status === 'signed-out') {
    return (
      <>
        <p className="muted">{t('gate.signedOut')}</p>
        <button type="button" className="primary" onClick={() => setSigningIn(true)}>
          {t('common.signIn')}
        </button>
        {signingIn && <SignInDialog onClose={() => setSigningIn(false)} />}
      </>
    );
  }
  if (request === 'pending') return <p className="muted">{t('gate.pending')}</p>;
  if (request === 'declined') return <p className="muted">{t('gate.declined')}</p>;
  return <AskForAccess />;
}

function AskForAccess() {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | { error: string }>('idle');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    const error = await useAuth.getState().askToCreate(message.trim());
    setState(error ? { error } : 'idle');
  };

  return (
    <form className="stack ask" onSubmit={(e) => void send(e)}>
      <p className="muted">{t('gate.ask')}</p>
      <label className="field">
        <span>{t('gate.askLabel')}</span>
        <textarea rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      {typeof state === 'object' && (
        <p className="error-text" role="alert">
          {state.error}
        </p>
      )}
      <button className="primary" disabled={state === 'sending'}>
        {state === 'sending' ? t('common.sending') : t('gate.askButton')}
      </button>
    </form>
  );
}
