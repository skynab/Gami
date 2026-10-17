import { lazy, Suspense, useState } from 'react';
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
  const status = useAuth((s) => s.status);
  const role = useAuth((s) => s.role);

  if (status === 'signed-in' && (role === 'creator' || role === 'admin')) {
    return (
      <Suspense fallback={null}>
        <StudioEditor end={<AccountButton />} />
      </Suspense>
    );
  }

  return (
    <div className="app">
      <TopBar center="Studio" end={<AccountButton />} />
      <main className="stage">
        <div className="stage-empty">
          <StudioIcon className="stage-icon" />
          <h1>Design your own models</h1>
          <Gate />
          <Link to="/" className="muted small">
            Back to the gallery
          </Link>
        </div>
      </main>
    </div>
  );
}

function Gate() {
  const { status, role, request } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  if (status === 'off') return <p className="muted">Accounts aren’t set up on this site yet, so the Studio isn’t available.</p>;
  if (status === 'loading' || (status === 'signed-in' && !role)) return <p className="muted">Checking your account…</p>;
  if (status === 'signed-out') {
    return (
      <>
        <p className="muted">The Studio is for approved creators. Sign in to ask for access.</p>
        <button type="button" className="primary" onClick={() => setSigningIn(true)}>
          Sign in
        </button>
        {signingIn && <SignInDialog onClose={() => setSigningIn(false)} />}
      </>
    );
  }
  if (request === 'pending') return <p className="muted">Thanks for asking! Your request is waiting for an admin to look at it.</p>;
  if (request === 'declined') return <p className="muted">Your request wasn’t approved this time.</p>;
  return <AskForAccess />;
}

function AskForAccess() {
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
      <p className="muted">The Studio is for approved creators. Ask for access and an admin will review it.</p>
      <label className="field">
        <span>What would you like to make? (optional)</span>
        <textarea rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      {typeof state === 'object' && (
        <p className="error-text" role="alert">
          {state.error}
        </p>
      )}
      <button className="primary" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Ask to become a creator'}
      </button>
    </form>
  );
}
