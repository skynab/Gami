import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Modal } from '../app/Modal';
import { useAuth } from './store';

/**
 * Sign in, or the signed-in person's menu. Shows nothing on sites without accounts set up.
 */
export function AccountButton() {
  const { t } = useTranslation();
  const status = useAuth((s) => s.status);
  const [signingIn, setSigningIn] = useState(false);

  if (status === 'off' || status === 'loading') return null;
  if (status === 'signed-out') {
    return (
      <>
        <button type="button" className="secondary" onClick={() => setSigningIn(true)}>
          {t('common.signIn')}
        </button>
        {signingIn && <SignInDialog onClose={() => setSigningIn(false)} />}
      </>
    );
  }
  return <AccountMenu />;
}

function AccountMenu() {
  const { t } = useTranslation();
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

  const label = name || email || t('account.you');
  return (
    <div className="account" ref={box}>
      <button type="button" className="avatar" aria-haspopup="menu" aria-expanded={open} aria-label={t('account.account', { name: label })} onClick={() => setOpen(!open)}>
        {label.slice(0, 1).toUpperCase()}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <strong>{label}</strong>
            {email && email !== label && <span className="muted small">{email}</span>}
            {role && <span className="role">{t(`account.roles.${role}`)}</span>}
          </div>
          {role === 'learner' && (
            <Link role="menuitem" to="/studio" onClick={() => setOpen(false)}>
              {t('account.become')}
            </Link>
          )}
          {(role === 'creator' || role === 'admin') && (
            <Link role="menuitem" to="/studio" onClick={() => setOpen(false)}>
              {t('common.studio')}
            </Link>
          )}
          {role === 'admin' && (
            <Link role="menuitem" to="/admin" onClick={() => setOpen(false)}>
              {t('account.review')}
            </Link>
          )}
          <button type="button" role="menuitem" onClick={() => void useAuth.getState().signOut()}>
            {t('account.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}

/** Email sign-in: no password, just a link. */
export function SignInDialog({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | { error: string }>('idle');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    const error = await useAuth.getState().sendLink(email.trim());
    setState(error ? { error } : 'sent');
  };

  return (
    <Modal title={t('common.signIn')} onClose={onClose}>
      {state === 'sent' ? (
        <>
          <p>{t('account.checkEmail', { email })}</p>
          <form method="dialog">
            <button className="primary small-button">{t('account.ok')}</button>
          </form>
        </>
      ) : (
        <form onSubmit={(e) => void send(e)} className="stack">
          <p className="muted small">{t('account.noAccount')}</p>
          <label className="field">
            <span>{t('account.email')}</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {typeof state === 'object' && (
            <p className="error-text" role="alert">
              {state.error}
            </p>
          )}
          <button className="primary" disabled={state === 'sending'}>
            {state === 'sending' ? t('common.sending') : t('account.sendLink')}
          </button>
        </form>
      )}
    </Modal>
  );
}
