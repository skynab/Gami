import { fromFoldFile, toFoldFile, type FoldFile } from '../fold/fold-format';
import { replay } from '../fold/ops';
import type { OrigamiModel } from '../fold/types';

/**
 * Sharing a design by a link with nothing uploaded: the design travels in the address itself, after `#` (which
 * browsers don't send to the server). The link carries what a .fold file does less every step's paper: its words and
 * the operation that made it, from which opening the link folds it again, as the Studio does when an earlier step
 * changes. A bend is solved again on opening, so a design with one opens a little slower.
 */

/** What a step keeps in a link: everything but its paper, which folding it again gives back. */
const KEPT = ['frame_title', 'gami:text', 'gami:kind', 'gami:section', 'gami:op'] as const;
/** The paper's own fields in a .fold file, which a link leaves out of every step (the start keeps them). */
const PAPER = ['vertices_coords', 'faces_vertices', 'gami:vertices_paper', 'gami:faces_parent', 'gami:faces_layer', 'gami:cuts', 'gami:tapes', 'gami:soft'] as const;

export class ShareError extends Error {}

/** The text after `#` in a link to `model`. Fails if a step has no operation to fold it again from. */
export async function shareText(model: OrigamiModel): Promise<string> {
  const missing = model.steps.findIndex((s) => !s.op);
  if (missing >= 0) throw new ShareError(`step ${missing + 1} can’t be folded again from its file`);
  const file = toFoldFile(model);
  const small = {
    ...file,
    file_frames: file.file_frames.map((f) => Object.fromEntries(KEPT.filter((k) => k in f).map((k) => [k, f[k as keyof typeof f]]))),
  };
  return toBase64Url(await squeeze(new TextEncoder().encode(JSON.stringify(small))));
}

/** The design a link's text carries, folded again step by step. */
export async function openShared(text: string): Promise<OrigamiModel> {
  let small: FoldFile;
  try {
    small = JSON.parse(new TextDecoder().decode(await unsqueeze(fromBase64Url(text))));
  } catch {
    throw new ShareError('this link is incomplete or damaged');
  }
  if (!small || !Array.isArray(small.file_frames)) throw new ShareError('this link is incomplete or damaged');
  // Each step stands on the start's paper until it's folded again.
  const start = Object.fromEntries(PAPER.filter((k) => k in small).map((k) => [k, small[k as keyof FoldFile]]));
  const file = { ...small, file_frames: small.file_frames.map((f) => ({ ...start, ...f })) } as FoldFile;
  const warnings: string[] = [];
  const read = fromFoldFile(file, warnings);
  if (warnings.length) throw new ShareError(warnings[0]);
  const { model, error } = replay(read);
  if (error) throw new ShareError(`step ${error.step}: ${error.message}`);
  return model;
}

async function squeeze(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unsqueeze(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
