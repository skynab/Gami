import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { fromFoldFile } from '../fold/fold-format';
import { getDesign } from '../studio/library';
import { ModelViewer } from '../viewer/ModelViewer';

/** A design from this browser's Studio library, folded in the ordinary viewer: `/mine/:id`. */
export function MyDesign() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const load = () =>
    getDesign(id).then((design) => {
      if (!design) throw new Error('Not in this browser’s library');
      return fromFoldFile(design.file);
    });
  const notice = (
    <>
      {t('notice.mine')} <Link to={`/studio/${id}`}>{t('notice.edit')}</Link>
    </>
  );
  return <ModelViewer key={id} progressKey={`mine-${id}`} title="" load={load} notice={notice} />;
}
