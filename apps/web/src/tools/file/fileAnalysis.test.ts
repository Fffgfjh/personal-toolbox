import { describe, expect, it } from 'vitest';
import { detectFileType, formatBytes } from './fileAnalysis';

describe('local file analysis', () => {
  it('prefers content signatures over misleading names', () => {
    const bytes = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(detectFileType(bytes, 'photo.jpg', 'image/jpeg')).toMatchObject({ extension: '.pdf', confidence: 'signature' });
  });

  it('falls back to browser MIME and extension without claiming a signature match', () => {
    expect(detectFileType(new Uint8Array(), 'notes.txt', 'text/plain')).toMatchObject({ mime: 'text/plain', confidence: 'browser' });
    expect(formatBytes(1536)).toBe('1.50 KB');
  });
});
