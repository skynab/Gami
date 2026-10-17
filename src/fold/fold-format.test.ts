import { describe, expect, it } from 'vitest';
import { basics } from '../models/basics';
import { fromFoldFile, toFoldFile } from './fold-format';

describe('.fold files', () => {
  it('round-trips a model through JSON', () => {
    const json = JSON.stringify(toFoldFile(basics));
    // Through JSON, so −0 in the source compares equal to the 0 the file stores.
    expect(fromFoldFile(JSON.parse(json))).toEqual(JSON.parse(JSON.stringify(basics)));
  });

  it('uses standard FOLD fields for the geometry', () => {
    const file = toFoldFile(basics);
    expect(file.file_frames).toHaveLength(basics.steps.length);
    expect(file.file_frames[0].frame_title).toBe(basics.steps[0].title);
    expect(file.vertices_coords[0]).toHaveLength(3);
  });

  it('rejects files from other tools', () => {
    expect(() => fromFoldFile({ file_spec: 1.1, vertices_coords: [] } as never)).toThrow();
  });
});
