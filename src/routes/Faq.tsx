import { useEffect, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { BackLink } from '../app/BackLink';
import { Footer } from '../app/Footer';
import { TopBar } from '../app/TopBar';
import { accountsEnabled } from '../auth/store';
import { CONTACT_EMAIL, DONATE_OPTIONS } from '../config';

/**
 * Questions people often have, linked from the footer. Like the privacy policy, it describes this build: answers about
 * accounts and donations change or appear only where those are switched on.
 */
export function Faq() {
  const { t } = useTranslation();
  // Braces matter: browsers now return a Promise from scrollTo, which React would take for a clean-up function.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const questions: { id: string; answer: ReactNode }[] = [
    { id: 'ages', answer: `${t('faq.agesA')}${accountsEnabled ? ` ${t('faq.agesAccounts')}` : ''}` },
    { id: 'account', answer: t(accountsEnabled ? 'faq.accountAccounts' : 'faq.accountA') },
    { id: 'offline', answer: t('faq.offlineA') },
    { id: 'paper', answer: t('faq.paperA') },
    { id: 'controls', answer: t('faq.controlsA') },
    { id: 'languages', answer: t('faq.languagesA') },
    ...(DONATE_OPTIONS.length ? [{ id: 'donate', answer: t('faq.donateA') }] : []),
    { id: 'privacy', answer: <Trans i18nKey="faq.privacyA" components={{ a: <Link to="/privacy" /> }} /> },
    {
      id: 'contact',
      answer: CONTACT_EMAIL ? (
        <Trans i18nKey="faq.contactA" values={{ email: CONTACT_EMAIL }} components={{ a: <a href={`mailto:${CONTACT_EMAIL}`} /> }} />
      ) : (
        t('faq.noContact')
      ),
    },
  ];
  return (
    <div className="page">
      <TopBar />
      <main className="legal">
        <BackLink />
        <h1>{t('faq.title')}</h1>
        {questions.map((q) => (
          <section key={q.id}>
            <h2>{t(`faq.${q.id}Q`)}</h2>
            <p>{q.answer}</p>
          </section>
        ))}
      </main>
      <Footer />
    </div>
  );
}
