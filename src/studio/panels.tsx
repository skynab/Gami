import { useTranslation } from 'react-i18next';
import { CATEGORIES, DIFFICULTIES, type About, type OrigamiModel, type Sheet } from '../fold/types';

/** The Studio's panels for the model as a whole: how the gallery describes it, and the paper it starts from. */

/** Sheet sizes to start from (names in `studio.sizes`). */
const SIZES = [
  { id: 'square', size: [1, 1] },
  { id: 'half', size: [0.5, 1] },
  { id: 'a4', size: [1, Math.SQRT2] },
] as const;
const sizeOf = (s: Sheet) => SIZES.find((o) => o.size[0] === s.size[0] && o.size[1] === s.size[1])?.id ?? 'other';

/** How the gallery will describe the model, kept in its file: a blurb, difficulty, category, minutes and its card. */
export function AboutPanel({ model, onChange }: { model: OrigamiModel; onChange(patch: Pick<OrigamiModel, 'about'> | Pick<OrigamiModel, 'card'>): void }) {
  const { t } = useTranslation();
  const about = model.about ?? {};
  const edit = <K extends keyof About>(key: K, value: About[K] | undefined) => {
    const { [key]: _, ...rest } = about;
    const next = value === undefined ? rest : { ...rest, [key]: value };
    onChange({ about: Object.keys(next).length ? next : undefined });
  };
  return (
    <details className="about">
      <summary>{t('studio.about.title')}</summary>
      <label className="field">
        <span>{t('studio.about.blurb')}</span>
        <textarea rows={2} maxLength={500} placeholder={t('studio.about.blurbHint')} value={about.blurb ?? ''} onChange={(e) => edit('blurb', e.target.value || undefined)} />
      </label>
      <div className="about-row">
        <label className="field">
          <span>{t('gallery.difficulty')}</span>
          <select value={about.difficulty ?? ''} onChange={(e) => edit('difficulty', e.target.value ? (Number(e.target.value) as About['difficulty']) : undefined)}>
            <option value="">{t('studio.about.unset')}</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {t('studio.about.difficultyN', { n: d })}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('gallery.category')}</span>
          <select value={about.category ?? ''} onChange={(e) => edit('category', (e.target.value || undefined) as About['category'])}>
            <option value="">{t('studio.about.unset')}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('studio.about.minutes')}</span>
          <input
            type="number"
            min={1}
            max={600}
            value={about.minutes ?? ''}
            onChange={(e) => edit('minutes', e.target.value && Number(e.target.value) > 0 ? Math.min(600, Math.round(Number(e.target.value))) : undefined)}
          />
        </label>
      </div>
      <label className="field" title={t('studio.about.cardTitle')}>
        <span>{t('studio.about.card')}</span>
        <select value={model.card ?? 'flat'} onChange={(e) => onChange({ card: e.target.value === 'finished' ? 'finished' : undefined })}>
          <option value="flat">{t('studio.about.cards.flat')}</option>
          <option value="finished">{t('studio.about.cards.finished')}</option>
        </select>
      </label>
    </details>
  );
}

/** The sheets a model starts from: their colours and size, and adding or removing sheets (before the first step). */
export function SheetsPanel({ sheets, locked, onChange }: { sheets: Sheet[]; locked: boolean; onChange(sheets: Sheet[]): void }) {
  const { t } = useTranslation();
  const edit = (i: number, patch: Partial<Sheet>) => onChange(sheets.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <fieldset className="sheets" disabled={locked}>
      <legend>{sheets.length === 1 ? t('studio.paper') : t('studio.paperSheets', { count: sheets.length })}</legend>
      {sheets.map((s, i) => (
        <div key={i} className="sheet-row">
          {sheets.length > 1 && <span className="small">{t('studio.sheetN', { n: i + 1 })}</span>}
          <input type="color" value={s.front} onChange={(e) => edit(i, { front: e.target.value })} title={t('studio.front')} aria-label={t('studio.frontColour', { n: i + 1 })} />
          <input type="color" value={s.back} onChange={(e) => edit(i, { back: e.target.value })} title={t('studio.back')} aria-label={t('studio.backColour', { n: i + 1 })} />
          <select
            value={sizeOf(s)}
            onChange={(e) => edit(i, { size: [...SIZES.find((o) => o.id === e.target.value)!.size] as [number, number] })}
            aria-label={t('studio.size', { n: i + 1 })}
          >
            {sizeOf(s) === 'other' && <option value="other">{`${s.size[0]} × ${s.size[1]}`}</option>}
            {SIZES.map((o) => (
              <option key={o.id} value={o.id}>
                {t(`studio.sizes.${o.id}`)}
              </option>
            ))}
          </select>
          {sheets.length > 1 && !locked && (
            <button type="button" className="link small" onClick={() => onChange(sheets.filter((_, j) => j !== i))}>
              {t('studio.remove')}
            </button>
          )}
        </div>
      ))}
      {locked ? (
        <p className="muted small">{t('studio.paperSet')}</p>
      ) : (
        <button type="button" className="link small" onClick={() => onChange([...sheets, { ...sheets.at(-1)!, origin: undefined }])}>
          {t('studio.addSheet')}
        </button>
      )}
    </fieldset>
  );
}
