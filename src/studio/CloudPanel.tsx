import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Modal } from '../app/Modal';
import { useAuth } from '../auth/store';
import { deleteModel, myModels, openModel, saveModel, shareLink, submitModel, type SavedModel, type Status } from '../cloud/models';
import { toFoldFile } from '../fold/fold-format';
import { cloudInfo, saveDraft, useDraft } from './draft';
import { designOf, listDesigns, putDesign } from './library';

const status = (s: Status) => `cloud.status.${s}` as const;

/**
 * Saving the Studio's model to the cloud: save, share a private link, submit it for the gallery, and open
 * other saved models. Models in review or published are locked; "Save as a copy" carries on from them.
 */
export function CloudPanel() {
  const { t } = useTranslation();
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
      useDraft.getState().fromCloud(saved);
      return asCopy ? t('cloud.savedCopy') : t('cloud.saved');
    });

  const submit = () =>
    run(async () => {
      if (!cloud) return;
      useDraft.getState().fromCloud(await submitModel(cloud.id));
      return t('cloud.sent');
    });

  const share = () =>
    run(async () => {
      if (!cloud?.shareToken) return;
      await navigator.clipboard.writeText(shareLink(cloud.shareToken));
      return t('cloud.copied');
    });

  return (
    <section className="cloud" aria-label={t('cloud.saving')}>
      <div className="cloud-status">
        <strong>{cloud ? t(status(cloud.status)) : t('cloud.notSaved')}</strong>
        {cloud && dirty && !locked && <span className="muted small">{t('cloud.unsaved')}</span>}
      </div>
      {cloud?.status === 'rejected' && cloud.reviewNote && <p className="review-note">“{cloud.reviewNote}”</p>}
      {locked && <p className="muted small">{cloud?.status === 'published' ? t('cloud.lockedPublished') : t('cloud.lockedReview')}</p>}

      <div className="cloud-actions">
        {locked ? (
          <button type="button" className="primary small-button" disabled={busy} onClick={() => void save(true)}>
            {t('cloud.saveCopy')}
          </button>
        ) : (
          <button type="button" className="primary small-button" disabled={busy || (!!cloud && !dirty)} onClick={() => void save()}>
            {cloud ? t('cloud.save') : t('cloud.saveFirst')}
          </button>
        )}
        {cloud?.shareToken && (
          <button type="button" className="secondary" disabled={busy} onClick={() => void share()}>
            {t('cloud.share')}
          </button>
        )}
        {cloud && (cloud.status === 'draft' || cloud.status === 'rejected') && (
          <button
            type="button"
            className="secondary"
            disabled={busy || dirty || !hasSteps}
            title={dirty ? t('cloud.saveChangesFirst') : !hasSteps ? t('cloud.addStepsFirst') : t('cloud.askAdmin')}
            onClick={() => void submit()}
          >
            {t('cloud.submit')}
          </button>
        )}
        <button type="button" className="secondary" onClick={() => setBrowsing(true)}>
          {t('cloud.myModels')}
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
  const { t } = useTranslation();
  const userId = useAuth((s) => s.userId);
  const [models, setModels] = useState<SavedModel[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    myModels(userId).then(setModels, (e: Error) => setError(e.message));
  }, [userId]);

  const navigate = useNavigate();

  /** Opens a cloud model as a design of its own: the one already made from it, or a new one. */
  const open = async (m: SavedModel) => {
    await saveDraft();
    const mine = (await listDesigns())?.find((d) => d.cloud?.id === m.id);
    const design = mine ?? designOf(toFoldFile(m.model), { cloud: cloudInfo(m), dirty: false });
    if (!mine && !(await putDesign(design))) return setError(t('library.unavailable'));
    onClose();
    navigate(`/studio/${design.id}`);
  };

  const remove = async (m: SavedModel) => {
    if (!confirm(t('cloud.deleteConfirm', { title: m.title }))) return;
    try {
      await deleteModel(m.id);
      setModels((ms) => ms?.filter((x) => x.id !== m.id) ?? null);
      if (useDraft.getState().cloud?.id === m.id) useDraft.getState().detach();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Modal title={t('cloud.myModels')} onClose={onClose}>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {!models && !error && <p className="muted">{t('common.loading')}</p>}
      {models?.length === 0 && <p className="muted">{t('cloud.nothingSaved')}</p>}
      {models && models.length > 0 && (
        <ul className="my-models">
          {models.map((m) => (
            <li key={m.id}>
              <div>
                <strong>{m.title}</strong>
                <span className="muted small">
                  {t(status(m.status))} · {t('card.steps', { count: m.model.steps.length })}
                </span>
              </div>
              <div className="request-actions">
                <button type="button" className="primary small-button" onClick={() => void open(m)}>
                  {t('cloud.open')}
                </button>
                {m.status === 'published' && (
                  <Link className="secondary" to={`/m/${m.id}`}>
                    {t('cloud.view')}
                  </Link>
                )}
                <button type="button" className="secondary" onClick={() => void remove(m)}>
                  {t('cloud.delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form method="dialog">
        <button className="secondary">{t('common.close')}</button>
      </form>
    </Modal>
  );
}
