import type { FastifyReply } from 'fastify';
import type { DocumentToolDefinition } from '@personal-toolbox/contracts';
import type { ApiConfig } from './config.js';
import { ApiError } from './errors.js';
import type { ParsedDocumentRequest } from './multipart.js';
import { safeFilename } from './multipart.js';
import { documentUpstreamPaths } from './document-upstream.js';

export type FetchImplementation = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function proxyDocumentRequest(
  config: ApiConfig,
  definition: DocumentToolDefinition,
  parsed: ParsedDocumentRequest,
  reply: FastifyReply,
  fetchImplementation: FetchImplementation = fetch,
) {
  if (!config.documentServiceBaseUrl) {
    throw new ApiError(503, 'document_service_disabled', '文档处理服务尚未配置。');
  }

  const body = new FormData();
  for (const file of parsed.files) {
    const arrayBuffer = new ArrayBuffer(file.bytes.byteLength);
    new Uint8Array(arrayBuffer).set(file.bytes);
    body.append('fileInput', new Blob([arrayBuffer], { type: file.mimetype }), file.filename);
  }
  for (const [name, value] of Object.entries(parsed.fields)) {
    body.append(name, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.documentServiceTimeoutMs);
  let response: Response;
  try {
    const headers = config.documentServiceApiKey ? { 'X-API-KEY': config.documentServiceApiKey } : undefined;
    response = await fetchImplementation(
      `${config.documentServiceBaseUrl}${documentUpstreamPaths[definition.id]}`,
      { method: 'POST', body, headers, signal: controller.signal },
    );
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiError(504, 'upstream_timeout', '文档处理超时，请稍后重试。');
    }
    throw new ApiError(502, 'upstream_unavailable', `无法连接文档处理服务：${(error as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const upstreamMessage = await readUpstreamMessage(response);
    const status = response.status === 429 ? 429 : response.status >= 500 ? 502 : 422;
    throw new ApiError(status, status === 429 ? 'busy' : 'upstream_rejected', upstreamMessage);
  }

  const fallbackFilename = `result.${definition.outputExtension}`;
  const filename = responseFilename(response.headers.get('content-disposition'), fallbackFilename);
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const bytes = Buffer.from(await response.arrayBuffer());

  return reply
    .header('content-type', contentType)
    .header('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    .send(bytes);
}

async function readUpstreamMessage(response: Response) {
  try {
    const value = await response.json() as { message?: string; error?: string };
    return value.message || value.error || '文档处理服务无法处理该文件。';
  } catch {
    return '文档处理服务无法处理该文件。';
  }
}

function responseFilename(header: string | null, fallback: string) {
  if (!header) return fallback;
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return safeFilename(decodeURIComponent(encoded.replace(/^"|"$/g, '')));
    } catch {
      return fallback;
    }
  }
  const plain = header.match(/filename="([^"]+)"/i)?.[1] || header.match(/filename=([^;]+)/i)?.[1];
  return plain ? safeFilename(plain) : fallback;
}
