import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Modal } from '../app/Modal';
import { useAuth } from '../auth/store';
import { deleteModel, myModels, openModel, saveModel, shareLink, submitModel, type SavedModel, type Status } from '../cloud/models';
import { useDraft } from './draft';

const STATUS: Record<Status, string> = {
  draft: 'Draft',
  submitted: 'Waiting for review',
  published: 'Published in the gallery',
  rejected: 'Sent back for changes',
};

/**
 * Saving the Studio's model to the cloud: save, share a private link, submit it for the gallery, and open
 * other saved models. Models in review or published are locked; "Save as a copy" carries on from them.
 */
export function CloudPanel() {
  const model = useDraft((s) => s.model);
  const cloud = useDraft((s) => s.cloud);
  const dirty = useDraft((s) => s.dirty);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [browsing, setBrowsing] = useState(false);

  const locked = cloud?.status === 'submitted' || cloud?.status === 'published';

  // An admin may have reviewed it since it was opened here.
  const cloudId = cloud?.id;
  useEffect(() => {
    if (!cloudId) return;
    // If it can't be fetched (offline, say), carry on; saving will report any real problem.
    openModel(cloudId).then(
      (saved) => useDraft.getState().updateStatus(saved),
      () => {},
    );
  }, [cloudId]);
  const hasSteps = model.steps.length > 0;

  const run = async (what: () => Promise<string | void>) => {
    setBusy(true);
    setMessage(null);
    try {
      const done = await what();
      if (done) setMessage({ text: done });
    } catch (e) {
      setMessage({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  const save = (asCopy = false) =>
    run(async () => {
      const saved = await saveModel(model, asCopy ? undefined : cloud?.id);
      useDraft.getState().fromCloud(saved, false);
      return asCopy ? 'Saved as a new draft.' : 'Saved.';
    });

  const submit = () =>
    run(async () => {
      if (!cloud) return;
      useDraft.getState().fromCloud(await submitModel(cloud.id), false);
      return 'Sent to the admins. You’ll see here when it’s reviewed.';
    });

  const share = () =>
    run(async () => {
      if (!cloud?.shareToken) return;
      await navigator.clipboard.writeText(shareLink(cloud.shareToken));
      return 'Link copied. Anyone with it can view this model.';
    });

  return (
    <section className="cloud" aria-label="Saving">
      <div className="cloud-status">
        <strong>{cloud ? STATUS[cloud.status] : 'Not saved yet'}</strong>
        {cloud && dirty && !locked && <span className="muted small"> · unsaved changes</span>}
      </div>
      {cloud?.status === 'rejected' && cloud.reviewNote && <p className="review-note">“{cloud.reviewNote}”</p>}
      {locked && <p className="muted small">This model is locked while it’s {cloud?.status === 'published' ? 'published' : 'in review'}. Save a copy to keep working on it.</p>}

      <div className="cloud-actions">
        {locked ? (
          <button type="button" className="primary small-button" disabled={busy} onClick={() => void save(true)}>
            Save as a copy
          </button>
        ) : (
          <button type="button" className="primary small-button" disabled={busy || (!!cloud && !dirty)} onClick={() => void save()}>
            {cloud ? 'Save' : 'Save to my models'}
          </button>
        )}
        {cloud?.shareToken && (
          <button type="button" className="secondary" disabled={busy} onClick={() => void share()}>
            Copy share link
          </button>
        )}
        {cloud && (cloud.status === 'draft' || cloud.status === 'rejected') && (
          <button
            type="button"
            className="secondary"
            disabled={busy || dirty || !hasSteps}
            title={dirty ? 'Save your changes first' : !hasSteps ? 'Add some steps first' : 'Ask an admin to publish it in the gallery'}
            onClick={() => void submit()}
          >
            Submit for the gallery
          </button>
        )}
        <button type="button" className="secondary" onClick={() => setBrowsing(true)}>
          My models
        </button>
      </div>
      {message && (
        <p className={message.error ? 'error-text' : 'muted small'} role={message.error ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
      {browsing && <MyModels onClose={() => setBrowsing(false)} />}
    </section>
  );
}

function MyModels({ onClose }: { onClose(): void }) {
  const userId = useAuth((s) => s.userId);
  const [models, setModels] = useState<SavedModel[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    myModels(userId).then(setModels, (e: Error) => setError(e.message));
  }, [userId]);

  const open = (m: SavedModel) => {
    if (useDraft.getState().dirty && !confirm('Open this model? Unsaved changes to the current one will be lost.')) return;
    useDraft.getState().fromCloud(m, true);
    onClose();
  };

  const remove = async (m: SavedModel) => {
    if (!confirm(`Delete “${m.title}”? This can’t be undone.`)) return;
    try {
      await deleteModel(m.id);
      setModels((ms) => ms?.filter((x) => x.id !== m.id) ?? null);
      if (useDraft.getState().cloud?.id === m.id) useDraft.getState().detach();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Modal title="My models" onClose={onClose}>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {!models && !error && <p className="muted">Loading…</p>}
      {models?.length === 0 && <p className="muted">Nothing saved yet. Use “Save to my models” to keep a model here.</p>}
      {models && models.length > 0 && (
        <ul className="my-models">
          {models.map((m) => (
            <li key={m.id}>
              <div>
                <strong>{m.title}</strong>
                <span className="muted small">
                  {STATUS[m.status]} · {m.model.steps.length} steps
                </span>
              </div>
              <div className="request-actions">
                <button type="button" className="primary small-button" onClick={() => open(m)}>
                  Open
                </button>
                {m.status === 'published' && (
                  <Link className="secondary" to={`/m/${m.id}`}>
                    View
                  </Link>
                )}
                <button type="button" className="secondary" onClick={() => void remove(m)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form method="dialog">
        <button className="secondary">Close</button>
      </form>
    </Modal>
  );
}
