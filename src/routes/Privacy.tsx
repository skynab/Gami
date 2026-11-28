import { useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { BackLink } from '../app/BackLink';
import { Footer } from '../app/Footer';
import { TopBar } from '../app/TopBar';
import { accountsEnabled } from '../auth/store';
import { CONTACT_EMAIL, DONATE_OPTIONS } from '../config';

/** The day the policy last changed in substance. Move it on with any change to what it says. */
export const PRIVACY_UPDATED = '2026-11-27';

/**
 * The privacy policy. It describes this build: the sections on accounts, reports and donations show only where
 * those are switched on, so a build without them (an app store build, say) says only what it does.
 */
export function Privacy() {
  const { t, i18n } = useTranslation();
  // Braces matter: browsers now return a Promise from scrollTo, which React would take for a clean-up function.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(PRIVACY_UPDATED));
  const sections = [
    'device',
    'hosting',
    ...(accountsEnabled ? ['accounts', 'reports'] : []),
    ...(DONATE_OPTIONS.length ? ['donate'] : []),
    'children',
    'rights',
  ];
  return (
    <div className="page">
      <TopBar />
      <main className="legal">
        <BackLink />
        <h1>{t('privacy.title')}</h1>
        <p className="muted">{t('privacy.updated', { date })}</p>
        {i18n.resolvedLanguage !== 'en' && <p className="muted small">{t('privacy.translation')}</p>}
        <p>{t('privacy.intro')}</p>
        {sections.map((s) => (
          <section key={s}>
            <h2>{t(`privacy.${s}Heading`)}</h2>
            {/* Without accounts, there's nothing for a child to sign up to. */}
            <p>{t(s === 'children' && !accountsEnabled ? 'privacy.childrenLocal' : `privacy.${s}`)}</p>
          </section>
        ))}
        <section>
          <h2>{t('privacy.contactHeading')}</h2>
          <p>
            {CONTACT_EMAIL ? (
              <Trans i18nKey="privacy.contact" values={{ email: CONTACT_EMAIL }} components={{ a: <a href={`mailto:${CONTACT_EMAIL}`} /> }} />
            ) : (
              t('privacy.noContact')
            )}
          </p>
        </section>
        <section>
          <h2>{t('privacy.changesHeading')}</h2>
          <p>{t('privacy.changes')}</p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
