import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';

/**
 * A quiet "← Back" at the top of the reading pages (privacy, licences). It goes back to wherever the reader came
 * from in the app; opened straight from a link or a bookmark, with nowhere in the app to go back to, it goes to the gallery.
 */
export function BackLink() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // React Router gives the first page of a visit the key 'default', so anything else has an in-app page behind it.
  const canGoBack = useLocation().key !== 'default';
  const onClick = (e: MouseEvent) => {
    if (!canGoBack || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(-1);
  };
  return (
    <Link to="/" className="back-link" onClick={onClick}>
      <span aria-hidden="true">←</span> {t('common.back')}
    </Link>
  );
}
