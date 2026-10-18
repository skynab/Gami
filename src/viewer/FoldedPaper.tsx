import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  FrontSide,
  RepeatWrapping,
  SRGBColorSpace,
  type LineSegments,
  type Mesh,
} from 'three';
import { affine, poseAt, stepTransition, transition, type Transition } from '../fold/animate';
import { framesOf, normal } from '../fold/frames';
import { sharedSegment } from '../fold/geometry2d';
import { sheetOf } from '../fold/sheets';
import type { OrigamiModel, Sheet, Vec2, Vec3 } from '../fold/types';
import { usePlayback } from '../state/playback';

/**
 * The paper, posed wherever playback is. Each sheet has two meshes sharing one geometry, one per side, so each
 * side gets its own colour; thin lines trace every face edge, which shows the creases and the paper's outline.
 * Stacked layers are drawn a little apart, so where a fold joins two of them a rounded bend closes the gap, in
 * the colour of the paper's outside there: seen from the side, it shows which layers are one piece.
 * Geometry is rebuilt when the step changes (folds add faces) and updated in place on every frame.
 */
export function FoldedPaper({ model, edgeColor }: { model: OrigamiModel; edgeColor: string }) {
  const front = useRef<(Mesh | null)[]>([]);
  const back = useRef<(Mesh | null)[]>([]);
  const lines = useRef<(LineSegments | null)[]>([]);
  const bendsFront = useRef<(Mesh | null)[]>([]);
  const bendsBack = useRef<(Mesh | null)[]>([]);
  const invalidate = useThree((s) => s.invalidate);
  const grain = useMemo(paperGrain, []);

  useEffect(() => {
    const frames = framesOf(model);
    const total = frames.length - 1;
    const built = new Map<number, Built>();
    let shown: Built | null = null;

    const draw = (pos: number) => {
      // Step k plays frame k − 1 → k. Before any step, show the start frame as a still.
      const k = Math.min(total, Math.max(0, Math.ceil(pos)));
      let b = built.get(k);
      if (!b) {
        b = build(k === 0 ? transition(frames[0], frames[0]) : stepTransition(model, k), model.sheets);
        built.set(k, b);
      }
      if (b !== shown) {
        b.parts.forEach((part, i) => {
          front.current[i]!.geometry = back.current[i]!.geometry = part.surface;
          lines.current[i]!.geometry = part.edges;
          bendsFront.current[i]!.geometry = part.bends[0];
          bendsBack.current[i]!.geometry = part.bends[1];
        });
        shown = b;
      }
      b.update(k === 0 ? 1 : pos - (k - 1));
      invalidate();
    };

    draw(usePlayback.getState().pos);
    const unsubscribe = usePlayback.subscribe((s, prev) => {
      if (s.pos !== prev.pos) draw(s.pos);
    });
    return () => {
      unsubscribe();
      for (const b of built.values()) b.dispose();
    };
  }, [model, invalidate]);

  return (
    <group position-y={0.002}>
      {model.sheets.map((sheet, i) => (
        <group key={i}>
          {/* Pushed back a touch in depth so the edge lines always draw on top. */}
          <mesh ref={(m) => void (front.current[i] = m)} frustumCulled={false}>
            <meshStandardMaterial color={sheet.front} map={grain} side={FrontSide} roughness={0.8} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
          </mesh>
          <mesh ref={(m) => void (back.current[i] = m)} frustumCulled={false}>
            <meshStandardMaterial color={sheet.back} map={grain} side={BackSide} roughness={0.85} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
          </mesh>
          {/* Fold bends, by which side of the paper is on their outside. */}
          <mesh ref={(m) => void (bendsFront.current[i] = m)} frustumCulled={false}>
            <meshStandardMaterial color={sheet.front} side={DoubleSide} roughness={0.8} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
          </mesh>
          <mesh ref={(m) => void (bendsBack.current[i] = m)} frustumCulled={false}>
            <meshStandardMaterial color={sheet.back} side={DoubleSide} roughness={0.85} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
          </mesh>
          <lineSegments ref={(l) => void (lines.current[i] = l)} frustumCulled={false}>
            <lineBasicMaterial color={edgeColor} transparent opacity={0.6} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

interface Part {
  surface: BufferGeometry;
  edges: BufferGeometry;
  /** The bends where folds join layers: those with the front of the paper on their outside, then the back. */
  bends: [BufferGeometry, BufferGeometry];
}

/** How many strips each fold's bend is drawn with, round from one layer to the other. */
const BEND_STEPS = 6;

interface Built {
  /** One per sheet. */
  parts: Part[];
  /** Poses the paper `s` of the way (0–1) through the step. */
  update(s: number): void;
  dispose(): void;
}

function build(t: Transition, sheets: Sheet[]): Built {
  const bySheet = sheets.map(() => [] as number[]);
  t.faces.forEach((f, i) => bySheet[sheetOf(sheets, f.paper)].push(i));
  const parts = bySheet.map((faces) => buildPart(t, faces));
  return {
    parts: parts.map((p) => p.part),
    update(s) {
      const pose = poseAt(t, s);
      for (const p of parts) p.update(pose);
    },
    dispose() {
      for (const p of parts) p.dispose();
    },
  };
}

function buildPart(t: Transition, faceIndices: number[]): { part: Part; update(pose: ReturnType<typeof poseAt>): void; dispose(): void } {
  const tracks = faceIndices.map((i) => t.faces[i]);
  const corners = tracks.reduce((n, f) => n + f.paper.length, 0);
  const positions = new Float32Array(corners * 3);
  const normals = new Float32Array(corners * 3);
  const uvs = new Float32Array(corners * 2);
  const index: number[] = [];
  const edgePositions = new Float32Array(corners * 6);

  let base = 0;
  for (const f of tracks) {
    f.paper.forEach(([u, v], i) => {
      uvs[(base + i) * 2] = u + 0.5;
      uvs[(base + i) * 2 + 1] = v + 0.5;
    });
    // Faces are convex (straight folds of a convex sheet), so a fan triangulates them.
    for (let i = 1; i < f.paper.length - 1; i++) index.push(base, base + i, base + i + 1);
    base += f.paper.length;
  }

  // Faces joined along an edge on the sheet, and that edge.
  const joins: { a: number; b: number; ends: [Vec2, Vec2] }[] = [];
  const boxes = tracks.map((f) => {
    const us = f.paper.map((p) => p[0]);
    const vs = f.paper.map((p) => p[1]);
    return [Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs)];
  });
  for (let a = 0; a < tracks.length; a++) {
    for (let b = a + 1; b < tracks.length; b++) {
      const [p, q] = [boxes[a], boxes[b]];
      if (p[0] > q[2] + 1e-7 || q[0] > p[2] + 1e-7 || p[1] > q[3] + 1e-7 || q[1] > p[3] + 1e-7) continue;
      const ends = sharedSegment(tracks[a].paper, tracks[b].paper);
      if (ends) joins.push({ a, b, ends });
    }
  }
  const bendVertices = joins.length * (BEND_STEPS + 1) * 2;
  const bendGeometry = () => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(bendVertices * 3), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(bendVertices * 3), 3));
    const bendIndex: number[] = [];
    joins.forEach((_, k) => {
      const first = k * (BEND_STEPS + 1) * 2;
      for (let s = 0; s < BEND_STEPS; s++) {
        const [p, q] = [first + s * 2, first + s * 2 + 2];
        bendIndex.push(p, p + 1, q, q, p + 1, q + 1);
      }
    });
    g.setIndex(bendIndex);
    return g;
  };
  const bends: [BufferGeometry, BufferGeometry] = [bendGeometry(), bendGeometry()];

  /**
   * Each join's bend, from the edge on one face to the same edge on the other, bulging out away from both
   * faces. Faces whose edges meet (paper lying flat, or mid-fold) leave it with no size.
   */
  const placeBends = (pose: Vec3[][]) => {
    const [front, back] = bends.map((g) => [g.attributes.position.array as Float32Array, g.attributes.normal.array as Float32Array]);
    joins.forEach(({ a, b, ends }, k) => {
      const [pa, pb] = [pose[faceIndices[a]], pose[faceIndices[b]]];
      const onA = ends.map(affine(tracks[a].paper, pa));
      const onB = ends.map(affine(tracks[b].paper, pb));
      const first = k * (BEND_STEPS + 1) * 2;
      const gap = sub(midpoint(onB), midpoint(onA));
      const width = Math.hypot(...gap);
      const clear = ([positions]: Float32Array[]) => {
        for (let v = 0; v < (BEND_STEPS + 1) * 2; v++) positions.set(onA[0], (first + v) * 3);
      };
      if (width < 1e-5) {
        clear(front);
        clear(back);
        return;
      }
      // Out from the edge, away from both faces. The bend's outside is the side of face a facing away from b.
      const along = unit(sub(onA[1], onA[0]));
      const out = unit(add(awayFrom(along, onA, pa), awayFrom(along, onB, pb)));
      const [use, other] = dot(normal(pa), gap) > 0 ? [back, front] : [front, back];
      clear(other);
      for (let s = 0; s <= BEND_STEPS; s++) {
        const t = s / BEND_STEPS;
        const bulge = (width / 2) * Math.sin(Math.PI * t);
        // The bend's direction across the gap at this point, to find which way it faces.
        const slope = add(gap, scale(out, (width / 2) * Math.PI * Math.cos(Math.PI * t)));
        const n = unit(cross(along, slope));
        for (let e = 0; e < 2; e++) {
          const v = first + s * 2 + e;
          use[0].set(add(lerp(onA[e], onB[e], t), scale(out, bulge)), v * 3);
          use[1].set(n, v * 3);
        }
      }
    });
    for (const g of bends) {
      g.attributes.position.needsUpdate = true;
      g.attributes.normal.needsUpdate = true;
    }
  };

  const surface = new BufferGeometry();
  surface.setAttribute('position', new BufferAttribute(positions, 3));
  surface.setAttribute('normal', new BufferAttribute(normals, 3));
  surface.setAttribute('uv', new BufferAttribute(uvs, 2));
  surface.setIndex(index);
  const edges = new BufferGeometry();
  edges.setAttribute('position', new BufferAttribute(edgePositions, 3));

  return {
    part: { surface, edges, bends },
    update(pose) {
      let c = 0;
      let e = 0;
      for (const points of faceIndices.map((i) => pose[i])) {
        const n = normal(points);
        points.forEach((p, i) => {
          positions.set(p, c * 3);
          normals.set(n, c * 3);
          c++;
          edgePositions.set(p, e);
          edgePositions.set(points[(i + 1) % points.length], e + 3);
          e += 6;
        });
      }
      surface.attributes.position.needsUpdate = true;
      surface.attributes.normal.needsUpdate = true;
      edges.attributes.position.needsUpdate = true;
      placeBends(pose);
    },
    dispose() {
      surface.dispose();
      edges.dispose();
      for (const g of bends) g.dispose();
    },
  };
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Vec3): Vec3 => scale(a, 1 / (Math.hypot(...a) || 1));
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t));
const midpoint = ([a, b]: Vec3[]): Vec3 => lerp(a, b, 0.5);

/** Across an edge of a face, in its plane, pointing out of the face. */
function awayFrom(along: Vec3, edge: Vec3[], face: Vec3[]): Vec3 {
  const centre = scale(face.reduce(add, [0, 0, 0]), 1 / face.length);
  const across = cross(along, normal(face));
  return dot(across, sub(midpoint(edge), centre)) >= 0 ? across : scale(across, -1);
}

/** Faint fibres: near-white noise that the paper colour multiplies, so a flat sheet doesn't look like plastic. */
function paperGrain(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 236 + Math.random() * 19;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}
