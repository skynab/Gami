import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DONATE_CURRENCY, DONATE_OPTIONS } from '../config';
import { HeartIcon } from './icons';
import { Modal } from './Modal';

/** Whether donations are set up. Without payment links the button stays hidden, except while developing. */
const canDonate = DONATE_OPTIONS.length > 0;
const showDonate = canDonate || import.meta.env.DEV;

/** Supporters come back from Stripe to /?thanks: take it out of the address bar and say thank you. */
function cameBackFromStripe() {
  const url = new URL(location.href);
  if (!url.searchParams.has('thanks')) return false;
  url.searchParams.delete('thanks');
  history.replaceState(history.state, '', url);
  return true;
}
let thanked = typeof location !== 'undefined' && cameBackFromStripe();

/** The Donate button at the end of the top bar, and its dialog. */
export function DonateButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<'donate' | 'thanks' | null>(() => (thanked ? 'thanks' : null));
  if (!showDonate) return null;
  const close = () => {
    thanked = false;
    setOpen(null);
  };
  return (
    <>
      <button type="button" className="donate-button" title={t('donate.button')} onClick={() => setOpen('donate')}>
        <HeartIcon width={18} height={18} />
        <span>{t('donate.button')}</span>
      </button>
      {open === 'donate' && <DonateDialog onClose={close} />}
      {open === 'thanks' && (
        <Modal title={t('donate.title')} onClose={close}>
          <p>{t('donate.thanks')}</p>
          <form method="dialog">
            <button className="primary small-button">{t('common.close')}</button>
          </form>
        </Modal>
      )}
    </>
  );
}

/**
 * The donation dialog. Payment itself happens on Stripe's hosted page (opened in a new tab), so the site
 * never handles card details.
 */
function DonateDialog({ onClose }: { onClose(): void }) {
  const { t, i18n } = useTranslation();
  const money = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'currency', currency: DONATE_CURRENCY, maximumFractionDigits: 0 });
  return (
    <Modal title={t('donate.title')} onClose={onClose}>
      <HeartIcon className="donate-heart" />
      <p>{t('donate.body')}</p>
      <div className="donate-options">
        {DONATE_OPTIONS.map((o) => (
          <a key={o.url} className={o.amount ? 'primary' : 'secondary'} href={o.url} target="_blank" rel="noopener noreferrer" onClick={onClose}>
            {o.amount ? money.format(o.amount) : t('donate.other')}
          </a>
        ))}
      </div>
      {canDonate ? (
        <p className="muted small">{t('donate.note')}</p>
      ) : (
        // Only reachable in development: tells the developer what to set. Not translated on purpose.
        <p className="muted small">
          No payment links are set, so this button is hidden on the live site. Add <code>VITE_DONATE_LINK_*</code> to{' '}
          <code>.env.local</code> (see <code>.env.example</code>).
        </p>
      )}
    </Modal>
  );
}
