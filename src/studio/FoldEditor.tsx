import { useMemo, useRef, type PointerEvent } from 'react';
import { toFlat } from '../fold/fold';
import { dist, signedArea, split, type Line } from '../fold/geometry2d';
import type { FoldFrame, Sheet, Vec2 } from '../fold/types';
import { frontUp, snapPoints, viewBox } from './editor';

/**
 * The paper seen from above, as you'd see it on the table. Click the dots to place a fold: the crease
 * shows as a line, the side that moves is shaded, and a dashed outline shows where it will land.
 */
export function FoldEditor({ frame, sheet, picks, line, kind, preview, onPick }: {
  frame: FoldFrame;
  sheet: Sheet;
  picks: Vec2[];
  line: Line | null;
  kind: 'valley' | 'mountain';
  /** The paper after the fold, when the fold is possible. */
  preview: FoldFrame | null;
  onPick(point: Vec2): void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const faces = useMemo(() => toFlat(frame).sort((a, b) => a.layer - b.layer), [frame]);
  const snaps = useMemo(() => snapPoints(frame), [frame]);
  const box = useMemo(() => viewBox([...faces.flatMap((f) => f.world), ...(preview ? toFlat(preview).flatMap((f) => f.world) : [])]), [faces, preview]);
  const unit = box[2] / 100;

  // Faces of the result that turned over are the ones that moved.
  const landed = useMemo(() => {
    if (!preview) return [];
    const before = toFlat(frame);
    return toFlat(preview).filter((f, i) => {
      const parent = before[preview.faces_parent?.[i] ?? i];
      return Math.sign(signedArea(f.world)) !== Math.sign(signedArea(parent.world));
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
    let best: Vec2 | null = null;
    for (const s of snaps) if (dist(s, at) < 4 * unit && (!best || dist(s, at) < dist(best, at))) best = s;
    if (best) onPick(best);
  };

  const pts = (poly: Vec2[]) => poly.map((p) => p.join(',')).join(' ');

  return (
    <svg ref={svg} className="fold-editor" viewBox={box.join(' ')} onPointerDown={pick} role="img" aria-label="The paper from above">
      {faces.map((f, i) => (
        <polygon key={i} points={pts(f.world)} fill={frontUp(f.world, f.paper) ? sheet.front : sheet.back} className="face" />
      ))}
      {movingSide && <polygon points={pts(movingSide)} className="moving-side" />}
      {landed.map((f, i) => (
        <polygon key={i} points={pts(f.world)} className="landing" />
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
      {snaps.map((s, i) => (
        <circle key={i} cx={s[0]} cy={s[1]} r={1.1 * unit} className="snap" />
      ))}
      {picks.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r={1.8 * unit} className="picked" />
          <text x={p[0]} y={p[1] - 3 * unit} fontSize={3.2 * unit} className="pick-label">
            {i === 0 ? 'A' : 'B'}
          </text>
        </g>
      ))}
    </svg>
  );
}
