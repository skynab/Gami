import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { TopBar } from '../app/TopBar';
import { AccountButton } from '../auth/AccountButton';
import { supabase, useAuth } from '../auth/store';
import { modelsToReview, review, type SavedModel } from '../cloud/models';

interface Request {
  user_id: string;
  message: string;
  created_at: string;
  name: string;
}

/**
 * For admins: models submitted for the gallery, and people asking to become creators. The database checks
 * the caller is an admin for every action here, so this page is only a convenience.
 */
export default function Admin() {
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
    setRequests(data.map((r) => ({ ...r, name: names.get(r.user_id) || 'Someone' })));
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
      <TopBar center="Admin" end={<AccountButton />} />
      <main className="gallery">
        {status !== 'signed-in' || role !== 'admin' ? (
          <p className="muted">{status === 'loading' || (status === 'signed-in' && !role) ? 'Checking your account…' : 'This page is for admins.'}</p>
        ) : (
          <>
            <ReviewQueue />
            <h1>Creator requests</h1>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            {!requests ? (
              <p className="muted">Loading…</p>
            ) : requests.length === 0 ? (
              <p className="muted">Nobody is waiting. 🎉</p>
            ) : (
              <ul className="requests">
                {requests.map((r) => (
                  <li key={r.user_id}>
                    <div>
                      <strong>{r.name}</strong> <span className="muted small">asked {new Date(r.created_at).toLocaleDateString()}</span>
                      {r.message && <p className="small">{r.message}</p>}
                    </div>
                    <div className="request-actions">
                      <button type="button" className="primary small-button" onClick={() => void decide(r.user_id, true)}>
                        Approve
                      </button>
                      <button type="button" className="secondary" onClick={() => void decide(r.user_id, false)}>
                        Decline
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
            Back to the gallery
          </Link>
        </p>
      </main>
    </div>
  );
}

/** Submitted models: preview, then publish or send back with a note. */
function ReviewQueue() {
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
      <h1>Models to review</h1>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {!models && !error && <p className="muted">Loading…</p>}
      {models?.length === 0 && <p className="muted">No models are waiting.</p>}
      {models && models.length > 0 && (
        <ul className="requests">
          {models.map((m) => (
            <li key={m.id}>
              <div className="stack">
                <div>
                  <strong>{m.title}</strong> <span className="muted small">{m.model.steps.length} steps</span>
                </div>
                <Link to={`/m/${m.id}`} target="_blank" className="small">
                  Preview it in the viewer
                </Link>
                <label className="field">
                  <span>Note to the creator (shown if you send it back)</span>
                  <textarea rows={2} value={notes[m.id] ?? ''} onChange={(e) => setNotes({ ...notes, [m.id]: e.target.value })} />
                </label>
              </div>
              <div className="request-actions">
                <button type="button" className="primary small-button" onClick={() => void decide(m.id, true)}>
                  Publish
                </button>
                <button type="button" className="secondary" onClick={() => void decide(m.id, false)}>
                  Send back
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
