import { describe, expect, it } from 'vitest';
import { apiUrl, responseFilename } from './client';

describe('frontend API boundary', () => {
  it('joins configurable API bases without leaking an upstream URL', () => {
    expect(apiUrl('/v1/document-tools', 'https://api.example.com/api/')).toBe('https://api.example.com/api/v1/document-tools');
    expect(() => apiUrl('/health', '')).toThrow('前端尚未配置 API 地址');
  });

  it('sanitizes download filenames', () => {
    expect(responseFilename('attachment; filename="../../private/result.pdf"', 'fallback.pdf')).toBe('result.pdf');
    expect(responseFilename(null, 'fallback.pdf')).toBe('fallback.pdf');
  });
});
