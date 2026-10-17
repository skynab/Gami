import { Edges } from '@react-three/drei';
import { useMemo } from 'react';
import { BackSide, CanvasTexture, FrontSide, PlaneGeometry, RepeatWrapping, SRGBColorSpace } from 'three';

export interface PaperColors {
  front: string;
  back: string;
}

/** Default paper: Gami's indigo on one side, warm white on the other. Models can override it. */
export const DEFAULT_PAPER: PaperColors = { front: '#5b54e8', back: '#f6f3ec' };

/**
 * One flat sheet lying on the table, front side up. Two meshes share the geometry, one per side,
 * so each side gets its own colour. Milestone 2 replaces the plane with the folded mesh of each step.
 */
export function PaperMesh({ size, colors = DEFAULT_PAPER, edgeColor }: {
  size: [number, number];
  colors?: PaperColors;
  edgeColor: string;
}) {
  const [w, h] = size;
  const geometry = useMemo(() => new PlaneGeometry(w, h).rotateX(-Math.PI / 2), [w, h]);
  const grain = useMemo(paperGrain, []);

  return (
    // Lifted a hair off the table so it never fights with the shadow.
    <group position-y={0.002}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={colors.front} map={grain} side={FrontSide} roughness={0.8} />
        {/* The sheet has no thickness, so the outline is what you see edge-on from the front or side. */}
        <Edges color={edgeColor} />
      </mesh>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={colors.back} map={grain} side={BackSide} roughness={0.85} />
      </mesh>
    </group>
  );
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
