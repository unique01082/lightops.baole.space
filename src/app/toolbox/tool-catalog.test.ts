import { describe, expect, it } from 'vitest';
import { TOOL_CATALOG, getToolDefinition } from './tool-catalog';

describe('tool catalog', () => {
  it('exposes the six v2 tools in the approved order', () => {
    expect(TOOL_CATALOG.map((tool) => tool.id)).toEqual([
      'ingest_rename',
      'resize',
      'minimize',
      'sequence_grouper',
      'metadata_cleaner',
      'before_after',
    ]);
  });

  it('returns the matching tool definition', () => {
    expect(getToolDefinition('resize').titleKey).toBe('toolbox.tools.resize.title');
  });
});
