import { useParams } from 'react-router';
import { findModel } from '../gallery/catalog';
import { loadModel } from '../models';
import { ModelViewer } from '../viewer/ModelViewer';
import { NotFound } from './NotFound';

/** A built-in model, from the gallery. */
export function Learn() {
  const { modelId } = useParams();
  const info = findModel(modelId);
  if (!info) return <NotFound />;
  // Models without steps yet show a plain sheet and a "coming soon" note.
  const load = info.steps ? () => loadModel(info.id)! : null;
  return <ModelViewer key={info.id} progressKey={info.id} title={info.title} load={load} />;
}
