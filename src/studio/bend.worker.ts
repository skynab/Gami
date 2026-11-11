/// <reference lib="webworker" />
import { applyOp, replay, type Op } from '../fold/ops';
import type { OrigamiModel } from '../fold/types';

/**
 * Solves a bend off the page's thread (see bendJob.ts), so the Studio stays usable while it works: a new bend step,
 * or a model folded again from a changed step, its bends solved again.
 */
self.onmessage = (e: MessageEvent<{ model: OrigamiModel; op: Op } | { model: OrigamiModel; from: number }>) => {
  try {
    if ('from' in e.data) {
      self.postMessage({ ok: true, replayed: replay(e.data.model, e.data.from) });
      return;
    }
    const { frame, via } = applyOp(e.data.model, e.data.op);
    self.postMessage({ ok: true, frame, via });
  } catch (err) {
    self.postMessage({ ok: false, message: err instanceof Error ? err.message : String(err) });
  }
};
