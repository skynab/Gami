import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PaperIcon } from '../app/icons';
import { TopBar } from '../app/TopBar';

export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="app">
      <TopBar />
      <main className="stage">
        <div className="stage-empty">
          <PaperIcon className="stage-icon" />
          <h1>{t('notFound.title')}</h1>
          <p className="muted">{t('notFound.text')}</p>
          <Link to="/" className="primary">
            {t('notFound.all')}
          </Link>
        </div>
      </main>
    </div>
  );
}
