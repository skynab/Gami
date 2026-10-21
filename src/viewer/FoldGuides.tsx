import { Line, QuadraticBezierLine } from '@react-three/drei';
import { useMemo } from 'react';
import { Quaternion, Vector3 } from 'three';
import { framesOf } from '../fold/frames';
import { guidesFor, type Guides } from '../fold/guides';
import type { OrigamiModel, Vec3 } from '../fold/types';
import { usePlayback } from '../state/playback';
import { useViewer } from '../state/viewer';

/** Just above the paper, so guides aren't hidden in it. */
const LIFT = 0.006;
const up = ([x, y, z]: Vec3, by = LIFT): Vec3 => [x, y + by, z];
/** Length of an arrowhead. */
const HEAD = 0.05;

/**
 * The current step's crease (dashed for valley, dotted for mountain; a scissor cut solid) and an arrow along the path the paper
 * takes, as in an origami diagram. Drawn in the accent colour, on top of the paper.
 */
export function FoldGuides({ model, color }: { model: OrigamiModel; color: string }) {
  const step = usePlayback((s) => s.step);
  const total = usePlayback((s) => s.total);
  const show = useViewer((s) => s.guides);
  const frames = useMemo(() => framesOf(model), [model]);
  const cache = useMemo(() => new Map<number, Guides>(), [frames]);

  if (!show || !total || step > total) return null;
  let g = cache.get(step);
  if (!g) {
    g = guidesFor(frames[step - 1], frames[step]);
    cache.set(step, g);
  }

  return (
    <group renderOrder={2}>
      {g.creases.map((c, i) => (
        <Line
          key={i}
          points={[up(c.a), up(c.b)]}
          color={color}
          lineWidth={2.5}
          dashed
          dashSize={c.valley ? 0.035 : 0.012}
          gapSize={c.valley ? 0.02 : 0.012}
        />
      ))}
      {g.cuts.map((c, i) => (
        // A scissor cut: a solid line, where folds are dashed.
        <Line key={`cut${i}`} points={[up(c.a), up(c.b)]} color={color} lineWidth={3.5} />
      ))}
      {g.arrows.map((a, i) => (
        <Arrow key={i} from={up(a.from, 0.02)} via={up(a.via, 0.02)} to={up(a.to, 0.02)} color={color} />
      ))}
    </group>
  );
}

function Arrow({ from, via, to, color }: { from: Vec3; via: Vec3; to: Vec3; color: string }) {
  const { control, tip, turn } = useMemo(() => {
    // The curve passes through `via` halfway, so its control point is twice as far out.
    const control: Vec3 = [0, 1, 2].map((i) => 2 * via[i] - (from[i] + to[i]) / 2) as Vec3;
    const dir = new Vector3(...to).sub(new Vector3(...control)).normalize();
    // The cone is centred on its position: step back half its height so the point lands on `to`.
    const tip = new Vector3(...to).addScaledVector(dir, -HEAD / 2);
    return { control, tip, turn: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir) };
  }, [from, via, to]);
  return (
    <group>
      <QuadraticBezierLine start={from} mid={control} end={to} color={color} lineWidth={2.5} />
      <mesh position={tip} quaternion={turn}>
        <coneGeometry args={[0.018, HEAD, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}
