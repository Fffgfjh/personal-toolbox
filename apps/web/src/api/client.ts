import type { ApiErrorBody, DocumentToolDefinition } from '@personal-toolbox/contracts';
import { projectConfig } from '../config/project';

export class ToolboxApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 0) {
    super(message);
    this.name = 'ToolboxApiError';
  }
}

export interface DocumentResult {
  blob: Blob;
  filename: string;
  contentType: string;
}

export function apiUrl(path: string, baseUrl = projectConfig.apiBaseUrl) {
  if (!baseUrl) throw new ToolboxApiError('api_disabled', '前端尚未配置 API 地址。');
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export async function runDocumentTool(
  definition: DocumentToolDefinition,
  files: File[],
  fields: Record<string, string | number | boolean>,
  signal: AbortSignal,
  fetchImplementation: typeof fetch = fetch,
): Promise<DocumentResult> {
  const body = new FormData();
  files.forEach((file) => body.append('fileInput', file, file.name));
  for (const field of definition.fields) {
    const value = fields[field.name] ?? field.defaultValue;
    if (value !== undefined && value !== '') body.append(field.name, String(value));
  }

  let response: Response;
  try {
    response = await fetchImplementation(apiUrl(`/v1/document-tools/${definition.id}/run`), {
      method: 'POST',
      body,
      signal,
      credentials: 'same-origin',
    });
  } catch (error) {
    if (signal.aborted || (error as Error).name === 'AbortError') throw new ToolboxApiError('cancelled', '处理已取消。');
    throw new ToolboxApiError('api_unavailable', '无法连接工具 API，请检查后端地址。');
  }

  if (!response.ok) {
    let payload: Partial<ApiErrorBody> = {};
    try { payload = await response.json() as ApiErrorBody; } catch { /* use local message */ }
    throw new ToolboxApiError(payload.code || 'request_failed', payload.message || `API 返回 ${response.status}。`, response.status);
  }

  const blob = await response.blob();
  const fallback = `result.${definition.outputExtension}`;
  return {
    blob,
    filename: responseFilename(response.headers.get('content-disposition'), fallback),
    contentType: response.headers.get('content-type') || blob.type || 'application/octet-stream',
  };
}

export function responseFilename(header: string | null, fallback: string) {
  if (!header) return fallback;
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = header.match(/filename="([^"]+)"/i)?.[1] || header.match(/filename=([^;]+)/i)?.[1];
  let candidate = plain || fallback;
  if (encoded) {
    try { candidate = decodeURIComponent(encoded.replace(/^"|"$/g, '')); } catch { candidate = fallback; }
  }
  const basename = [...candidate.replaceAll('\\', '/').split('/').pop()!]
    .filter((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
    .join('')
    .trim();
  return basename && basename !== '.' && basename !== '..' ? basename : fallback;
}
