import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  FrontSide,
  RepeatWrapping,
  SRGBColorSpace,
  type LineSegments,
  type Mesh,
} from 'three';
import { poseAt, transition, type Transition } from '../fold/animate';
import { framesOf, normal } from '../fold/frames';
import type { OrigamiModel } from '../fold/types';
import { usePlayback } from '../state/playback';

/**
 * The paper, posed wherever playback is. Two meshes share one geometry, one per side, so each side gets
 * its own colour; thin lines trace every face edge, which shows the creases and the paper's outline.
 * Geometry is rebuilt when the step changes (folds add faces) and updated in place on every frame.
 */
export function FoldedPaper({ model, edgeColor }: { model: OrigamiModel; edgeColor: string }) {
  const front = useRef<Mesh>(null);
  const back = useRef<Mesh>(null);
  const lines = useRef<LineSegments>(null);
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
        b = build(k === 0 ? transition(frames[0], frames[0]) : transition(frames[k - 1], frames[k]));
        built.set(k, b);
      }
      if (b !== shown) {
        front.current!.geometry = back.current!.geometry = b.surface;
        lines.current!.geometry = b.edges;
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
      {/* Pushed back a touch in depth so the edge lines always draw on top. */}
      <mesh ref={front} frustumCulled={false}>
        <meshStandardMaterial color={model.sheet.front} map={grain} side={FrontSide} roughness={0.8} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      <mesh ref={back} frustumCulled={false}>
        <meshStandardMaterial color={model.sheet.back} map={grain} side={BackSide} roughness={0.85} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      <lineSegments ref={lines} frustumCulled={false}>
        <lineBasicMaterial color={edgeColor} transparent opacity={0.6} />
      </lineSegments>
    </group>
  );
}

interface Built {
  surface: BufferGeometry;
  edges: BufferGeometry;
  /** Poses the paper `s` of the way (0–1) through the step. */
  update(s: number): void;
  dispose(): void;
}

function build(t: Transition): Built {
  const corners = t.faces.reduce((n, f) => n + f.paper.length, 0);
  const positions = new Float32Array(corners * 3);
  const normals = new Float32Array(corners * 3);
  const uvs = new Float32Array(corners * 2);
  const index: number[] = [];
  const edgePositions = new Float32Array(corners * 6);

  let base = 0;
  for (const f of t.faces) {
    f.paper.forEach(([u, v], i) => {
      uvs[(base + i) * 2] = u + 0.5;
      uvs[(base + i) * 2 + 1] = v + 0.5;
    });
    // Faces are convex (straight folds of a convex sheet), so a fan triangulates them.
    for (let i = 1; i < f.paper.length - 1; i++) index.push(base, base + i, base + i + 1);
    base += f.paper.length;
  }

  const surface = new BufferGeometry();
  surface.setAttribute('position', new BufferAttribute(positions, 3));
  surface.setAttribute('normal', new BufferAttribute(normals, 3));
  surface.setAttribute('uv', new BufferAttribute(uvs, 2));
  surface.setIndex(index);
  const edges = new BufferGeometry();
  edges.setAttribute('position', new BufferAttribute(edgePositions, 3));

  return {
    surface,
    edges,
    update(s) {
      let c = 0;
      let e = 0;
      for (const points of poseAt(t, s)) {
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
    },
    dispose() {
      surface.dispose();
      edges.dispose();
    },
  };
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
