import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Modal } from '../app/Modal';
import { SignInDialog } from '../auth/AccountButton';
import { accountsEnabled, useAuth } from '../auth/store';
import { LICENCE, submitDesign, type Ownership } from '../cloud/models';
import { useDraft } from './draft';

/**
 * Sending the design to the gallery, for anyone signed in (designing needs no account). The person certifies
 * whose design it is and how to credit it, and is told it's published under CC BY 4.0; an admin reviews it.
 * `status` shows where a submission stands, for people without the cloud panel (which shows it for creators).
 */
export function SubmitPanel({ status = true }: { status?: boolean }) {
  const { t } = useTranslation();
  const signedIn = useAuth((s) => s.status === 'signed-in');
  const cloud = useDraft((s) => s.cloud);
  const steps = useDraft((s) => s.model.steps.length);
  const [open, setOpen] = useState(false);
  if (!accountsEnabled) return null;

  const locked = cloud?.status === 'submitted' || cloud?.status === 'published';
  return (
    <section className="cloud" aria-label={t('submit.heading')}>
      {status && cloud && cloud.status !== 'draft' && (
        <>
          <div className="cloud-status">
            <strong>{t(`cloud.status.${cloud.status}`)}</strong>
          </div>
          {cloud.status === 'rejected' && cloud.reviewNote && <p className="review-note">“{cloud.reviewNote}”</p>}
        </>
      )}
      {locked ? (
        <p className="muted small">{cloud?.status === 'published' ? t('submit.published') : t('submit.inReview')}</p>
      ) : (
        <>
          <button type="button" className="secondary" disabled={!steps} onClick={() => setOpen(true)}>
            {cloud?.status === 'rejected' ? t('submit.again') : t('submit.button')}
          </button>
          {!steps && <p className="muted small">{t('submit.noSteps')}</p>}
        </>
      )}
      {open && (signedIn ? <SubmitDialog onClose={() => setOpen(false)} /> : <SignInFirst onClose={() => setOpen(false)} />)}
    </section>
  );
}

function SignInFirst({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const [signingIn, setSigningIn] = useState(false);
  if (signingIn) return <SignInDialog onClose={onClose} />;
  return (
    <Modal title={t('submit.heading')} onClose={onClose}>
      <p>{t('submit.signInFirst')}</p>
      <div className="request-actions">
        <button type="button" className="primary small-button" onClick={() => setSigningIn(true)}>
          {t('common.signIn')}
        </button>
        <form method="dialog">
          <button className="secondary">{t('common.close')}</button>
        </form>
      </div>
    </Modal>
  );
}

function SubmitDialog({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const name = useAuth((s) => s.name);
  const model = useDraft((s) => s.model);
  const cloud = useDraft((s) => s.cloud);
  const [ownership, setOwnership] = useState<Ownership | null>(null);
  const [credit, setCredit] = useState(name);
  const [firstPublished, setFirstPublished] = useState('');
  const [certified, setCertified] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | { error: string }>('idle');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownership) return;
    setState('sending');
    try {
      // The design becomes the cloud model it was sent as, so the Studio shows its review from now on.
      const saved = await submitDesign(model, { ownership, credit, firstPublished }, cloud?.id);
      useDraft.getState().fromCloud(saved);
      setState('sent');
    } catch (err) {
      setState({ error: (err as Error).message });
    }
  };

  if (state === 'sent') {
    return (
      <Modal title={t('submit.heading')} onClose={onClose}>
        <p>{t('submit.sent')}</p>
        <form method="dialog">
          <button className="primary small-button">{t('account.ok')}</button>
        </form>
      </Modal>
    );
  }
  return (
    <Modal title={t('submit.heading')} onClose={onClose}>
      <form className="stack" onSubmit={(e) => void send(e)}>
        <p className="muted small">{t('submit.intro', { title: model.title.trim() || t('library.untitled') })}</p>
        <fieldset className="choice">
          <legend>{t('submit.whose')}</legend>
          <label className="check">
            <input type="radio" name="ownership" required checked={ownership === 'own'} onChange={() => setOwnership('own')} />
            <span>{t('submit.own')}</span>
          </label>
          <label className="check">
            <input type="radio" name="ownership" checked={ownership === 'traditional'} onChange={() => setOwnership('traditional')} />
            <span>{t('submit.traditional')}</span>
          </label>
        </fieldset>
        <label className="field">
          <span>{ownership === 'traditional' ? t('submit.creditShared') : t('submit.credit')}</span>
          <input required maxLength={80} value={credit} onChange={(e) => setCredit(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('submit.firstPublished')}</span>
          <input maxLength={200} placeholder={t('submit.firstPublishedHint')} value={firstPublished} onChange={(e) => setFirstPublished(e.target.value)} />
        </label>
        <p className="small">
          <Trans i18nKey="submit.licence" values={{ licence: LICENCE.name }} components={{ a: <a href={LICENCE.url} target="_blank" rel="noreferrer" /> }} />
        </p>
        <label className="check">
          <input type="checkbox" required checked={certified} onChange={(e) => setCertified(e.target.checked)} />
          <span>{ownership === 'traditional' ? t('submit.certifyTraditional') : t('submit.certifyOwn')}</span>
        </label>
        {typeof state === 'object' && (
          <p className="error-text" role="alert">
            {state.error}
          </p>
        )}
        <div className="request-actions">
          <button className="primary small-button" disabled={state === 'sending' || !ownership || !certified || !credit.trim()}>
            {state === 'sending' ? t('common.sending') : t('submit.send')}
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            {t('submit.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
