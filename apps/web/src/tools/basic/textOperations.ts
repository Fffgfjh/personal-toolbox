import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { format as formatSql } from 'sql-formatter';

export function formatJson(input: string, spaces = 2) {
  return JSON.stringify(JSON.parse(input), null, spaces);
}

export function minifyJson(input: string) {
  return JSON.stringify(JSON.parse(input));
}

export function yamlToJson(input: string) {
  return JSON.stringify(parseYaml(input), null, 2);
}

export function jsonToYaml(input: string) {
  return stringifyYaml(JSON.parse(input));
}

export function encodeBase64(input: string) {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeBase64(input: string) {
  const binary = atob(input.replace(/\s+/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

export function decodeJwt(input: string) {
  const parts = input.trim().split('.');
  if (parts.length < 2) throw new Error('JWT 至少需要包含头部和载荷。');
  const decodePart = (part: string) => JSON.parse(decodeBase64(part.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(part.length / 4) * 4, '=')));
  return JSON.stringify({ header: decodePart(parts[0]!), payload: decodePart(parts[1]!) }, null, 2);
}

export type CaseMode = 'upper' | 'lower' | 'title' | 'camel' | 'snake' | 'kebab' | 'constant';

function words(input: string) {
  return input
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export function convertCase(input: string, mode: CaseMode) {
  const tokens = words(input);
  switch (mode) {
    case 'upper': return input.toUpperCase();
    case 'lower': return input.toLowerCase();
    case 'title': return tokens.map((token) => token[0]!.toUpperCase() + token.slice(1).toLowerCase()).join(' ');
    case 'camel': return tokens.map((token, index) => index === 0 ? token.toLowerCase() : token[0]!.toUpperCase() + token.slice(1).toLowerCase()).join('');
    case 'snake': return tokens.map((token) => token.toLowerCase()).join('_');
    case 'kebab': return tokens.map((token) => token.toLowerCase()).join('-');
    case 'constant': return tokens.map((token) => token.toUpperCase()).join('_');
  }
}

export function slugify(input: string) {
  return words(input).map((token) => token.toLowerCase()).join('-');
}

export function textStatistics(input: string) {
  const trimmed = input.trim();
  const lines = input ? input.split(/\r?\n/).length : 0;
  const wordList = trimmed ? trimmed.split(/\s+/u) : [];
  return {
    characters: [...input].length,
    charactersWithoutSpaces: [...input.replace(/\s/gu, '')].length,
    words: wordList.length,
    lines,
    bytes: new TextEncoder().encode(input).byteLength,
    readingMinutes: wordList.length ? Math.max(1, Math.ceil(wordList.length / 250)) : 0,
  };
}

export function convertNumberBase(input: string, fromBase: number, toBase: number) {
  if (fromBase < 2 || fromBase > 36 || toBase < 2 || toBase > 36) throw new Error('进制必须在 2 到 36 之间。');
  const normalized = input.trim().toLowerCase();
  if (!normalized) return '';
  const negative = normalized.startsWith('-');
  const digits = negative ? normalized.slice(1) : normalized;
  let value = 0n;
  for (const character of digits) {
    const digit = parseInt(character, 36);
    if (!Number.isInteger(digit) || digit >= fromBase) throw new Error(`字符“${character}”不属于 ${fromBase} 进制。`);
    value = value * BigInt(fromBase) + BigInt(digit);
  }
  return `${negative ? '-' : ''}${value.toString(toBase)}`;
}

export function encodeHtmlEntities(input: string) {
  return input.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export function decodeHtmlEntities(input: string) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = input;
  return textarea.value;
}

export function formatXml(input: string) {
  const source = input.replace(/>\s*</g, '><').trim();
  if (!source) return '';
  const tokens = source.replace(/(>)(<)(\/*)/g, '$1\n$2$3').split('\n');
  let depth = 0;
  return tokens.map((token) => {
    if (/^<\//.test(token)) depth = Math.max(0, depth - 1);
    const line = `${'  '.repeat(depth)}${token}`;
    if (/^<[^!?/][^>]*[^/]?>$/.test(token) && !token.includes('</')) depth += 1;
    return line;
  }).join('\n');
}

export function formatSqlText(input: string) {
  return formatSql(input, { language: 'sql', tabWidth: 2, keywordCase: 'upper' });
}

export function parseColor(input: string) {
  const normalized = input.trim().replace(/^#/, '');
  const hex = normalized.length === 3 ? [...normalized].map((character) => character + character).join('') : normalized;
  if (!/^[0-9a-f]{6}$/i.test(hex)) throw new Error('请输入 3 位或 6 位十六进制颜色。');
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const [hue, saturation, lightness] = rgbToHsl(red, green, blue);
  return { hex: `#${hex.toUpperCase()}`, rgb: `rgb(${red}, ${green}, ${blue})`, hsl: `hsl(${hue}, ${saturation}%, ${lightness}%)` };
}

function rgbToHsl(red: number, green: number, blue: number) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }
  const lightness = (max + min) / 2;
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
  return [hue, Math.round(saturation * 100), Math.round(lightness * 100)];
}
