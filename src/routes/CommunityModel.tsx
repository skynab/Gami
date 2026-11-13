import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { Modal } from '../app/Modal';
import { accountsEnabled } from '../auth/store';
import { LICENCE, openModel, openShared, REPORT_REASONS, reportModel, type ReportReason, type SavedModel, type Status } from '../cloud/models';
import { ModelViewer } from '../viewer/ModelViewer';
import { NotFound } from './NotFound';

/** Studio models that aren't in the gallery say so above the steps. */
const NOTICE: Partial<Record<Status, true>> = { draft: true, submitted: true, rejected: true };

/**
 * A model made in the Studio: `/m/:id` for published ones (or your own), `/s/:token` from a private link. A
 * published one says whose design it is and its licence, as submitted, with a way to report it.
 */
export function CommunityModel({ shared = false }: { shared?: boolean }) {
  const { t } = useTranslation();
  const { id = '', token = '' } = useParams();
  const [saved, setSaved] = useState<SavedModel | null>(null);
  if (!accountsEnabled) return <NotFound />;
  const key = shared ? `shared-${token}` : `community-${id}`;
  const load = () =>
    (shared ? openShared(token) : openModel(id)).then((s) => {
      setSaved(s);
      return s.model;
    });
  const notice = saved && (NOTICE[saved.status] ? t(`notice.${saved.status}`) : saved.status === 'published' && <Credit saved={saved} />);
  return <ModelViewer key={key} progressKey={key} title="" load={load} notice={notice || undefined} />;
}

/** Whose design a published model is, its licence, and Report. */
function Credit({ saved }: { saved: SavedModel }) {
  const { t } = useTranslation();
  const [reporting, setReporting] = useState(false);
  const s = saved.submission;
  return (
    <span className="credit">
      {s && (
        <>
          {s.ownership === 'own' ? t('credit.designedBy', { name: s.credit }) : t('credit.traditional', { name: s.credit })}
          {s.firstPublished && ` · ${t('credit.firstPublished', { where: s.firstPublished })}`}
          {' · '}
          <a href={LICENCE.url} target="_blank" rel="noreferrer">
            {LICENCE.name}
          </a>
          {' · '}
        </>
      )}
      <button type="button" className="link" onClick={() => setReporting(true)}>
        {t('report.button')}
      </button>
      {reporting && <ReportDialog id={saved.id} title={saved.title} onClose={() => setReporting(false)} />}
    </span>
  );
}

function ReportDialog({ id, title, onClose }: { id: string; title: string; onClose(): void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<ReportReason>('notTheirs');
  const [details, setDetails] = useState('');
  const [contact, setContact] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | { error: string }>('idle');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    try {
      await reportModel(id, reason, details, contact);
      setState('sent');
    } catch (err) {
      setState({ error: (err as Error).message });
    }
  };

  return (
    <Modal title={t('report.heading', { title })} onClose={onClose}>
      {state === 'sent' ? (
        <>
          <p>{t('report.thanks')}</p>
          <form method="dialog">
            <button className="primary small-button">{t('account.ok')}</button>
          </form>
        </>
      ) : (
        <form className="stack" onSubmit={(e) => void send(e)}>
          <fieldset className="choice">
            <legend>{t('report.why')}</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r} className="check">
                <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
                <span>{t(`report.reasons.${r}`)}</span>
              </label>
            ))}
          </fieldset>
          <label className="field">
            <span>{t('report.details')}</span>
            <textarea rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
          </label>
          <label className="field">
            <span>{t('report.contact')}</span>
            <input maxLength={200} value={contact} onChange={(e) => setContact(e.target.value)} />
          </label>
          <p className="muted small">{t('report.private')}</p>
          {typeof state === 'object' && (
            <p className="error-text" role="alert">
              {state.error}
            </p>
          )}
          <div className="request-actions">
            <button className="primary small-button" disabled={state === 'sending'}>
              {state === 'sending' ? t('common.sending') : t('report.send')}
            </button>
            <button type="button" className="secondary" onClick={onClose}>
              {t('submit.cancel')}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
