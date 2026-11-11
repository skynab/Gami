import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Where it's remembered that this browser has seen the tour. */
const KEY = 'gami.studio.tour';

/** The tour's stops, each pointing at the elements marked `data-tour` with its name. */
const STOPS = ['paper', 'tools', 'steps', 'share'] as const;

/** Whether this browser has seen the tour; where storage is blocked, it's taken as seen rather than shown every visit. */
export function tourSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === 'seen';
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(KEY, 'seen');
  } catch {
    // Nowhere to remember it: it can be skipped again.
  }
}

/** The gap between the card and what it points at, and the screen's edge. */
const GAP = 12;

/**
 * A short tour of the Studio for a first visit: a card beside each part in turn (the paper, the tools, the steps,
 * folding and sharing), that part outlined. Skipping or finishing it remembers it's been seen; it can be shown again.
 */
export function StudioTour({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const [i, setI] = useState(0);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const stop = STOPS[i];
  const last = i === STOPS.length - 1;

  const close = () => {
    markSeen();
    onClose();
  };

  // Outlines the stop's part, and puts the card below it, or above, or over it, within the screen.
  useLayoutEffect(() => {
    const target = [...document.querySelectorAll<HTMLElement>(`[data-tour="${stop}"]`)].find((e) => e.getBoundingClientRect().height > 0);
    target?.classList.add('tour-target');
    target?.scrollIntoView({ block: 'nearest' });
    const place = () => {
      const c = card.current?.getBoundingClientRect();
      if (!c) return;
      const r = target?.getBoundingClientRect();
      const fit = (x: number, size: number, room: number) => Math.max(GAP, Math.min(x, room - size - GAP));
      if (!r) return setAt({ top: fit((innerHeight - c.height) / 2, c.height, innerHeight), left: fit((innerWidth - c.width) / 2, c.width, innerWidth) });
      const below = r.bottom + GAP;
      const above = r.top - GAP - c.height;
      const top = below + c.height <= innerHeight - GAP ? below : above >= GAP ? above : fit(r.top + GAP, c.height, innerHeight);
      setAt({ top, left: fit(r.left, c.width, innerWidth) });
    };
    place();
    window.addEventListener('resize', place);
    return () => {
      target?.classList.remove('tour-target');
      window.removeEventListener('resize', place);
    };
  }, [stop]);

  // Escape skips it, before the Studio's own keys see it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // Once the card is placed (a hidden button can't take focus).
  const placed = at !== null;
  useEffect(() => {
    if (placed) card.current?.querySelector<HTMLButtonElement>('button.primary')?.focus();
  }, [i, placed]);

  return (
    <div ref={card} className="tour" role="dialog" aria-labelledby="tour-title" style={at ? { top: at.top, left: at.left } : { visibility: 'hidden' }}>
      <p className="muted small">{t('tour.count', { n: i + 1, total: STOPS.length })}</p>
      <h2 id="tour-title">{t(`tour.${stop}.title` as const)}</h2>
      <p>{t(`tour.${stop}.text` as const)}</p>
      <div className="tour-actions">
        {!last && (
          <button type="button" className="link small" onClick={close}>
            {t('tour.skip')}
          </button>
        )}
        {i > 0 && (
          <button type="button" className="secondary" onClick={() => setI(i - 1)}>
            {t('tour.back')}
          </button>
        )}
        <button type="button" className="primary small-button" onClick={() => (last ? close() : setI(i + 1))}>
          {last ? t('tour.done') : t('tour.next')}
        </button>
      </div>
    </div>
  );
}
