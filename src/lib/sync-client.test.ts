import { describe, expect, it } from 'vitest';
import { createSyncMutation } from './sync-client';

describe('sync privacy boundary', () => {
  it('allows tool preset data without media references', () => {
    expect(
      createSyncMutation('preset', 'web', 'upsert', {
        toolId: 'resize',
        name: 'Web delivery',
        longEdge: 2048,
      }).entityId,
    ).toBe('web');
  });

  it('rejects paths and image-derived data before enqueueing', () => {
    expect(() =>
      createSyncMutation('preset', 'unsafe', 'upsert', {
        toolId: 'resize',
        sourcePath: '/Users/example/private.jpg',
      }),
    ).toThrow('sourcePath');
  });
});
