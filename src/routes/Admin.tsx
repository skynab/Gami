import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { TopBar } from '../app/TopBar';
import { AccountButton } from '../auth/AccountButton';
import { supabase, useAuth } from '../auth/store';

interface Request {
  user_id: string;
  message: string;
  created_at: string;
  name: string;
}

/**
 * For admins: people asking to become creators. Approving gives them the creator role. The database checks
 * the caller is an admin (decide_creator_request), so this page is only a convenience.
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
      <TopBar center="Creator requests" end={<AccountButton />} />
      <main className="gallery">
        {status !== 'signed-in' || role !== 'admin' ? (
          <p className="muted">{status === 'loading' || (status === 'signed-in' && !role) ? 'Checking your account…' : 'This page is for admins.'}</p>
        ) : (
          <>
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
