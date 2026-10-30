import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { StudioIcon } from '../app/icons';
import { TopBar } from '../app/TopBar';
import { AccountButton, SignInDialog } from '../auth/AccountButton';
import { useAuth } from '../auth/store';
import { fromFoldFile, toFoldFile, type FoldFile } from '../fold/fold-format';
import { emptyModel, saveDraft, useDraft } from '../studio/draft';
import { designOf, getDesign, listDesigns, putDesign, removeDesign, type LocalDesign } from '../studio/library';
import { NotFound } from './NotFound';

const StudioEditor = lazy(() => import('./StudioEditor'));

/**
 * The Studio, for everyone: `/studio` lists the designs kept in this browser, `/studio/<id>` edits one. Signed-in
 * creators also save to the cloud; the database's row-level security is what actually guards saved models.
 */
export default function Studio() {
  const { id } = useParams();
  return id ? <DesignEditor key={id} id={id} /> : <Library />;
}

const useCreator = () => useAuth((s) => s.status === 'signed-in' && (s.role === 'creator' || s.role === 'admin'));

function DesignEditor({ id }: { id: string }) {
  const creator = useCreator();
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>(useDraft.getState().designId === id ? 'ready' : 'loading');

  useEffect(() => {
    if (useDraft.getState().designId === id) return;
    void getDesign(id).then((design) => {
      if (!design) return setState('missing');
      try {
        useDraft.getState().open(design);
        setState('ready');
      } catch {
        setState('missing');
      }
    });
  }, [id]);

  if (state === 'missing') return <NotFound />;
  if (state === 'loading') return null;
  return (
    <Suspense fallback={null}>
      <StudioEditor end={<AccountButton />} cloud={creator} />
    </Suspense>
  );
}

function download(file: FoldFile) {
  const blob = new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${file['gami:id'] || 'model'}.fold`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** The designs kept in this browser, newest change first, with what can be done to each. */
function Library() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [designs, setDesigns] = useState<LocalDesign[] | null | 'loading'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const reload = () => listDesigns().then(setDesigns);
  useEffect(() => {
    // Any change still waiting is written first, and the design is read afresh when opened again, so a rename
    // here isn't undone by an older copy left in the editor.
    void saveDraft().then(() => {
      useDraft.setState({ designId: null });
      return reload();
    });
  }, []);

  /** Adds a design to the library and opens it, or says why it couldn't. */
  const add = async (design: LocalDesign, go = true) => {
    if (!(await putDesign(design))) return setMessage(t('library.unavailable'));
    if (go) navigate(`/studio/${design.id}`);
    else await reload();
  };

  const create = () => void add(designOf(toFoldFile({ ...emptyModel(), title: t('library.untitled') })));

  const importFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      // Read through the model, so a file Gami can't fold is turned away here rather than in the editor.
      const file = toFoldFile(fromFoldFile(JSON.parse(await f.text()) as FoldFile));
      await add(designOf(file, { dirty: true }));
    } catch (e) {
      setMessage(t('studio.openFailed', { error: (e as Error).message }));
    }
  };

  /** Writes a change to a design's model (its title, say), keeping everything else about it. */
  const edit = (d: LocalDesign, patch: { title: string }, asNew = false) => {
    const file = toFoldFile({ ...fromFoldFile(d.file), ...patch });
    const updated = Date.now();
    return asNew
      ? add(designOf(file, { thumbnail: d.thumbnail, dirty: true }), false)
      : add({ ...d, file, title: patch.title, updated }, false);
  };

  const rename = (d: LocalDesign) => {
    const title = prompt(t('library.renamePrompt', { title: d.title }), d.title)?.trim();
    if (title && title !== d.title) void edit(d, { title });
  };

  const remove = async (d: LocalDesign) => {
    if (!confirm(t('library.deleteConfirm', { title: d.title }))) return;
    if (!(await removeDesign(d.id))) return setMessage(t('library.unavailable'));
    if (useDraft.getState().designId === d.id) useDraft.setState({ designId: null });
    await reload();
  };

  const date = (ms: number) => new Date(ms).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
  const blocked = designs === null;

  return (
    <div className="page">
      <TopBar center={t('common.studio')} end={<AccountButton />} />
      <main className="gallery library">
        <h1>{t('library.heading')}</h1>
        <p className="muted">{t('library.intro')}</p>
        <div className="library-actions">
          <button type="button" className="primary" disabled={blocked} onClick={create}>
            {t('library.new')}
          </button>
          <button type="button" className="secondary" disabled={blocked} onClick={() => picker.current?.click()}>
            {t('library.import')}
          </button>
          <input
            ref={picker}
            type="file"
            accept=".fold,.json"
            hidden
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        <p className="muted small">{t('library.where')}</p>
        {(message || blocked) && (
          <p className="error-text" role="alert">
            {message ?? t('library.unavailable')}
          </p>
        )}

        {Array.isArray(designs) && designs.length > 0 && (
          <ul className="grid">
            {designs.map((d) => (
              <li key={d.id}>
                <div className="card design-card">
                  <Link to={`/studio/${d.id}`} className="card-thumb">
                    {d.thumbnail ? (
                      <img src={`data:image/svg+xml;utf8,${encodeURIComponent(d.thumbnail)}`} alt="" />
                    ) : (
                      <StudioIcon className="placeholder" />
                    )}
                  </Link>
                  <div className="card-body">
                    <Link to={`/studio/${d.id}`} className="card-title">
                      <span>{d.title}</span>
                    </Link>
                    <p className="muted small">
                      {t('card.steps', { count: d.steps })} · {t('library.changed', { date: date(d.updated) })}
                    </p>
                    <div className="design-actions">
                      <Link to={`/mine/${d.id}`} className="secondary" title={t('library.foldItTitle')}>
                        {t('library.foldIt')}
                      </Link>
                      <button type="button" className="link small" onClick={() => void edit(d, { title: t('library.copyOf', { title: d.title }) }, true)}>
                        {t('library.duplicate')}
                      </button>
                      <button type="button" className="link small" onClick={() => rename(d)}>
                        {t('library.rename')}
                      </button>
                      <button type="button" className="link small" onClick={() => download(d.file)}>
                        {t('library.export')}
                      </button>
                      <button type="button" className="link small" onClick={() => void remove(d)}>
                        {t('library.delete')}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {Array.isArray(designs) && !designs.length && (
          <div className="empty">
            <p className="muted">{t('library.empty')}</p>
          </div>
        )}
        <CloudNote />
      </main>
    </div>
  );
}

/** For signed-in people who aren't creators yet: what creators get, and how to become one. */
function CloudNote() {
  const { t } = useTranslation();
  const { status, role, request } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  if (status === 'off' || status === 'loading' || role === 'creator' || role === 'admin' || (status === 'signed-in' && !role)) return null;
  return (
    <section className="library-cloud">
      <h2>{t('gate.heading')}</h2>
      {status === 'signed-out' ? (
        <>
          <p className="muted">{t('gate.signedOut')}</p>
          <button type="button" className="secondary" onClick={() => setSigningIn(true)}>
            {t('common.signIn')}
          </button>
          {signingIn && <SignInDialog onClose={() => setSigningIn(false)} />}
        </>
      ) : request === 'pending' ? (
        <p className="muted">{t('gate.pending')}</p>
      ) : request === 'declined' ? (
        <p className="muted">{t('gate.declined')}</p>
      ) : (
        <AskForAccess />
      )}
    </section>
  );
}

function AskForAccess() {
  const { t } = useTranslation();
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
      <p className="muted">{t('gate.ask')}</p>
      <label className="field">
        <span>{t('gate.askLabel')}</span>
        <textarea rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      {typeof state === 'object' && (
        <p className="error-text" role="alert">
          {state.error}
        </p>
      )}
      <button className="primary" disabled={state === 'sending'}>
        {state === 'sending' ? t('common.sending') : t('gate.askButton')}
      </button>
    </form>
  );
}
