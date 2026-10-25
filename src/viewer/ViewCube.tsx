import { GizmoHelper } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CanvasTexture, SRGBColorSpace, Vector3 } from 'three';
import type { ThemeColors } from '../app/useThemeColors';
import { useViewer } from '../state/viewer';

/** In three.js box material order: +X, −X, +Y, −Y, +Z, −Z. */
const FACES = ['right', 'left', 'top', 'bottom', 'front', 'back'] as const;

const at = (xyz: number[]) => new Vector3(...xyz).multiplyScalar(0.38);
const CORNERS = [
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
].map(at);
const EDGES = [
  [1, 1, 0], [1, 0, 1], [1, 0, -1], [1, -1, 0], [0, 1, 1], [0, 1, -1],
  [0, -1, 1], [0, -1, -1], [-1, 1, 0], [-1, 0, 1], [-1, 0, -1], [-1, -1, 0],
].map(at);
/** Edges are long along the axis they run on, corners are small cubes. Both stick out of the faces a little. */
const sizeOf = (p: Vector3): [number, number, number] =>
  p.toArray().map((v) => (v === 0 ? 0.5 : 0.25)) as [number, number, number];

/** The cube's size in pixels, and how far its centre sits in from the corner. */
const SIZE = 56;
const MARGIN = 76;
const NARROW_MARGIN = 60;
/** How long to hold the cube before it grows, and how far the pointer may wander meanwhile (pixels). */
const HOLD_MS = 400;
const HOLD_SLOP = 6;
/** How long it takes to grow or shrink. */
const GROW_MS = 160;

/**
 * The view cube in the top-right corner. Held down, it grows (and comes in from the corner to fit) so a face,
 * edge or corner is easier to pick; it shrinks back once one is picked, or on a click anywhere else or Esc.
 */
export function CubeCorner({ colors }: { colors: ThemeColors }) {
  const zoomed = useViewer((s) => s.cubeZoomed);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  // 0 small … 1 grown, eased along each frame towards where it's headed.
  const [grown, setGrown] = useState(0);
  useFrame((_, delta) => {
    const goal = zoomed ? 1 : 0;
    if (grown === goal) return;
    const step = (delta * 1000) / GROW_MS;
    setGrown(goal > grown ? Math.min(goal, grown + step) : Math.max(goal, grown - step));
    invalidate();
  });
  useEffect(() => {
    invalidate();
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && useViewer.getState().setCubeZoomed(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomed, invalidate]);

  const narrow = size.width <= 560;
  // Grown, about a third of the view's shorter side; its corners reach out ~0.87 of its size from the centre.
  const big = Math.max(SIZE, Math.min(150, 0.3 * Math.min(size.width, size.height)));
  const ease = grown * grown * (3 - 2 * grown);
  const scale = SIZE + (big - SIZE) * ease;
  const small = narrow ? NARROW_MARGIN : MARGIN;
  const margin = small + (Math.max(small, 0.87 * big + 16) - small) * ease;
  return (
    <GizmoHelper alignment="top-right" margin={[margin, margin]}>
      <ViewCube colors={colors} scale={scale} />
    </GizmoHelper>
  );
}

/**
 * A clickable cube in the corner that shows which way the camera faces. A face looks straight at that side;
 * an edge or corner looks from between its faces. Lives inside drei's GizmoHelper, which keeps it turned
 * with the camera. Drei's own view cube isn't used because its label textures come out washed out.
 */
function ViewCube({ colors, scale }: { colors: ThemeColors; scale: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const { t, i18n } = useTranslation();
  const textures = useMemo(() => FACES.map((face) => faceTexture(t(`cube.${face}`), colors)), [colors, t, i18n.language]);
  // Set when a hold grew the cube, so the click that ends the hold doesn't also pick a view.
  const held = useRef(false);
  const lookFrom = (e: ThreeEvent<MouseEvent>, d: Vector3) => {
    e.stopPropagation();
    if (held.current) return;
    const viewer = useViewer.getState();
    viewer.lookFrom([d.x, d.y, d.z]);
    viewer.setCubeZoomed(false);
  };
  const startHold = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.button !== 0 || useViewer.getState().cubeZoomed) return;
    const [x, y] = [e.nativeEvent.clientX, e.nativeEvent.clientY];
    held.current = false;
    const timer = window.setTimeout(() => {
      held.current = true;
      useViewer.getState().setCubeZoomed(true);
    }, HOLD_MS);
    // Moved too far, it's a drag turning the camera; let go, a click. Either way, no hold.
    const end = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      // Forget the hold once the click it makes (if any) has been and gone.
      if (held.current) setTimeout(() => (held.current = false));
    };
    const move = (m: PointerEvent) => Math.hypot(m.clientX - x, m.clientY - y) > HOLD_SLOP && end();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  return (
    <group scale={scale} onPointerDown={startHold}>
      <mesh
        onPointerMove={(e) => {
          e.stopPropagation();
          setHover(Math.floor((e.faceIndex ?? 0) / 2));
        }}
        onPointerOut={() => setHover(null)}
        onClick={(e) => e.face && lookFrom(e, e.face.normal)}
      >
        <boxGeometry />
        {textures.map((map, i) => (
          <meshBasicMaterial key={i} attach={`material-${i}`} map={map} color={hover === i ? colors['accent-soft'] : '#ffffff'} toneMapped={false} />
        ))}
      </mesh>
      {[...EDGES, ...CORNERS].map((p, i) => (
        <Handle key={i} position={p} color={colors.accent} onClick={(e) => lookFrom(e, p)} />
      ))}
    </group>
  );
}

function Handle({ position, color, onClick }: { position: Vector3; color: string; onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <mesh
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
      onClick={onClick}
    >
      <boxGeometry args={sizeOf(position)} />
      <meshBasicMaterial color={color} transparent opacity={hover ? 0.55 : 0} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function faceTexture(label: string, colors: ThemeColors): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = colors.surface;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, 128, 128);
  ctx.fillStyle = colors.fg;
  ctx.font = '600 24px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.toUpperCase(), 64, 66);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
