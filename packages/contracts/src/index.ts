export type DocumentToolId =
  | 'pdf-to-word'
  | 'office-to-pdf'
  | 'image-to-pdf'
  | 'pdf-to-image'
  | 'pdf-merge'
  | 'pdf-split'
  | 'pdf-extract-pages'
  | 'pdf-compress'
  | 'pdf-repair'
  | 'pdf-ocr'
  | 'pdf-watermark'
  | 'pdf-page-numbers'
  | 'pdf-protect'
  | 'pdf-unlock'
  | 'pdf-metadata-remover';

export type ProcessingClass = 'standard' | 'heavy';

export interface DocumentFieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'number' | 'password' | 'select' | 'checkbox' | 'hidden';
  required?: boolean;
  defaultValue?: string | number | boolean;
  options?: Array<{ label: string; value: string | number }>;
  min?: number;
  max?: number;
  step?: number;
}

export interface DocumentToolDefinition {
  id: DocumentToolId;
  name: string;
  description: string;
  inputExtensions: string[];
  outputExtension: string;
  minFiles: number;
  maxFiles: number;
  processingClass: ProcessingClass;
  fields: DocumentFieldDefinition[];
}

export interface ApiErrorBody {
  code: string;
  message: string;
  requestId?: string;
}

export interface HealthResponse {
  status: 'ok';
  service: 'personal-toolbox-api';
  documentServiceConfigured: boolean;
  timestamp: string;
}

const pdf = ['.pdf'];
const office = ['.doc', '.docx', '.odp', '.ods', '.odt', '.ppt', '.pptx', '.rtf', '.txt', '.xls', '.xlsx'];
const images = ['.bmp', '.gif', '.jpeg', '.jpg', '.png', '.tif', '.tiff', '.webp'];

export const documentToolCatalog: readonly DocumentToolDefinition[] = [
  { id: 'pdf-to-word', name: 'PDF 转 Word', description: '把 PDF 转换为可编辑的 DOCX。', inputExtensions: pdf, outputExtension: 'docx', minFiles: 1, maxFiles: 1, processingClass: 'heavy', fields: [] },
  { id: 'office-to-pdf', name: 'Office 转 PDF', description: '把文档、演示文稿或表格转换为 PDF。', inputExtensions: office, outputExtension: 'pdf', minFiles: 1, maxFiles: 1, processingClass: 'heavy', fields: [] },
  { id: 'image-to-pdf', name: '图片转 PDF', description: '把一张或多张图片合并为 PDF。', inputExtensions: images, outputExtension: 'pdf', minFiles: 1, maxFiles: 10, processingClass: 'standard', fields: [
    { name: 'fitOption', label: '适应方式', type: 'select', defaultValue: 'maintainAspectRatio', options: [{ label: '保持比例', value: 'maintainAspectRatio' }, { label: '填满页面', value: 'fillPage' }, { label: '适应页面', value: 'fitDocumentToPage' }] },
    { name: 'autoRotate', label: '自动旋转', type: 'checkbox', defaultValue: true },
  ] },
  { id: 'pdf-to-image', name: 'PDF 转图片', description: '把 PDF 页面批量导出为图片。', inputExtensions: pdf, outputExtension: 'zip', minFiles: 1, maxFiles: 1, processingClass: 'standard', fields: [
    { name: 'imageFormat', label: '图片格式', type: 'select', defaultValue: 'png', options: [{ label: 'PNG', value: 'png' }, { label: 'JPEG', value: 'jpg' }] },
    { name: 'dpi', label: '分辨率（DPI）', type: 'number', defaultValue: 150, min: 72, max: 600, step: 1 },
  ] },
  { id: 'pdf-merge', name: '合并 PDF', description: '按上传顺序合并多个 PDF。', inputExtensions: pdf, outputExtension: 'pdf', minFiles: 2, maxFiles: 10, processingClass: 'standard', fields: [] },
  { id: 'pdf-split', name: '拆分 PDF', description: '按页码或范围拆分 PDF。', inputExtensions: pdf, outputExtension: 'zip', minFiles: 1, maxFiles: 1, processingClass: 'standard', fields: [{ name: 'pageNumbers', label: '拆分页码或范围', type: 'text', defaultValue: 'all', required: true }] },
  { id: 'pdf-extract-pages', name: '提取 PDF 页面', description: '保留指定页面并生成新的 PDF。', inputExtensions: pdf, outputExtension: 'pdf', minFiles: 1, maxFiles: 1, processingClass: 'standard', fields: [{ name: 'pageNumbers', label: '保留页码或范围', type: 'text', required: true }] },
  { id: 'pdf-compress', name: '压缩 PDF', description: '减小 PDF 文件体积。', inputExtensions: pdf, outputExtension: 'pdf', minFiles: 1, maxFiles: 1, processingClass: 'standard', fields: [{ name: 'optimizeLevel', label: '压缩质量', type: 'select', defaultValue: 2, options: [{ label: '清晰', value: 1 }, { label: '均衡', value: 2 }, { label: '更小文件', value: 3 }] }] },
  { id: 'pdf-repair', name: '修复 PDF', description: '尝试修复无法正常打开的 PDF。', inputExtensions: pdf, outputExtension: 'pdf', minFiles: 1, maxFiles: 1, processingClass: 'heavy', fields: [] },
  { id: 'pdf-ocr', name: 'PDF 文字识别', description: '识别扫描 PDF 并生成可搜索文档。', inputExtensions: pdf, outputExtension: 'pdf', minFiles: 1, maxFiles: 1, processingClass: 'heavy', fields: [
    { name: 'languages', label: '识别语言', type: 'select', defaultValue: 'chi_sim+eng', options: [{ label: '中文（简体）+ 英文', value: 'chi_sim+eng' }, { label: '中文（简体）', value: 'chi_sim' }, { label: '英文', value: 'eng' }] },
    { name: 'deskew', label: '自动纠偏', type: 'checkbox', defaultValue: true },
  ] },
  { id: 'pdf-watermark', name: 'PDF 添加水印', description: '给 PDF 页面添加文字水印。', inputExtensions: pdf, outputExtension: 'pdf', minFiles: 1, maxFiles: 1, processingClass: 'standard', fields: [
    { name: 'watermarkText', label: '水印文字', type: 'text', required: true },
    { name: 'opacity', label: '透明度', type: 'number', defaultValue: 0.35, min: 0.05, max: 1, step: 0.05 },
    { name: 'position', label: '位置', type: 'select', defaultValue: 'center', options: [{ label: '居中', value: 'center' }, { label: '左上', value: 'top-left' }, { label: '右下', value: 'bottom-right' }] },
  ] },
  { id: 'pdf-page-numbers', name: 'PDF 添加页码', description: '给 PDF 页面添加连续页码。', inputExtensions: pdf, outputExtension: 'pdf', minFiles: 1, maxFiles: 1, processingClass: 'standard', fields: [
    { name: 'startingNumber', label: '起始页码', type: 'number', defaultValue: 1, min: 1, max: 100000, step: 1 },
    { name: 'position', label: '位置', type: 'select', defaultValue: 8, options: [{ label: '底部居中', value: 8 }, { label: '底部左侧', value: 7 }, { label: '底部右侧', value: 9 }, { label: '顶部居中', value: 2 }] },
  ] },
  { id: 'pdf-protect', name: 'PDF 加密', description: '为 PDF 设置打开密码。', inputExtensions: pdf, outputExtension: 'pdf', minFiles: 1, maxFiles: 1, processingClass: 'standard', fields: [{ name: 'password', label: '打开密码', type: 'password', required: true }, { name: 'ownerPassword', label: '所有者密码（可选）', type: 'password' }] },
  { id: 'pdf-unlock', name: 'PDF 解锁', description: '使用已知密码移除 PDF 保护。', inputExtensions: pdf, outputExtension: 'pdf', minFiles: 1, maxFiles: 1, processingClass: 'standard', fields: [{ name: 'password', label: '当前密码', type: 'password', required: true }] },
  { id: 'pdf-metadata-remover', name: '清除 PDF 元数据', description: '删除 PDF 中的标题、作者等元数据。', inputExtensions: pdf, outputExtension: 'pdf', minFiles: 1, maxFiles: 1, processingClass: 'standard', fields: [{ name: 'deleteAll', label: '清除全部元数据', type: 'hidden', defaultValue: true }] },
] as const;

export function findDocumentTool(id: string) {
  return documentToolCatalog.find((tool) => tool.id === id);
}
