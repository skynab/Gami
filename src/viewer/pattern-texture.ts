import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { ACROSS, aspectOf, patternCanvas, type Pattern } from './patterns';

const textures = new Map<string, CanvasTexture>();

/**
 * A pattern (./patterns.ts) as a texture for a side of the paper, in the paper's colour, repeated `ACROSS` times
 * across a sheet of width 1 (the viewer's texture coordinates are points on the sheet). Made once for each pattern
 * and colour.
 */
export function patternTexture(pattern: Pattern, colour: string): CanvasTexture {
  const key = `${pattern} ${colour}`;
  let texture = textures.get(key);
  if (!texture) {
    texture = new CanvasTexture(patternCanvas(pattern, colour));
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(ACROSS, ACROSS / aspectOf(pattern));
    texture.anisotropy = 4;
    textures.set(key, texture);
  }
  return texture;
}
