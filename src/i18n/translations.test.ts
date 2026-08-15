import { describe, expect, it } from 'vitest';
import en from './en.json';
import { applyDocumentLanguage } from './language';
import vi from './vi.json';

function leafKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function valueAt(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (typeof current !== 'object' || current === null) return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

describe('desktop translations', () => {
  it('keeps complete, non-empty English and Vietnamese catalogs', () => {
    const englishKeys = leafKeys(en).sort();
    const vietnameseKeys = leafKeys(vi).sort();

    expect(vietnameseKeys).toEqual(englishKeys);
    for (const key of englishKeys) {
      expect(String(valueAt(en, key)).trim(), `English ${key}`).not.toBe('');
      expect(String(valueAt(vi, key)).trim(), `Vietnamese ${key}`).not.toBe('');
    }
  });

  it('localizes every toolbox tool and shared job state', () => {
    const requiredKeys = [
      'toolbox.tools.ingestRename.title',
      'toolbox.tools.resize.title',
      'toolbox.tools.minimize.title',
      'toolbox.tools.sequenceGrouper.title',
      'toolbox.tools.metadataCleaner.title',
      'toolbox.tools.beforeAfter.title',
      'utilities.processing',
      'utilities.cancel',
      'utilities.results',
      'utilities.warnings',
    ];

    for (const key of requiredKeys) {
      expect(valueAt(en, key), `English ${key}`).toBeTypeOf('string');
      expect(valueAt(vi, key), `Vietnamese ${key}`).toBeTypeOf('string');
    }
  });

  it('updates the document language used by assistive technology', () => {
    applyDocumentLanguage('vi');
    expect(document.documentElement.lang).toBe('vi');
    applyDocumentLanguage('en-US');
    expect(document.documentElement.lang).toBe('en');
  });
});
