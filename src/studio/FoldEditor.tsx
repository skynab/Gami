import { useMemo, useRef, type PointerEvent } from 'react';
import { placeLike } from '../fold/fold';
import { dist, signedArea, split, type Line } from '../fold/geometry2d';
import { faceColour } from '../fold/sheets';
import type { FoldFrame, Mark, OrigamiModel, Vec2 } from '../fold/types';
import { cutsOnTable, frontUp, isPicked, markOnTable, project, snapPoints, viewBox } from './editor';

/**
 * The paper seen from above, as you'd see it on the table. Click the dots to place a fold: the crease
 * shows as a line, the side that moves is shaded, and a dashed outline shows where it will land.
 * Scissor cuts made so far show as solid lines, and what's been drawn on the paper as thin ones.
 */
export function FoldEditor({ frame, model, picks, labels = ['A', 'B'], line, kind, preview, extra = [], cut = null, free = false, marks = [], drawing = [], faces: picked, anchor = null, onPick, onFace }: {
  frame: FoldFrame;
  model: Pick<OrigamiModel, 'sheets'>;
  picks: Vec2[];
  /** What to call each pick. */
  labels?: string[];
  line: Line | null;
  kind: 'valley' | 'mountain';
  /** The paper after the fold, when the fold is possible. */
  preview: FoldFrame | null;
  /** More creases to draw, such as the ones waiting in a collapse. */
  extra?: { line: Line; kind: string }[];
  /** A cut about to be made, from one end to the other. */
  cut?: [Vec2, Vec2] | null;
  /** Picks can go anywhere, snapping to a dot only when one is close. */
  free?: boolean;
  /** What's drawn on the paper so far. */
  marks?: Mark[];
  /** Marks about to be drawn, as points on the table. */
  drawing?: { points: Vec2[]; fill: boolean }[];
  /** Picking faces: clicks go to `onFace`, and the faces in these outlines on the sheet are shown picked. */
  faces?: Vec2[][] | null;
  /** The paper that stays put while posing crease by crease. */
  anchor?: Vec2 | null;
  onPick(point: Vec2): void;
  onFace?(spot: Vec2): void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const faces = useMemo(() => project(frame).sort((a, b) => a.layer - b.layer), [frame]);
  const snaps = useMemo(() => snapPoints(frame), [frame]);
  const cuts = useMemo(() => cutsOnTable(frame), [frame]);
  const drawn = useMemo(() => marks.flatMap((m) => {
    const points = markOnTable(frame, m);
    return points ? [{ points, fill: !!m.fill }] : [];
  }), [frame, marks]);
  const box = useMemo(() => viewBox([...faces.flatMap((f) => f.world), ...(preview ? project(preview).flatMap((f) => f.world) : [])]), [faces, preview]);
  const unit = box[2] / 100;

  // Faces of the result that moved: turned over (by a fold), or put down somewhere else (by a move).
  const landed = useMemo(() => {
    if (!preview) return [];
    const before = project(frame);
    return project(preview).filter((f, i) => {
      const parent = before[preview.faces_parent?.[i] ?? i];
      if (Math.sign(signedArea(f.world)) !== Math.sign(signedArea(parent.world))) return true;
      const was = placeLike(parent);
      return f.paper.some((p, k) => dist(was(p), f.world[k]) > 1e-6);
    });
  }, [frame, preview]);

  const movingSide = useMemo(() => {
    if (!line) return null;
    const [x, z, s] = box;
    const rect: Vec2[] = [[x, z], [x + s, z], [x + s, z + s], [x, z + s]];
    return split({ world: rect, paper: rect }, line).pos?.world ?? null;
  }, [line, box]);

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const at: Vec2 = [p.x, p.y];
    if (picked && onFace) return onFace(at);
    let best: Vec2 | null = null;
    for (const s of snaps) if (dist(s, at) < 4 * unit && (!best || dist(s, at) < dist(best, at))) best = s;
    if (best) onPick(best);
    else if (free) onPick(at);
  };

  const pts = (poly: Vec2[]) => poly.map((p) => p.join(',')).join(' ');

  return (
    <svg ref={svg} className="fold-editor" viewBox={box.join(' ')} onPointerDown={pick} role="img" aria-label="The paper from above">
      {faces.map((f, i) => (
        <polygon key={i} points={pts(f.world)} fill={faceColour(model, f.paper, frontUp(f.world, f.paper))} className="face" />
      ))}
      {drawn.map((m, i) => (m.fill ? <polygon key={i} points={pts(m.points)} className="mark fill" /> : <polyline key={i} points={pts(m.points)} className="mark" />))}
      {picked &&
        faces.map((f, i) => isPicked(picked, f.paper) && <polygon key={i} points={pts(f.world)} className="face-picked" />)}
      {movingSide && <polygon points={pts(movingSide)} className="moving-side" />}
      {landed.map((f, i) => (
        <polygon key={i} points={pts(f.world)} className="landing" />
      ))}
      {extra.map((c, i) => (
        <line
          key={i}
          x1={c.line.p[0] - c.line.d[0] * 10}
          y1={c.line.p[1] - c.line.d[1] * 10}
          x2={c.line.p[0] + c.line.d[0] * 10}
          y2={c.line.p[1] + c.line.d[1] * 10}
          className={`crease pending ${c.kind}`}
        />
      ))}
      {line && (
        <line
          x1={line.p[0] - line.d[0] * 10}
          y1={line.p[1] - line.d[1] * 10}
          x2={line.p[0] + line.d[0] * 10}
          y2={line.p[1] + line.d[1] * 10}
          className={`crease ${kind}`}
        />
      )}
      {cuts.map(([a, b], i) => (
        <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="cut" />
      ))}
      {drawing.map((m, i) =>
        m.fill && m.points.length > 2 ? <polygon key={i} points={pts(m.points)} className="mark fill planned" /> : <polyline key={i} points={pts(m.points)} className="mark planned" />,
      )}
      {anchor && <rect x={anchor[0] - 1.6 * unit} y={anchor[1] - 1.6 * unit} width={3.2 * unit} height={3.2 * unit} className="anchor" />}
      {cut && <line x1={cut[0][0]} y1={cut[0][1]} x2={cut[1][0]} y2={cut[1][1]} className="cut planned" />}
      {snaps.map((s, i) => (
        <circle key={i} cx={s[0]} cy={s[1]} r={1.1 * unit} className="snap" />
      ))}
      {labels[0] === labels[1] &&
        [picks.slice(0, 2), picks.slice(2, 4)].map(
          (edge, i) => edge.length === 2 && <line key={i} x1={edge[0][0]} y1={edge[0][1]} x2={edge[1][0]} y2={edge[1][1]} className="picked-edge" />,
        )}
      {picks.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r={1.8 * unit} className="picked" />
          <text x={p[0]} y={p[1] - 3 * unit} fontSize={3.2 * unit} className="pick-label">
            {labels[i] ?? ''}
          </text>
        </g>
      ))}
    </svg>
  );
}
