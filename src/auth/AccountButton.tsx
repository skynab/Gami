import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Modal } from '../app/Modal';
import { useAuth } from './store';

const ROLE_LABEL = { learner: 'Learner', creator: 'Creator', admin: 'Admin' } as const;

/**
 * Sign in, or the signed-in person's menu. Shows nothing on sites without accounts set up.
 */
export function AccountButton() {
  const status = useAuth((s) => s.status);
  const [signingIn, setSigningIn] = useState(false);

  if (status === 'off' || status === 'loading') return null;
  if (status === 'signed-out') {
    return (
      <>
        <button type="button" className="secondary" onClick={() => setSigningIn(true)}>
          Sign in
        </button>
        {signingIn && <SignInDialog onClose={() => setSigningIn(false)} />}
      </>
    );
  }
  return <AccountMenu />;
}

function AccountMenu() {
  const { name, email, role } = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Close when clicking anywhere else, or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', away);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', away);
    };
  }, [open]);

  const label = name || email || 'You';
  return (
    <div className="account" ref={box}>
      <button type="button" className="avatar" aria-haspopup="menu" aria-expanded={open} aria-label={`Account: ${label}`} onClick={() => setOpen(!open)}>
        {label.slice(0, 1).toUpperCase()}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <strong>{label}</strong>
            {email && email !== label && <span className="muted small">{email}</span>}
            {role && <span className="role">{ROLE_LABEL[role]}</span>}
          </div>
          {role === 'learner' && (
            <Link role="menuitem" to="/studio" onClick={() => setOpen(false)}>
              Become a creator
            </Link>
          )}
          {(role === 'creator' || role === 'admin') && (
            <Link role="menuitem" to="/studio" onClick={() => setOpen(false)}>
              Studio
            </Link>
          )}
          {role === 'admin' && (
            <Link role="menuitem" to="/admin" onClick={() => setOpen(false)}>
              Creator requests
            </Link>
          )}
          <button type="button" role="menuitem" onClick={() => void useAuth.getState().signOut()}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** Email sign-in: no password, just a link. */
export function SignInDialog({ onClose }: { onClose(): void }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | { error: string }>('idle');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    const error = await useAuth.getState().sendLink(email.trim());
    setState(error ? { error } : 'sent');
  };

  return (
    <Modal title="Sign in" onClose={onClose}>
      {state === 'sent' ? (
        <>
          <p>Check your email. We sent a sign-in link to {email}.</p>
          <form method="dialog">
            <button className="primary small-button">OK</button>
          </form>
        </>
      ) : (
        <form onSubmit={(e) => void send(e)} className="stack">
          <p className="muted small">You don’t need an account to learn. Sign in to make your own models in the Studio.</p>
          <label className="field">
            <span>Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {typeof state === 'object' && (
            <p className="error-text" role="alert">
              {state.error}
            </p>
          )}
          <button className="primary" disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
          </button>
        </form>
      )}
    </Modal>
  );
}
