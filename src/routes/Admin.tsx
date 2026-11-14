import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { TopBar } from '../app/TopBar';
import { AccountButton } from '../auth/AccountButton';
import { supabase, useAuth } from '../auth/store';
import { decideReport, LICENCE, modelsToReview, openReports, review, type Report, type SavedModel } from '../cloud/models';

interface Request {
  user_id: string;
  message: string;
  created_at: string;
  name: string;
}

/** Where admins check a submission isn't a known copyrighted design before publishing it. */
const KNOWN_DESIGNS = 'https://www.giladorigami.com/';

/**
 * For admins: models submitted for the gallery, reports about published ones, and people asking to become creators. The database checks
 * the caller is an admin for every action here, so this page is only a convenience.
 */
export default function Admin() {
  const { t } = useTranslation();
  const status = useAuth((s) => s.status);
  const role = useAuth((s) => s.role);
  const [requests, setRequests] = useState<Request[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = await supabase();
    const { data, error } = await sb.from('creator_requests').select('user_id, message, created_at').eq('status', 'pending').order('created_at');
    if (error) return setError(error.message);
    const ids = data.map((r) => r.user_id);
    const { data: people } = ids.length ? await sb.from('profiles').select('id, display_name').in('id', ids) : { data: [] };
    const names = new Map((people ?? []).map((p) => [p.id, p.display_name as string]));
    setRequests(data.map((r) => ({ ...r, name: names.get(r.user_id) || '' })));
  }, []);

  useEffect(() => {
    if (role === 'admin') void load();
  }, [role, load]);

  const decide = async (id: string, approve: boolean) => {
    const sb = await supabase();
    const { error } = await sb.rpc('decide_creator_request', { target: id, approve });
    if (error) setError(error.message);
    else setRequests((rs) => rs?.filter((r) => r.user_id !== id) ?? null);
  };

  return (
    <div className="page">
      <TopBar center={t('admin.title')} end={<AccountButton />} />
      <main className="gallery">
        {status !== 'signed-in' || role !== 'admin' ? (
          <p className="muted">{status === 'loading' || (status === 'signed-in' && !role) ? t('gate.checking') : t('admin.forAdmins')}</p>
        ) : (
          <>
            <ReviewQueue />
            <Reports />
            <h1>{t('admin.requests')}</h1>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            {!requests ? (
              <p className="muted">{t('common.loading')}</p>
            ) : requests.length === 0 ? (
              <p className="muted">{t('admin.nobody')}</p>
            ) : (
              <ul className="requests">
                {requests.map((r) => (
                  <li key={r.user_id}>
                    <div>
                      <strong>{r.name || t('admin.someone')}</strong> <span className="muted small">{t('admin.asked', { date: new Date(r.created_at).toLocaleDateString() })}</span>
                      {r.message && <p className="small">{r.message}</p>}
                    </div>
                    <div className="request-actions">
                      <button type="button" className="primary small-button" onClick={() => void decide(r.user_id, true)}>
                        {t('admin.approve')}
                      </button>
                      <button type="button" className="secondary" onClick={() => void decide(r.user_id, false)}>
                        {t('admin.decline')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <p>
          <Link to="/" className="muted small">
            {t('common.backToGallery')}
          </Link>
        </p>
      </main>
    </div>
  );
}

/** Submitted models: preview, then publish or send back with a note. */
function ReviewQueue() {
  const { t } = useTranslation();
  const [models, setModels] = useState<SavedModel[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    modelsToReview().then(setModels, (e: Error) => setError(e.message));
  }, []);

  const decide = async (id: string, publish: boolean) => {
    try {
      await review(id, publish, notes[id] ?? '');
      setModels((ms) => ms?.filter((m) => m.id !== id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section>
      <h1>{t('admin.review')}</h1>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <p className="muted small">
        {t('admin.checkKnown')}{' '}
        <a href={KNOWN_DESIGNS} target="_blank" rel="noreferrer">
          {t('admin.knownDesigns')}
        </a>
      </p>
      {!models && !error && <p className="muted">{t('common.loading')}</p>}
      {models?.length === 0 && <p className="muted">{t('admin.none')}</p>}
      {models && models.length > 0 && (
        <ul className="requests">
          {models.map((m) => (
            <li key={m.id}>
              <div className="stack">
                <div>
                  <strong>{m.title}</strong> <span className="muted small">{t('card.steps', { count: m.model.steps.length })}</span>
                </div>
                <Link to={`/m/${m.id}`} target="_blank" className="small">
                  {t('admin.preview')}
                </Link>
                <Certified model={m} />
                <label className="field">
                  <span>{t('admin.note')}</span>
                  <textarea rows={2} value={notes[m.id] ?? ''} onChange={(e) => setNotes({ ...notes, [m.id]: e.target.value })} />
                </label>
              </div>
              <div className="request-actions">
                <button type="button" className="primary small-button" onClick={() => void decide(m.id, true)}>
                  {t('admin.publish')}
                </button>
                <button type="button" className="secondary" onClick={() => void decide(m.id, false)}>
                  {t('admin.sendBack')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** What the submitter certified: whose design it is, the credit, where it was first published, and its licence. */
function Certified({ model }: { model: SavedModel }) {
  const { t } = useTranslation();
  const s = model.submission;
  if (!s) return <p className="error-text small">{t('admin.uncertified')}</p>;
  return (
    <p className="small">
      {s.ownership === 'own' ? t('credit.designedBy', { name: s.credit }) : t('credit.traditional', { name: s.credit })}
      {s.firstPublished && ` · ${t('credit.firstPublished', { where: s.firstPublished })}`} · {s.licence === LICENCE.id ? LICENCE.name : s.licence}
    </p>
  );
}

/** Reports about published models: dismiss, or unpublish the model, sending it back to its owner with a note. */
function Reports() {
  const { t } = useTranslation();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    openReports().then(setReports, (e: Error) => setError(e.message));
  }, []);

  const decide = async (r: Report, unpublish: boolean) => {
    try {
      await decideReport(r.id, unpublish, notes[r.id] ?? '');
      // Unpublishing settles every report about that model.
      setReports((rs) => rs?.filter((x) => x.id !== r.id && !(unpublish && x.model === r.model)) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section>
      <h1>{t('admin.reports')}</h1>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {!reports && !error && <p className="muted">{t('common.loading')}</p>}
      {reports?.length === 0 && <p className="muted">{t('admin.noReports')}</p>}
      {reports && reports.length > 0 && (
        <ul className="requests">
          {reports.map((r) => (
            <li key={r.id}>
              <div className="stack">
                <div>
                  <Link to={`/m/${r.model}`} target="_blank">
                    <strong>{r.title || t('library.untitled')}</strong>
                  </Link>{' '}
                  <span className="muted small">
                    {t(`report.reasons.${r.reason}`)} · {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {r.details && <p className="small">{r.details}</p>}
                {r.contact && <p className="muted small">{t('admin.contact', { contact: r.contact })}</p>}
                <label className="field">
                  <span>{t('admin.unpublishNote')}</span>
                  <textarea rows={2} value={notes[r.id] ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
                </label>
              </div>
              <div className="request-actions">
                <button type="button" className="primary small-button" onClick={() => void decide(r, true)}>
                  {t('admin.unpublish')}
                </button>
                <button type="button" className="secondary" onClick={() => void decide(r, false)}>
                  {t('admin.dismiss')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
