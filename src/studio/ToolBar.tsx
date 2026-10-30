import { useTranslation } from 'react-i18next';
import type { Op } from '../fold/ops';
import { PRESETS, type PresetKind } from '../fold/presets';
import { ACTIONS, FACE_ACTIONS, LINE_ACTIONS, TAPE_WIDTHS, type Layers } from './tools';
import type { Tools } from './useTools';

/**
 * The Studio's bottom bar: what the next step does and how (the action, its fold line and settings), keeping it
 * as part of a step or applying it, and the steps that need no picks.
 */
export function ToolBar({ tools, sheets, canUndo, unfoldable, onHold, onApply, onNow, onUndo }: {
  tools: Tools;
  /** How many sheets the model has. */
  sheets: number;
  canUndo: boolean;
  /** There's a fold to unfold. */
  unfoldable: boolean;
  onHold(): void;
  onApply(): void;
  /** Makes a step that needs no picks. */
  onNow(op: Op): void;
  onUndo(): void;
}) {
  const { t } = useTranslation();
  const { s, set } = tools;
  return (
        <footer className="bottombar studio-bar">
          <div className="group">
            <div className="segmented" role="group" aria-label={t('studio.actions.action')}>
              {ACTIONS.filter((a) => a !== 'move' || tools.many).map((a) => (
                <button key={a} type="button" aria-pressed={s.action === a} title={t(`studio.actions.${a}Title`)} onClick={() => tools.switchAction(a)}>
                  {t(`studio.actions.${a}`)}
                </button>
              ))}
            </div>
            {tools.many && s.action !== 'popUp' && s.action !== 'draw' && s.action !== 'tape' && (
              <label className="field inline" title={t('studio.sheetTitle')}>
                <span>{t('studio.sheet')}</span>
                <select value={String(s.sheet)} onChange={(e) => set({ sheet: e.target.value === 'all' ? 'all' : Number(e.target.value) })}>
                  <option value="all">{s.action === 'move' ? t('studio.choose') : t('studio.all')}</option>
                  {Array.from({ length: sheets }, (_, i) => (
                    <option key={i} value={i}>
                      {t('studio.sheetN', { n: i + 1 })}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {s.action === 'preset' && (
              <label className="field inline">
                <span>{t('studio.presetLabel')}</span>
                <select value={s.preset} onChange={(e) => set({ preset: e.target.value as PresetKind, picks: [], flipped: false })}>
                  {PRESETS.map((p) => (
                    <option key={p} value={p}>
                      {t(`studio.steps.${p}`)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {s.action === 'tape' && (
              <label className="field inline">
                <span>{t('studio.tapeWidth')}</span>
                <select value={s.tapeWidth} onChange={(e) => set({ tapeWidth: Number(e.target.value) })}>
                  {/* A width a step was made with that isn't one of these stays choosable. */}
                  {(TAPE_WIDTHS.includes(s.tapeWidth) ? TAPE_WIDTHS : [...TAPE_WIDTHS, s.tapeWidth]).map((w, i) => (
                    <option key={w} value={w}>
                      {t(`studio.tapeWidths.${['narrow', 'normal', 'wide'][i] ?? 'other'}`)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {s.action === 'move' && (
              <>
                <label className="field inline">
                  <span>{t('studio.turn')}</span>
                  <select value={s.turn} onChange={(e) => set({ turn: Number(e.target.value) })}>
                    {[0, 45, 90, 135, 180, -135, -90, -45].map((d) => (
                      <option key={d} value={d}>
                        {d === 0 ? t('studio.none') : t(d > 0 ? 'studio.anticlockwise' : 'studio.clockwise', { deg: Math.abs(d) })}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field inline">
                  <input type="checkbox" checked={s.overturn} onChange={(e) => set({ overturn: e.target.checked })} />
                  <span>{t('studio.turnOver')}</span>
                </label>
                <label className="field inline">
                  <input type="checkbox" checked={s.underneath} onChange={(e) => set({ underneath: e.target.checked })} />
                  <span>{t('studio.underneath')}</span>
                </label>
              </>
            )}
            {LINE_ACTIONS.includes(s.action) && (
            <div className="segmented" role="group" aria-label={t('studio.foldLine')}>
              <button type="button" aria-pressed={s.tool === 'onto'} onClick={() => (set({ tool: 'onto' }), tools.startOver())}>
                {t('studio.pointToPoint')}
              </button>
              <button type="button" aria-pressed={s.tool === 'through'} onClick={() => (set({ tool: 'through' }), tools.startOver())}>
                {t('studio.throughTwo')}
              </button>
              <button type="button" aria-pressed={s.tool === 'edges'} title={t('studio.edgeToEdgeTitle')} onClick={() => (set({ tool: 'edges' }), tools.startOver())}>
                {t('studio.edgeToEdge')}
              </button>
            </div>
            )}
            {s.action === 'fold' && (
              <div className="segmented" role="group" aria-label={t('studio.foldType')}>
                <button type="button" aria-pressed={s.kind === 'valley'} title={t('studio.valleyTitle')} onClick={() => set({ kind: 'valley' })}>
                  {t('studio.valley')}
                </button>
                <button type="button" aria-pressed={s.kind === 'mountain'} title={t('studio.mountainTitle')} onClick={() => set({ kind: 'mountain' })}>
                  {t('studio.mountain')}
                </button>
              </div>
            )}
            {s.action === 'reverse' && (
              <div className="segmented" role="group" aria-label={t('studio.reverseFold')}>
                <button type="button" aria-pressed={s.reverseKind === 'inside'} title={t('studio.insideTitle')} onClick={() => set({ reverseKind: 'inside' })}>
                  {t('studio.inside')}
                </button>
                <button type="button" aria-pressed={s.reverseKind === 'outside'} title={t('studio.outsideTitle')} onClick={() => set({ reverseKind: 'outside' })}>
                  {t('studio.outside')}
                </button>
              </div>
            )}
            {s.action === 'collapse' && (
              <div className="segmented" role="group" aria-label={t('studio.crease')}>
                <button type="button" aria-pressed={s.creaseKind === 'valley'} title={t('studio.creaseValley')} onClick={() => set({ creaseKind: 'valley' })}>
                  {t('studio.valley')}
                </button>
                <button type="button" aria-pressed={s.creaseKind === 'mountain'} title={t('studio.creaseMountain')} onClick={() => set({ creaseKind: 'mountain' })}>
                  {t('studio.mountain')}
                </button>
                <button type="button" aria-pressed={s.creaseKind === 'flat'} title={t('studio.openTitle')} onClick={() => set({ creaseKind: 'flat' })}>
                  {t('studio.openCrease')}
                </button>
              </div>
            )}
            {s.action === 'collapse' && tools.many && (
              <label className="field inline" title={t('studio.slideUnderTitle')}>
                <span>{t('studio.slideUnder')}</span>
                <select value={s.tuck === null ? '' : String(s.tuck)} onChange={(e) => set({ tuck: e.target.value === '' ? null : Number(e.target.value) })}>
                  <option value="">{t('studio.nothing')}</option>
                  {Array.from({ length: sheets }, (_, i) => (
                    <option key={i} value={i}>
                      {t('studio.sheetN', { n: i + 1 })}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {s.action === 'lift' && (
              <label className="field inline">
                <span>{t('studio.angle')}</span>
                <input type="range" min={10} max={170} step={5} value={s.angle} onChange={(e) => set({ angle: Number(e.target.value) })} />
                <span className="angle">{s.angle}°</span>
              </label>
            )}
            {s.action === 'lift' && (
              <label className="field inline" title={t('studio.curlTitle')}>
                <span>{t('studio.curl')}</span>
                <select value={s.segments} onChange={(e) => set({ segments: Number(e.target.value) })}>
                  <option value={1}>{t('studio.curls.none')}</option>
                  <option value={3}>{t('studio.curls.gentle')}</option>
                  <option value={6}>{t('studio.curls.smooth')}</option>
                  <option value={10}>{t('studio.curls.smoother')}</option>
                </select>
              </label>
            )}
            {s.action === 'lift' && (
              <>
                <label className="field inline" title={t('studio.cornersTitle')}>
                  <input type="checkbox" checked={s.corners} onChange={(e) => set({ corners: e.target.checked })} />
                  <span>{t('studio.corners')}</span>
                </label>
                <label className="field inline" title={t('studio.chainedTitle')}>
                  <input type="checkbox" checked={s.chained} onChange={(e) => (set({ chained: e.target.checked }), set({ anchorPick: null }))} />
                  <span>{t('studio.chained')}</span>
                </label>
                {s.chained && (
                  <button type="button" className="secondary" aria-pressed={s.pickMode === 'anchor'} onClick={() => set({ pickMode: s.pickMode === 'anchor' ? 'points' : 'anchor' })}>
                    {t('studio.stayPut')}
                  </button>
                )}
              </>
            )}
            {s.action === 'popUp' && (
              <>
                <label className="field inline">
                  <span>{t('studio.popCreases')}</span>
                  <select value={s.rays} onChange={(e) => set({ rays: Number(e.target.value) })}>
                    {[4, 6, 8].map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field inline" title={t('studio.steepTitle')}>
                  <span>{t('studio.steep')}</span>
                  <input type="range" min={10} max={85} step={1} value={s.steep} onChange={(e) => set({ steep: Number(e.target.value) })} />
                  <span className="angle">{s.steep}°</span>
                </label>
              </>
            )}
            {s.action === 'draw' && (
              <div className="segmented" role="group" aria-label={t('studio.markType')}>
                <button type="button" aria-pressed={!s.fill} onClick={() => set({ fill: false })}>
                  {t('studio.markLine')}
                </button>
                <button type="button" aria-pressed={s.fill} onClick={() => set({ fill: true })}>
                  {t('studio.markFill')}
                </button>
              </div>
            )}
            {FACE_ACTIONS.includes(s.action) && (
            <label className="field inline">
              <span>{t('studio.layers')}</span>
              <select value={String(s.layers)} onChange={(e) => set({ layers: e.target.value === 'all' ? 'all' : (Number(e.target.value) as Layers) })}>
                <option value="all">{t('studio.all')}</option>
                {[1, 2, 3].map((k) => (
                  <option key={k} value={k}>
                    {t('studio.topN', { n: k })}
                  </option>
                ))}
              </select>
            </label>
            )}
            {FACE_ACTIONS.includes(s.action) && (
              <button
                type="button"
                className="secondary"
                aria-pressed={s.pickMode === 'faces'}
                title={t('studio.pickFacesTitle')}
                onClick={() => set({ pickMode: s.pickMode === 'faces' ? 'points' : 'faces' })}
              >
                {s.picked.length ? t('studio.facesPicked', { count: s.picked.length }) : t('studio.pickFaces')}
              </button>
            )}
            {FACE_ACTIONS.includes(s.action) && s.picked.length > 0 && (
              <button type="button" className="link small" onClick={() => set({ picked: [] })}>
                {t('studio.allFaces')}
              </button>
            )}
            {LINE_ACTIONS.includes(s.action) && (
            <button type="button" className="secondary" disabled={!tools.line} onClick={() => set({ flipped: !s.flipped })} title={t('studio.flipTitle')}>
              {t('studio.flipSide')}
            </button>
            )}
            {s.action === 'preset' && s.preset !== 'squash' && s.preset !== 'petal' && (
              <button type="button" className="secondary" disabled={!tools.op} aria-pressed={s.flipped} onClick={() => set({ flipped: !s.flipped })} title={t('studio.otherWayTitle')}>
                {t('studio.otherWay')}
              </button>
            )}
            {s.action === 'collapse' && (
              <>
                <button type="button" className="secondary" disabled={!tools.line} onClick={tools.addCrease} title={t('studio.addCreaseTitle')}>
                  {t('studio.addCrease')}
                </button>
                <button type="button" className="secondary" disabled={!s.creases.length} onClick={() => set({ creases: [] })}>
                  {t('studio.clearCreases')}
                </button>
              </>
            )}
            {s.action === 'lift' && (
              <>
                <button type="button" className="secondary" disabled={!tools.line} onClick={tools.addBend} title={t('studio.addBendTitle')}>
                  {t('studio.addBend')}
                </button>
                <button type="button" className="secondary" disabled={!s.bends.length} onClick={() => set({ bends: [] })}>
                  {t('studio.clearBends')}
                </button>
              </>
            )}
            {s.action === 'draw' && (
              <>
                <button type="button" className="secondary" disabled={!tools.mark} onClick={tools.addMark} title={t('studio.addMarkTitle')}>
                  {t('studio.addMark')}
                </button>
                <button type="button" className="secondary" disabled={!s.marks.length} onClick={() => set({ marks: [] })}>
                  {t('studio.clearMarks')}
                </button>
              </>
            )}
            <button type="button" className="secondary" disabled={!tools.preview} onClick={onHold} title={t('studio.holdTitle')}>
              {t('studio.hold')}
            </button>
            <button
              type="button"
              className="primary"
              disabled={!tools.preview}
              onClick={onApply}
              title={s.action === 'collapse' ? t('studio.collapseTitle') : t('studio.applyTitle')}
            >
              {t(`studio.apply.${s.action}`)}
            </button>
          </div>
          <div className="group">
            <button type="button" className="secondary" onClick={() => onNow({ op: 'turnOver' })}>
              {t('studio.turnOverButton')}
            </button>
            <button type="button" className="secondary" onClick={() => onNow({ op: 'rotate', degrees: 90 })}>
              {t('studio.rotate')}
            </button>
            <button type="button" className="secondary" disabled={!unfoldable} onClick={() => unfoldable && onNow({ op: 'unfold' })}>
              {t('studio.unfold')}
            </button>
            <button type="button" className="secondary" onClick={() => onNow({ op: 'newSheet' })} title={t('studio.newSheetTitle')}>
              {t('studio.newSheet')}
            </button>
            <button type="button" className="secondary" disabled={!canUndo} onClick={onUndo} title={t('studio.undoTitle')}>
              {t('studio.undo')}
            </button>
          </div>
        </footer>
  );
}
