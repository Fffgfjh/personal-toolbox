import { describe, expect, it } from 'vitest';
import { convertCase, convertNumberBase, decodeJwt, formatJson, parseColor, slugify, textStatistics } from './textOperations';

describe('browser text operations', () => {
  it('formats JSON and reports malformed input', () => {
    expect(formatJson('{"ok":true}')).toBe('{\n  "ok": true\n}');
    expect(() => formatJson('{')).toThrow();
  });

  it('converts names and numbers without evaluating code', () => {
    expect(convertCase('hello World', 'snake')).toBe('hello_world');
    expect(slugify('Hello, Personal Toolbox!')).toBe('hello-personal-toolbox');
    expect(convertNumberBase('ff', 16, 10)).toBe('255');
    expect(() => convertNumberBase('g', 16, 10)).toThrow();
  });

  it('decodes JWT content without verifying or executing it', () => {
    const token = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjMifQ.';
    expect(JSON.parse(decodeJwt(token))).toEqual({ header: { alg: 'none' }, payload: { sub: '123' } });
  });

  it('returns useful text and color facts', () => {
    expect(textStatistics('one two\nthree')).toMatchObject({ words: 3, lines: 2 });
    expect(parseColor('#0f9f76')).toMatchObject({ hex: '#0F9F76', rgb: 'rgb(15, 159, 118)' });
  });
});
