export interface DetectedFileType {
  label: string;
  extension: string;
  mime: string;
  confidence: 'signature' | 'browser' | 'extension' | 'unknown';
}

const signatures: Array<{ bytes: number[]; offset?: number; type: Omit<DetectedFileType, 'confidence'> }> = [
  { bytes: [0x25, 0x50, 0x44, 0x46], type: { label: 'PDF 文档', extension: '.pdf', mime: 'application/pdf' } },
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], type: { label: 'PNG 图片', extension: '.png', mime: 'image/png' } },
  { bytes: [0xff, 0xd8, 0xff], type: { label: 'JPEG 图片', extension: '.jpg', mime: 'image/jpeg' } },
  { bytes: [0x47, 0x49, 0x46, 0x38], type: { label: 'GIF 图片', extension: '.gif', mime: 'image/gif' } },
  { bytes: [0x52, 0x49, 0x46, 0x46], type: { label: 'RIFF 容器', extension: '.riff', mime: 'application/octet-stream' } },
  { bytes: [0x50, 0x4b, 0x03, 0x04], type: { label: 'ZIP / Office 压缩容器', extension: '.zip', mime: 'application/zip' } },
  { bytes: [0x1f, 0x8b], type: { label: 'GZIP 压缩文件', extension: '.gz', mime: 'application/gzip' } },
  { bytes: [0x7f, 0x45, 0x4c, 0x46], type: { label: 'ELF 可执行文件', extension: '', mime: 'application/x-elf' } },
  { bytes: [0x4d, 0x5a], type: { label: 'Windows 可执行文件', extension: '.exe', mime: 'application/vnd.microsoft.portable-executable' } },
];

export function detectFileType(bytes: Uint8Array, filename = '', browserMime = ''): DetectedFileType {
  const signature = signatures.find((entry) => entry.bytes.every((byte, index) => bytes[(entry.offset || 0) + index] === byte));
  if (signature) return { ...signature.type, confidence: 'signature' };
  if (browserMime) return { label: browserMime, extension: extensionOf(filename), mime: browserMime, confidence: 'browser' };
  const extension = extensionOf(filename);
  if (extension) return { label: `${extension.slice(1).toUpperCase()} 文件`, extension, mime: 'application/octet-stream', confidence: 'extension' };
  return { label: '未知文件类型', extension: '', mime: 'application/octet-stream', confidence: 'unknown' };
}

export function extensionOf(filename: string) {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(lastDot).toLowerCase() : '';
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(2)} ${units[unit]}`;
}
