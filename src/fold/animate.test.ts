import { describe, expect, it } from 'vitest';
import { basics } from '../models/basics';
import { crane } from '../models/recipes/crane';
import { envelope } from '../models/recipes/envelope';
import { fox } from '../models/recipes/fox';
import { frog } from '../models/recipes/frog';
import { lily } from '../models/recipes/lily';
import { poseAt, stepTransition, transition } from './animate';
import { crossings } from './collisions';
import { facePositions, framesOf, LAYER_GAP } from './frames';
import { sharedSegment } from './geometry2d';
import type { OrigamiModel, Vec2, Vec3 } from './types';

const frames = framesOf(basics);
const steps = frames.slice(1).map((to, i) => transition(frames[i], to));
const dist = (a: number[], b: number[]) => Math.hypot(...a.map((x, i) => x - b[i]));
const key = ([u, v]: Vec2) => `${u.toFixed(4)},${v.toFixed(4)}`;

describe('folding basics', () => {
  it('keeps every face the same shape as on the unfolded sheet', () => {
    for (const frame of frames) {
      facePositions(frame).forEach((points, f) => {
        const paper = frame.faces_vertices[f].map((v) => frame.vertices_paper[v]);
        for (let i = 0; i < points.length; i++) {
          const j = (i + 1) % points.length;
          expect(dist(points[i], points[j])).toBeCloseTo(dist(paper[i], paper[j]), 6);
        }
      });
    }
  });

  it('points each face at a real parent', () => {
    frames.slice(1).forEach((frame, i) => {
      for (const p of frame.faces_parent ?? []) expect(p).toBeLessThan(frames[i].faces_vertices.length);
    });
  });
});

describe('animating a step', () => {
  it('ends exactly on the new frame', () => {
    steps.forEach((t, i) => {
      const end = facePositions(frames[i + 1]);
      const almost = poseAt(t, 1 - 1e-9);
      t.faces.forEach((f, k) => f.after.forEach((_, c) => expect(dist(almost[k][c], end[k][c])).toBeLessThan(1e-6)));
    });
  });

  it('never stretches a face mid-step', () => {
    for (const t of steps) {
      for (const s of [0.25, 0.5, 0.75]) {
        poseAt(t, s).forEach((points, k) => {
          const paper = t.faces[k].paper;
          for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            expect(dist(points[i], points[j])).toBeCloseTo(dist(paper[i], paper[j]), 6);
          }
        });
      }
    }
  });

  it('keeps faces joined along their creases mid-step', () => {
    for (const t of steps) {
      const pose = poseAt(t, 0.5);
      const seen = new Map<string, Vec3>();
      t.faces.forEach((f, k) =>
        f.paper.forEach((p, c) => {
          const other = seen.get(key(p));
          // Stacked layers are LAYER_GAP apart, so allow a couple of those.
          if (other) expect(dist(other, pose[k][c])).toBeLessThan(3 * LAYER_GAP);
          else seen.set(key(p), pose[k][c]);
        }),
      );
    }
  });

  it('folds paper upwards, never through the table', () => {
    for (const t of steps) {
      for (let s = 0; s <= 1; s += 0.05) {
        for (const points of poseAt(t, s)) for (const p of points) expect(p[1]).toBeGreaterThan(-1e-6);
      }
    }
  });

  it('lifts the paper to turn it over', () => {
    const turnOver = steps[2];
    expect(turnOver.motions).toHaveLength(1);
    expect(turnOver.motions[0].lift).toBeGreaterThan(0.4);
  });

  it('moves the folding half and leaves the rest', () => {
    const fold = steps[3];
    expect(fold.motions).toHaveLength(2);
    expect(fold.motions.map((m) => Math.round(m.angle * 100) / 100).sort()).toEqual([0, 3.14]);
  });
});

describe('compound folds', () => {
  /** How far apart the same point of paper comes, at most, while step k plays: corners at one place on the sheet, on an edge two faces are joined along. */
  const torn = (model: OrigamiModel, k: number, samples = [0.2, 0.4, 0.5, 0.6, 0.8]) => {
    const t = stepTransition(model, k);
    let most = 0;
    for (const s of samples) {
      const pose = poseAt(t, s);
      t.faces.forEach((f, a) =>
        t.faces.forEach((g, b) => {
          if (b <= a || !sharedSegment(f.paper, g.paper)) return;
          f.paper.forEach((p, c) => {
            const d = g.paper.findIndex((q) => key(q) === key(p));
            if (d >= 0) most = Math.max(most, dist(pose[a][c], pose[b][d]));
          });
        }),
      );
    }
    return most;
  };

  it('keeps the paper joined while several creases fold at once', () => {
    const model = crane();
    // The square base's collapse and both petal folds, which each face once played its own way, coming apart.
    for (const k of [9, 15, 21]) expect(torn(model, k), `crane step ${k}`).toBeLessThan(0.01);
  });

  it('keeps the paper joined through petal folds, if grazing a little', () => {
    // The lily's squash-and-petal folds came apart by 0.4 of the sheet, and the frog base's petal folds by
    // 0.2: joining them up all the way grazes paper by up to about twenty layers instead.
    for (const model of [lily(), frog()]) {
      const petals = model.steps.flatMap((s, i) => (s.kind === 'petal' ? [i + 1] : []));
      expect(petals, model.id).toHaveLength(4);
      for (const k of petals) expect(torn(model, k), `${model.id} step ${k}`).toBeLessThan(0.02);
    }
  }, 30_000);

  it('keeps the lily’s petal folds joined right to the end', () => {
    // Joining the paper up there grazed a hair more than a few layers, so it was left to come apart by 0.07 for a
    // moment; it now may graze as deep as the step does elsewhere (and a layer more). The back flap's still does.
    const model = lily();
    for (const title of ['Squash and petal-fold the next flap', 'Squash and petal-fold the last flap']) {
      const k = model.steps.findIndex((s) => s.title === title) + 1;
      expect(torn(model, k, [0.9, 0.925, 0.95, 0.975]), title).toBeLessThan(0.02);
    }
  }, 30_000);

  it('folds the creases round a point in step, so the paper stays joined without passing through itself', () => {
    // Each crease turning at its own steady rate, the ring of them round the envelope's swivel point came apart by
    // a quarter of the sheet halfway, and joined up again it passed 0.03 through the side under it. The fox's
    // squash came apart by 0.05.
    const model = envelope();
    const swivels = model.steps.flatMap((s, i) => (s.title === 'Swivel the corner out' ? [i + 1] : []));
    expect(swivels).toHaveLength(2);
    for (const k of swivels) {
      expect(stepTransition(model, k).hinges?.turns, `step ${k}`).toBeDefined();
      expect(torn(model, k), `step ${k}`).toBeLessThan(0.01);
    }
    expect(crossings(model).filter((c) => c.depth > 2 * LAYER_GAP)).toEqual([]);
    expect(torn(fox(), 13)).toBeLessThan(0.01);
  });
});
