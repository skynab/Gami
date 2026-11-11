import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { toFoldFile } from '../fold/fold-format';
import type { OrigamiModel } from '../fold/types';
import { designOf, putDesign } from '../studio/library';
import { openShared } from '../studio/share';
import { ModelViewer } from '../viewer/ModelViewer';

/** A short name for a link's text, to remember the reader's place in it by. */
function keyOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/**
 * A design shared by a link that carries it in the address (`/shared#…`, see studio/share.ts), folded again and
 * shown in the ordinary viewer, with a way to keep a copy in this browser's Studio library.
 */
export default function SharedDesign() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  // Read once: the viewer keeps the step in the address, which drops the part after `#`.
  const [text] = useState(() => location.hash.slice(1));
  // So it's put back each time, and reloading the page or copying its address still carries the design.
  useEffect(() => {
    // (The window's own address, which keeps the site's base path, as the router's doesn't.)
    if (text && !location.hash) window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${text}`);
  }, [location, text]);
  const opened = useRef<OrigamiModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => (opened.current = await openShared(text));

  const save = async () => {
    if (!opened.current) return;
    const design = designOf(toFoldFile(opened.current));
    if (!(await putDesign(design))) return setError(t('library.unavailable'));
    navigate(`/studio/${design.id}`);
  };

  const notice = (
    <>
      {t('notice.shared')}{' '}
      <button type="button" className="link" onClick={() => void save()}>
        {t('notice.saveCopy')}
      </button>
      {error && (
        <span className="error-text" role="alert">
          {' '}
          {error}
        </span>
      )}
    </>
  );
  return <ModelViewer key={text} progressKey={`shared-${keyOf(text)}`} title="" load={load} notice={notice} />;
}
