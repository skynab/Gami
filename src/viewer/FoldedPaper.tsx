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
import { toFlat } from '../fold/fold';
import { framesOf, LAYER_GAP, normal } from '../fold/frames';
import { frontUp, joinedSegment } from '../fold/geometry2d';
import { MARK_COLOUR, MARK_WIDTH, marksUpTo, onFace } from '../fold/marks';
import { sheetOf } from '../fold/sheets';
import { TAPE_COLOUR, TAPE_OPACITY } from '../fold/tape';
import type { FoldFrame, OrigamiModel, Vec2, Vec3 } from '../fold/types';
import { usePlayback } from '../state/playback';

/**
 * The paper, posed wherever playback is. Each sheet has two meshes sharing one geometry, one per side, so each
 * side gets its own colour; thin lines trace every face edge, which shows the creases and the paper's outline.
 * Stacked layers are drawn a little apart, so where a fold joins two of them a rounded bend closes the gap, in
 * the colour of the paper's outside there: seen from the side, it shows which layers are one piece.
 * Marks drawn on the paper ride on their faces, and a step that draws them draws them stroke by stroke. Tape
 * rides on its faces the same way, see-through, a step that lays it laying it strip by strip.
 * Paper that bends is many small triangles: the edges between them (soft) get no lines, and it's shaded smoothly
 * across them. Where its stacked layers meet, they show in the order they were stacked (see LIFT).
 * Geometry is rebuilt when the step changes (folds add faces) and updated in place on every frame.
 */
export function FoldedPaper({ model, edgeColor }: { model: OrigamiModel; edgeColor: string }) {
  const front = useRef<(Mesh | null)[]>([]);
  const back = useRef<(Mesh | null)[]>([]);
  const lines = useRef<(LineSegments | null)[]>([]);
  const bendsFront = useRef<(Mesh | null)[]>([]);
  const bendsBack = useRef<(Mesh | null)[]>([]);
  const marks = useRef<Mesh | null>(null);
  const tape = useRef<Mesh | null>(null);
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
        b = build(k === 0 ? transition(frames[0], frames[0]) : stepTransition(model, k), model, k);
        built.set(k, b);
      }
      if (b !== shown) {
        b.parts.forEach((part, i) => {
          front.current[i]!.geometry = back.current[i]!.geometry = part.surface;
          lines.current[i]!.geometry = part.edges;
          bendsFront.current[i]!.geometry = part.bends[0];
          bendsBack.current[i]!.geometry = part.bends[1];
        });
        marks.current!.geometry = b.marks;
        tape.current!.geometry = b.tape;
        shown = b;
      }
      b.update(k === 0 ? 1 : pos - (k - 1));
      invalidate();
      warm(k + 1);
    };

    // Working out how a step plays can take a moment (paper joined up and layers held apart through a compound
    // fold): the next step's is worked out while nothing else is going on, so it plays smoothly from the start.
    let warmed = 0;
    let idle = 0;
    const warm = (k: number) => {
      if (k > total || k === warmed) return;
      warmed = k;
      cancelIdle(idle);
      idle = whenIdle(() => poseAt(stepTransition(model, k), 0.5));
    };

    draw(usePlayback.getState().pos);
    const unsubscribe = usePlayback.subscribe((s, prev) => {
      if (s.pos !== prev.pos) draw(s.pos);
    });
    return () => {
      unsubscribe();
      cancelIdle(idle);
      for (const b of built.values()) b.dispose();
    };
  }, [model, invalidate]);

  return (
    <group position-y={0.002}>
      {model.sheets.map((sheet, i) => (
        <group key={i}>
          {/* Pushed back a touch in depth so the edge lines always draw on top. */}
          <mesh ref={(m) => void (front.current[i] = m)} frustumCulled={false}>
            <meshStandardMaterial color={sheet.front} map={grain} side={FrontSide} roughness={0.8} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} onBeforeCompile={liftFront} customProgramCacheKey={liftFrontKey} />
          </mesh>
          <mesh ref={(m) => void (back.current[i] = m)} frustumCulled={false}>
            <meshStandardMaterial color={sheet.back} map={grain} side={BackSide} roughness={0.85} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} onBeforeCompile={liftBack} customProgramCacheKey={liftBackKey} />
          </mesh>
          {/* Fold bends, by which side of the paper is on their outside. */}
          <mesh ref={(m) => void (bendsFront.current[i] = m)} frustumCulled={false}>
            <meshStandardMaterial color={sheet.front} side={DoubleSide} roughness={0.8} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
          </mesh>
          <mesh ref={(m) => void (bendsBack.current[i] = m)} frustumCulled={false}>
            <meshStandardMaterial color={sheet.back} side={DoubleSide} roughness={0.85} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
          </mesh>
          <lineSegments ref={(l) => void (lines.current[i] = l)} frustumCulled={false}>
            <lineBasicMaterial color={edgeColor} transparent opacity={0.6} onBeforeCompile={liftLines} customProgramCacheKey={liftLinesKey} />
          </lineSegments>
        </group>
      ))}
      {/* Drawn on the paper: just off its face, and pulled forward in depth so it never sinks into it. */}
      <mesh ref={marks} frustumCulled={false}>
        <meshStandardMaterial color={MARK_COLOUR} side={DoubleSide} roughness={0.9} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      {/* Tape: see-through and a little glossy, over the marks. */}
      <mesh ref={tape} frustumCulled={false}>
        <meshStandardMaterial
          color={TAPE_COLOUR}
          side={DoubleSide}
          transparent
          opacity={TAPE_OPACITY}
          depthWrite={false}
          roughness={0.35}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
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
  /** Everything drawn on the paper by this step, all sheets together. */
  marks: BufferGeometry;
  /** The tape on the paper by this step, all sheets together. */
  tape: BufferGeometry;
  /** Poses the paper `s` of the way (0–1) through the step. */
  update(s: number): void;
  dispose(): void;
}

/** Step k's paper (k from 1; 0 for the paper before any step). */
function build(t: Transition, model: OrigamiModel, k: number): Built {
  const { sheets } = model;
  const bySheet = sheets.map(() => [] as number[]);
  t.faces.forEach((f, i) => bySheet[sheetOf(sheets, f.paper)].push(i));
  // Faces either side of a scissor cut aren't joined: no bend is drawn between them. The step's faces are its frame's.
  const frame = k ? model.steps[k - 1].frame : model.start;
  const ranks = stackRanks(model, k, t.faces.length);
  const parts = bySheet.map((faces) => buildPart(t, faces, frame, ranks));
  const marks = buildMarks(t, model, k);
  const tape = buildTape(t, model, k);
  return {
    parts: parts.map((p) => p.part),
    marks: marks.geometry,
    tape: tape.geometry,
    update(s) {
      const pose = poseAt(t, s);
      for (const p of parts) p.update(pose);
      marks.update(pose, s);
      tape.update(pose, s);
    },
    dispose() {
      for (const p of parts) p.dispose();
      marks.geometry.dispose();
      tape.geometry.dispose();
    },
  };
}

/** How far off its face a mark is drawn: under the gap to the next layer, so paper on top still covers it. */
const MARK_LIFT = 0.00025;
/** Tape, over any marks beneath it, and still under the gap to the next layer. */
const TAPE_LIFT = 0.0004;

/** One part of a mark or a piece of tape on one face, and which of this step's own it is (or -1 for earlier). */
interface Drawn {
  points: Vec2[];
  fill: boolean;
  front: boolean;
  face: number;
  turn: number;
}

/**
 * The marks drawn by step k's end, cut into their parts on each face and placed with it: lines as thin strips
 * through their points, fills as their outline filled in. Marks the step itself draws appear one after
 * another as it plays.
 */
function buildMarks(t: Transition, model: OrigamiModel, k: number): { geometry: BufferGeometry; update(pose: Vec3[][], s: number): void } {
  const width = MARK_WIDTH * Math.max(...model.sheets.map((sh) => Math.max(...sh.size)));
  const drawn = marksUpTo(model, k);
  // Which of this step's marks each mark is (its turn to appear), or -1 for marks drawn earlier.
  let turn = 0;
  const turns = drawn.map(({ step }) => (step === k ? turn++ : -1));
  const parts = drawn.flatMap(({ mark }, i) =>
    t.faces.flatMap((face, f) => onFace(mark, face.paper).map((points) => ({ points, fill: !!mark.fill, front: mark.side === 'front', face: f, turn: turns[i] }))),
  );
  return onFaces(t, parts, turn, width, MARK_LIFT);
}

/** The tape on the paper by step k's end, its pieces on each face placed with it; tape the step lays appears as it plays. */
function buildTape(t: Transition, model: OrigamiModel, k: number): { geometry: BufferGeometry; update(pose: Vec3[][], s: number): void } {
  const frameAt = (i: number) => (i ? model.steps[i - 1].frame : model.start);
  const tapes = frameAt(k).tapes ?? [];
  // Tape is only ever added to, until a fresh sheet: anything past what the frame before had is this step's.
  const before = k ? (frameAt(k - 1).tapes?.length ?? 0) : tapes.length;
  const laid = before <= tapes.length ? before : 0;
  let turn = 0;
  const turns = tapes.map((_, i) => (i >= laid ? turn++ : -1));
  const parts = tapes.flatMap((strip, i) =>
    strip.pieces.flatMap((piece) =>
      t.faces.flatMap((face, f) => onFace(piece, face.paper).map((points) => ({ points, fill: true, front: piece.side === 'front', face: f, turn: turns[i] }))),
    ),
  );
  return onFaces(t, parts, turn, 0, TAPE_LIFT);
}

/**
 * Geometry for marks or tape on the paper's faces, `lift` off them: lines as strips `width` wide through their
 * points, fills as their outline filled in. The step's own (`turns` of them) appear one after another as it plays.
 */
function onFaces(t: Transition, parts: Drawn[], turn: number, width: number, lift: number): { geometry: BufferGeometry; update(pose: Vec3[][], s: number): void } {
  // Vertices: a strip's two edges at each point, or a fill's corners.
  const sizes = parts.map(({ points, fill }) => (fill ? points.length : points.length * 2));
  const starts = sizes.map((_, i) => sizes.slice(0, i).reduce((a, b) => a + b, 0));
  const total = sizes.reduce((a, b) => a + b, 0);
  const positions = new Float32Array(total * 3);
  const normals = new Float32Array(total * 3);
  const index: number[] = [];
  parts.forEach(({ points, fill }, i) => {
    const first = starts[i];
    const n = points.length;
    if (fill) for (let j = 1; j < n - 1; j++) index.push(first, first + j, first + j + 1);
    else for (let j = 0; j < n - 1; j++) index.push(first + 2 * j, first + 2 * j + 1, first + 2 * j + 2, first + 2 * j + 2, first + 2 * j + 1, first + 2 * j + 3);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setIndex(index);

  return {
    geometry,
    update(pose, s) {
      parts.forEach(({ points, fill, front, face, turn: at }, i) => {
        const first = starts[i];
        const up = scale(normal(pose[face]), front ? 1 : -1);
        const place = affine(t.faces[face].paper, pose[face]);
        let pts = points.map((p) => add(place(p), scale(up, lift)));
        // While this step plays, its marks appear in turn, each in an equal share of it.
        if (at >= 0 && s * turn < at + 1) pts = pts.map(() => pts[0]);
        if (fill) {
          pts.forEach((p, j) => {
            positions.set(p, (first + j) * 3);
            normals.set(up, (first + j) * 3);
          });
          return;
        }
        pts.forEach((p, j) => {
          const along = sub(pts[Math.min(pts.length - 1, j + 1)], pts[Math.max(0, j - 1)]);
          const across = Math.hypot(...along) > 1e-9 ? scale(unit(cross(up, along)), width / 2) : ([0, 0, 0] as Vec3);
          positions.set(add(p, across), (first + 2 * j) * 3);
          positions.set(sub(p, across), (first + 2 * j + 1) * 3);
          normals.set(up, (first + 2 * j) * 3);
          normals.set(up, (first + 2 * j + 1) * 3);
        });
      });
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.normal.needsUpdate = true;
    },
  };
}

function buildPart(t: Transition, faceIndices: number[], frame: FoldFrame, ranks?: number[]): { part: Part; update(pose: ReturnType<typeof poseAt>): void; dispose(): void } {
  const { cuts } = frame;
  const tracks = faceIndices.map((i) => t.faces[i]);
  const corners = tracks.reduce((n, f) => n + f.paper.length, 0);
  const positions = new Float32Array(corners * 3);
  const normals = new Float32Array(corners * 3);
  const uvs = new Float32Array(corners * 2);
  const rank = new Float32Array(corners);
  const index: number[] = [];
  const { lines, smooth, softly } = softness(frame, faceIndices);
  const edgePositions = new Float32Array(lines.length * 6);
  // Each line drawn as near the eye as its face's side facing it (see LIFT).
  const edgeRanks = Float32Array.from(lines.flatMap(([a]) => [ranks?.[faceIndices[a]] ?? 0, ranks?.[faceIndices[a]] ?? 0]));
  const edgeNormals = new Float32Array(lines.length * 6);

  let base = 0;
  tracks.forEach((f, a) => {
    f.paper.forEach(([u, v], i) => {
      uvs[(base + i) * 2] = u + 0.5;
      uvs[(base + i) * 2 + 1] = v + 0.5;
      rank[base + i] = ranks?.[faceIndices[a]] ?? 0;
    });
    // Faces are convex (straight folds of a convex sheet), so a fan triangulates them.
    for (let i = 1; i < f.paper.length - 1; i++) index.push(base, base + i, base + i + 1);
    base += f.paper.length;
  });

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
      // Triangles of bending paper meet edge to edge, with no gap to close.
      if (softly(a, b)) continue;
      const ends = joinedSegment(tracks[a].paper, tracks[b].paper, cuts);
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
   * faces. Faces whose edges meet, or that meet at an angle, leave it with no size.
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
      // Only folds pressed flat stack their layers apart: faces at an angle (mid-fold, or shaped) need none.
      if (width < 1e-5 || Math.abs(dot(normal(pa), normal(pb))) < 0.999) {
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
  surface.setAttribute('rank', new BufferAttribute(rank, 1));
  surface.setIndex(index);
  const edges = new BufferGeometry();
  edges.setAttribute('position', new BufferAttribute(edgePositions, 3));
  edges.setAttribute('rank', new BufferAttribute(edgeRanks, 1));
  edges.setAttribute('faceNormal', new BufferAttribute(edgeNormals, 3));

  return {
    part: { surface, edges, bends },
    update(pose) {
      let c = 0;
      const faceNormals = faceIndices.map((i) => normal(pose[i]));
      faceIndices.forEach((i, a) => {
        pose[i].forEach((p) => {
          const group = smooth[c];
          positions.set(p, c * 3);
          normals.set(group ? unit(group.reduce((n, b) => add(n, faceNormals[b]), [0, 0, 0] as Vec3)) : faceNormals[a], c * 3);
          c++;
        });
      });
      lines.forEach(([a, i], e) => {
        const points = pose[faceIndices[a]];
        edgePositions.set(points[i], e * 6);
        edgePositions.set(points[(i + 1) % points.length], e * 6 + 3);
        edgeNormals.set(faceNormals[a], e * 6);
        edgeNormals.set(faceNormals[a], e * 6 + 3);
      });
      surface.attributes.position.needsUpdate = true;
      surface.attributes.normal.needsUpdate = true;
      edges.attributes.position.needsUpdate = true;
      edges.attributes.faceNormal.needsUpdate = true;
      placeBends(pose);
    },
    dispose() {
      surface.dispose();
      edges.dispose();
      for (const g of bends) g.dispose();
    },
  };
}

/**
 * For one sheet's faces (indices into `frame`'s): the face edges to draw as lines, as [face, corner] (soft edges
 * have none); for each corner, in order, the faces whose normals it's shaded with when bending paper meets it
 * smoothly there (undefined for a plain corner); and whether two faces meet along a soft edge.
 */
function softness(frame: FoldFrame, faceIndices: number[]) {
  const key = (u: number, v: number) => (u < v ? `${u} ${v}` : `${v} ${u}`);
  const soft = new Set((frame.soft ?? []).map(([u, v]) => key(u, v)));
  const corners = (a: number) => frame.faces_vertices[faceIndices[a]];
  const lines: [number, number][] = [];
  // The faces on each soft edge.
  const across = new Map<string, number[]>();
  faceIndices.forEach((_, a) =>
    corners(a).forEach((u, c, vs) => {
      const k = key(u, vs[(c + 1) % vs.length]);
      if (!soft.has(k)) lines.push([a, c]);
      else across.set(k, [...(across.get(k) ?? []), a]);
    }),
  );
  // Faces meeting smoothly at each vertex: joined round it, soft edge by soft edge.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  for (const [k, faces] of across) {
    const [u, v] = k.split(' ');
    for (const b of faces.slice(1)) for (const w of [u, v]) parent.set(find(`${w}:${faces[0]}`), find(`${w}:${b}`));
  }
  const groups = new Map<string, number[]>();
  faceIndices.forEach((_, a) => corners(a).forEach((u) => {
    const r = find(`${u}:${a}`);
    groups.set(r, [...(groups.get(r) ?? []), a]);
  }));
  const smooth = faceIndices.flatMap((_, a) =>
    corners(a).map((u) => {
      const group = groups.get(find(`${u}:${a}`))!;
      return group.length > 1 ? group : undefined;
    }),
  );
  const pairs = new Set([...across.values()].flatMap((faces) => faces.flatMap((a) => faces.map((b) => `${a} ${b}`))));
  return { lines, smooth, softly: (a: number, b: number) => pairs.has(`${a} ${b}`) };
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
/** Runs `work` when the browser has nothing else to do (soon after, where it can't say). */
const whenIdle = (work: () => void): number =>
  typeof requestIdleCallback === 'function' ? requestIdleCallback(work, { timeout: 2000 }) : window.setTimeout(work, 200);
const cancelIdle = (id: number) => (typeof cancelIdleCallback === 'function' ? cancelIdleCallback(id) : clearTimeout(id));

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

/**
 * For bent paper (step k's frame cut into triangles by a bend): each triangle's place in the stack it was bent from,
 * its layer, signed by which way up it lay there (minus if its back faced up). Undefined for paper that isn't bent.
 */
function stackRanks(model: OrigamiModel, k: number, faces: number): number[] | undefined {
  const frames = framesOf(model);
  if (!k || !frames[k].soft?.length) return undefined;
  let b = k;
  while (b > 1 && frames[b - 1].soft?.length) b--;
  const parent = model.steps[b - 1].via?.[0]?.faces_parent;
  const before = frames[b - 1];
  if (!parent || parent.length !== faces || !before.faces_layer) return undefined;
  try {
    const flat = toFlat(before);
    return parent.map((f) => (frontUp(flat[f].world, flat[f].paper) ? 1 : -1) * flat[f].layer);
  } catch {
    // Bent from paper that wasn't lying flat: no stack to draw it in the order of.
    return undefined;
  }
}

/**
 * Stacked layers of bent paper are kept apart at their triangles' corners, but between them, and where a fold wraps
 * round other layers, they can pass a millimetre or two into one another (see docs/bending-plan.md), which would show
 * as specks of one through the other. So each is drawn nearer the eye by its place in the stack (`rank`) times this,
 * along the line of sight, which changes only which shows where they meet: the side that faced up in the stack in the
 * stack's order, the other side in reverse. Bent paper only: a flat stack's layers are drawn apart as it is.
 */
const LIFT = 4 * LAYER_GAP;
const lift = (sign: number) => (shader: { vertexShader: string }) => {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float rank;')
    .replace('#include <project_vertex>', `#include <project_vertex>\nmvPosition.xyz *= 1.0 - rank * ${(sign * LIFT).toFixed(6)} / max(length(mvPosition.xyz), 1e-6);\ngl_Position = projectionMatrix * mvPosition;`);
};
const liftFront = lift(1);
const liftBack = lift(-1);
/** Lines take their face's lift, by which of its sides faces the eye. */
const liftLines = (shader: { vertexShader: string }) => {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float rank;\nattribute vec3 faceNormal;')
    .replace(
      '#include <project_vertex>',
      `#include <project_vertex>\nfloat facing = dot(normalMatrix * faceNormal, -mvPosition.xyz) >= 0.0 ? 1.0 : -1.0;\nmvPosition.xyz *= 1.0 - facing * rank * ${LIFT.toFixed(6)} / max(length(mvPosition.xyz), 1e-6);\ngl_Position = projectionMatrix * mvPosition;`,
    );
};
const liftLinesKey = () => 'lift-lines';
const liftFrontKey = () => 'lift-front';
const liftBackKey = () => 'lift-back';
