import { FoldError } from '../fold/fold';
import type { Said } from '../fold/messages';
import type { Op, Replay } from '../fold/ops';
import type { FoldFrame, OrigamiModel } from '../fold/types';

/** Work being done in a worker: its result when it's done, and a way to stop it. */
export interface BendJob<T = { frame: FoldFrame; via?: FoldFrame[] }> {
  done: Promise<T>;
  cancel(): void;
}

export class BendCancelled extends Error {}

/**
 * Solves the bend `op` makes on the paper after `model`'s steps in a Web Worker: the solver can take seconds or
 * more, which on the page's own thread would freeze it. Cancelling stops the worker outright.
 */
export function solveBend(model: OrigamiModel, op: Extract<Op, { op: 'bend' }>): BendJob {
  return inWorker({ model, op }, (d) => ({ frame: d.frame, ...(d.via && { via: d.via }) }));
}

/** Folds `model` again from step `from` in a worker, as studio/steps.ts does, for a change with a bend after it. */
export function replayInWorker(model: OrigamiModel, from: number): BendJob<Replay> {
  return inWorker({ model, from }, (d) => d.replayed);
}

/** Posts `message` to a fresh worker, and reads its answer with `read`. */
// The answer is whatever the worker posted: an op's frames, or a model folded again.
function inWorker<T>(message: unknown, read: (data: { frame: FoldFrame; via?: FoldFrame[]; replayed: Replay }) => T): BendJob<T> {
  const worker = new Worker(new URL('./bend.worker.ts', import.meta.url), { type: 'module' });
  let fail: (e: Error) => void = () => {};
  const done = new Promise<T>((resolve, reject) => {
    fail = reject;
    worker.onmessage = (e: MessageEvent<({ ok: true } & Parameters<typeof read>[0]) | { ok: false; said: Said }>) => {
      worker.terminate();
      if (e.data.ok) resolve(read(e.data));
      else reject(new FoldError(e.data.said.code ?? e.data.said.message, e.data.said.params));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(e.message ? new Error(e.message) : new FoldError('bendFailed'));
    };
  });
  worker.postMessage(message);
  return {
    done,
    cancel: () => {
      worker.terminate();
      fail(new BendCancelled());
    },
  };
}
