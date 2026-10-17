import type { ThreeEvent } from '@react-three/fiber';
import { useMemo, useState } from 'react';
import { CanvasTexture, SRGBColorSpace, Vector3 } from 'three';
import type { ThemeColors } from '../app/useThemeColors';
import { useViewer } from '../state/viewer';

/** In three.js box material order: +X, −X, +Y, −Y, +Z, −Z. */
const FACES = ['Right', 'Left', 'Top', 'Bottom', 'Front', 'Back'];

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

/**
 * A clickable cube in the corner that shows which way the camera faces. A face looks straight at that side;
 * an edge or corner looks from between its faces. Lives inside drei's GizmoHelper, which keeps it turned
 * with the camera. Drei's own view cube isn't used because its label textures come out washed out.
 */
export function ViewCube({ colors }: { colors: ThemeColors }) {
  const [hover, setHover] = useState<number | null>(null);
  const textures = useMemo(() => FACES.map((label) => faceTexture(label, colors)), [colors]);
  const lookFrom = (e: ThreeEvent<MouseEvent>, d: Vector3) => {
    e.stopPropagation();
    useViewer.getState().lookFrom([d.x, d.y, d.z]);
  };

  return (
    <group scale={56}>
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
