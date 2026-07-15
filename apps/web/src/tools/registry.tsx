import {
  Binary, Braces, CaseSensitive, Clock3, Code2, Crop, Database, FileArchive, FileCheck2, FileCog, FileImage,
  FileKey2, FileOutput, FileScan, FileText, Fingerprint, Hash, ImageDown, ImageUp, KeyRound,
  Link2, LockKeyhole, Palette, QrCode, Regex, ScanText, ShieldCheck, Sparkles, TextCursorInput, Type,
  UnlockKeyhole, WandSparkles,
} from 'lucide-react';
import { lazy } from 'react';
import { documentToolCatalog } from '@personal-toolbox/contracts';
import type { DocumentToolId } from '@personal-toolbox/contracts';
import type { ToolCategory, ToolDefinition } from './types';
import type { UtilityKind } from './basic/UtilityTool';
import type { ImageStudioMode } from './image/ImageStudio';

const UtilityTool = lazy(() => import('./basic/UtilityTool').then((module) => ({ default: module.UtilityTool })));
const QrTool = lazy(() => import('./basic/QrTool').then((module) => ({ default: module.QrTool })));
const FileInspector = lazy(() => import('./file/FileInspector').then((module) => ({ default: module.FileInspector })));
const ImageStudio = lazy(() => import('./image/ImageStudio').then((module) => ({ default: module.ImageStudio })));
const DocumentTool = lazy(() => import('./document/DocumentTool').then((module) => ({ default: module.DocumentTool })));

export const toolCategories: ToolCategory[] = [
  { id: 'image', name: '图片处理', description: '可视化裁剪、压缩、缩放、转换与隐私清理。' },
  { id: 'file', name: '本地文件', description: '在浏览器内识别文件并计算摘要。' },
  { id: 'document', name: 'PDF 与文档', description: '通过独立 API 处理 PDF、Office 和 OCR 任务。' },
  { id: 'developer', name: '开发工具', description: '格式化、编码、摘要和调试常用数据。' },
  { id: 'text', name: '文本工具', description: '转换、分析和清理日常文本。' },
  { id: 'generator', name: '生成工具', description: '安全生成标识、密码、二维码和摘要。' },
];

const imageTools: ToolDefinition[] = [
  imageTool('image-compress', '互动图片压缩', '实时调整质量并比较输出体积。', 'compress', ImageDown, true),
  imageTool('image-resize', '图片缩放', '锁定比例调整尺寸，并在导出前预览。', 'resize', ImageUp, true),
  imageTool('image-crop', '互动图片裁剪', '直接拖动和缩放裁剪框，支持旋转与翻转。', 'crop', Crop, true),
  imageTool('image-convert', '图片格式转换', '在 JPEG、PNG 和 WebP 之间转换。', 'convert', FileImage),
  imageTool('image-metadata-cleaner', '图片隐私清理', '重新编码并移除 EXIF、定位等元数据。', 'metadata', ShieldCheck),
];

const fileTools: ToolDefinition[] = [
  { id: 'file-checksum', name: '文件摘要校验', description: '分块计算 MD5 和 SHA-256，不上传文件。', category: 'file', keywords: ['hash', 'md5', 'sha256', 'checksum', '校验'], icon: Fingerprint, featured: true, render: () => <FileInspector mode="checksum" /> },
  { id: 'file-type', name: '文件类型识别', description: '依据文件头签名识别真实类型。', category: 'file', keywords: ['mime', 'magic', 'signature', '类型'], icon: FileCheck2, render: () => <FileInspector mode="type" /> },
];

const documentIcons: Partial<Record<DocumentToolId, typeof FileText>> = {
  'pdf-to-word': FileOutput,
  'office-to-pdf': FileText,
  'image-to-pdf': FileImage,
  'pdf-to-image': FileArchive,
  'pdf-ocr': ScanText,
  'pdf-watermark': WandSparkles,
  'pdf-protect': LockKeyhole,
  'pdf-unlock': UnlockKeyhole,
  'pdf-metadata-remover': FileCog,
  'pdf-page-numbers': TextCursorInput,
  'pdf-repair': FileScan,
  'pdf-compress': FileArchive,
};

const documentTools: ToolDefinition[] = documentToolCatalog.map((definition) => ({
  id: definition.id,
  name: definition.name,
  description: definition.description,
  category: 'document',
  keywords: ['pdf', 'office', 'ocr', ...definition.inputExtensions],
  icon: documentIcons[definition.id] || FileText,
  featured: ['pdf-merge', 'office-to-pdf', 'pdf-ocr'].includes(definition.id),
  serverSide: true,
  render: () => <DocumentTool definition={definition} />,
}));

const developerTools: ToolDefinition[] = [
  utility('json-format', 'JSON 格式化', '校验、格式化或压缩 JSON。', 'developer', 'json', Braces, ['json', 'format', 'beautify']),
  utility('yaml-json', 'YAML / JSON 转换', '在 YAML 和 JSON 之间双向转换。', 'developer', 'yaml-json', Database, ['yaml', 'json', 'convert']),
  utility('base64-text', 'Base64 文本转换', '安全编码和解码 UTF-8 文本。', 'developer', 'base64', Binary, ['base64', 'encode', 'decode']),
  utility('url-codec', 'URL 编码解码', '编码或解码 URL 字符串。', 'developer', 'url', Link2, ['url', 'uri', 'encode']),
  utility('jwt-decoder', 'JWT 解码', '本地查看 JWT 头部和载荷。', 'developer', 'jwt', FileKey2, ['jwt', 'token', 'decode']),
  utility('sql-formatter', 'SQL 格式化', '整理 SQL 缩进和关键字。', 'developer', 'sql', Database, ['sql', 'format']),
  utility('xml-formatter', 'XML 格式化', '整理 XML 层级和缩进。', 'developer', 'xml', Code2, ['xml', 'format']),
  utility('regex-tester', '正则表达式测试', '查看匹配内容、位置和捕获组。', 'developer', 'regex', Regex, ['regex', 'regexp', 'match']),
  utility('number-base', '进制转换', '在 2 到 36 进制之间转换整数。', 'developer', 'number-base', Binary, ['binary', 'hex', 'decimal']),
  utility('color-converter', '颜色转换', '查看 HEX、RGB 与 HSL 表示。', 'developer', 'color', Palette, ['color', 'hex', 'rgb', 'hsl']),
];

const textTools: ToolDefinition[] = [
  utility('case-converter', '大小写转换', '转换 camelCase、snake_case 等命名。', 'text', 'case', CaseSensitive, ['case', 'camel', 'snake']),
  utility('text-statistics', '文本统计', '统计字符、单词、行、字节和阅读时间。', 'text', 'statistics', Type, ['count', 'words', 'characters']),
  utility('html-entities', 'HTML 实体转换', '编码或解码 HTML 特殊字符。', 'text', 'html-entities', Code2, ['html', 'entity', 'escape']),
  utility('slug-generator', 'Slug 生成', '把标题转换为简洁 URL 片段。', 'text', 'slug', Link2, ['slug', 'url', 'title']),
  utility('timestamp-converter', '时间戳转换', '在 Unix 时间和本地时间之间转换。', 'text', 'timestamp', Clock3, ['timestamp', 'unix', 'date']),
];

const generatorTools: ToolDefinition[] = [
  utility('text-hash', '文本摘要', '计算 MD5、SHA-1 或 SHA-256。', 'generator', 'hash', Hash, ['hash', 'sha256', 'md5']),
  utility('hmac-generator', 'HMAC 签名', '使用 SHA-256 生成消息认证码。', 'generator', 'hmac', KeyRound, ['hmac', 'signature', 'sha256']),
  utility('uuid-generator', 'UUID 生成', '使用浏览器安全随机源生成 UUID v4。', 'generator', 'uuid', Sparkles, ['uuid', 'guid', 'random']),
  utility('password-generator', '密码生成', '生成可调长度的高强度随机密码。', 'generator', 'password', KeyRound, ['password', 'random', 'secure']),
  utility('bcrypt-generator', 'Bcrypt 摘要', '为密码生成带盐 Bcrypt 摘要。', 'generator', 'bcrypt', Fingerprint, ['bcrypt', 'password', 'hash']),
  { id: 'qr-code', name: '二维码生成', description: '实时生成并下载 PNG 二维码。', category: 'generator', keywords: ['qr', 'qrcode', '二维码'], icon: QrCode, render: () => <QrTool /> },
];

export const toolCatalog: ToolDefinition[] = [
  ...imageTools,
  ...fileTools,
  ...documentTools,
  ...developerTools,
  ...textTools,
  ...generatorTools,
];

export function findTool(id: string) {
  return toolCatalog.find((tool) => tool.id === id);
}

function imageTool(id: string, name: string, description: string, mode: ImageStudioMode, icon: ToolDefinition['icon'], featured = false): ToolDefinition {
  return { id, name, description, category: 'image', keywords: ['image', '图片', mode], icon, featured, render: () => <ImageStudio mode={mode} /> };
}

function utility(id: string, name: string, description: string, category: ToolDefinition['category'], kind: UtilityKind, icon: ToolDefinition['icon'], keywords: string[]): ToolDefinition {
  return { id, name, description, category, keywords, icon, render: () => <UtilityTool kind={kind} /> };
}
