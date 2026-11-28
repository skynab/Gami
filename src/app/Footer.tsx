import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

/** The links at the bottom of the gallery and the other scrolling pages: questions, the privacy policy and the open-source notices. */
export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="footer">
      <nav aria-label={t('footer.label')}>
        <Link to="/faq">{t('footer.faq')}</Link>
        <Link to="/privacy">{t('footer.privacy')}</Link>
        <Link to="/licences">{t('footer.licences')}</Link>
      </nav>
    </footer>
  );
}
