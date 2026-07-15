import { describe, expect, it } from 'vitest';
import { documentToolCatalog, findDocumentTool } from './index.js';

describe('document tool contract', () => {
  it('keeps IDs unique and exposes fifteen approved operations', () => {
    const ids = documentToolCatalog.map((tool) => tool.id);
    expect(ids).toHaveLength(15);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('describes safety-relevant file constraints', () => {
    const merge = findDocumentTool('pdf-merge');
    expect(merge).toMatchObject({ minFiles: 2, maxFiles: 10, inputExtensions: ['.pdf'] });
  });
});
