import type { FastifyReply } from 'fastify';
import type { DocumentToolDefinition } from '@personal-toolbox/contracts';
import { ApiError } from './errors.js';
import type { ParsedDocumentRequest } from './multipart.js';
import { safeFilename } from './multipart.js';
import {
  DocumentEngineError,
  type DocumentEngineAdapter,
} from './document-engine/adapter.js';

export async function proxyDocumentRequest(
  engine: DocumentEngineAdapter,
  definition: DocumentToolDefinition,
  parsed: ParsedDocumentRequest,
  reply: FastifyReply,
  requestId: string,
  signal?: AbortSignal,
) {
  if (!engine.configured) {
    throw new ApiError(503, 'document_service_disabled', '文档处理服务尚未配置。');
  }

  let result;
  try {
    result = await engine.execute({ definition, parsed, requestId, signal });
  } catch (error) {
    if (error instanceof DocumentEngineError) {
      throw documentEngineApiError(error);
    }
    throw error;
  }

  const fallbackFilename = `result.${definition.outputExtension}`;
  const filename = responseFilename(
    result.contentDisposition ?? null,
    fallbackFilename,
    definition.outputExtension,
  );
  const body = Buffer.isBuffer(result.bytes)
    ? result.bytes
    : Buffer.from(result.bytes.buffer, result.bytes.byteOffset, result.bytes.byteLength);

  return reply
    .header('content-type', result.contentType)
    .header('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    .send(body);
}

function documentEngineApiError(error: DocumentEngineError) {
  const reason = error.reason;
  switch (reason) {
    case 'authentication':
      return new ApiError(502, 'upstream_auth_failed', '文档处理服务认证失败，请检查服务端配置。');
    case 'busy':
      return new ApiError(429, 'busy', '文档处理服务繁忙，请稍后重试。');
    case 'cancelled':
      return new ApiError(499, 'request_cancelled', '请求已取消。');
    case 'contract':
      return new ApiError(502, 'upstream_contract_mismatch', '文档处理服务版本与当前适配器不兼容。');
    case 'invalid_response':
      return new ApiError(502, 'upstream_invalid_response', '文档处理服务返回了无效结果。');
    case 'output_too_large':
      return new ApiError(502, 'upstream_output_too_large', '文档处理结果超过服务端大小限制。');
    case 'rejected':
      return new ApiError(422, 'upstream_rejected', '文档处理服务拒绝了文件或参数。');
    case 'timeout':
      return new ApiError(504, 'upstream_timeout', '文档处理超时，请稍后重试。');
    case 'unsupported':
      return new ApiError(422, 'unsupported_option', '当前文档引擎不支持这个选项。');
    case 'unavailable':
      return new ApiError(502, 'upstream_unavailable', '暂时无法连接文档处理服务，请稍后重试。');
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
}

function responseFilename(header: string | null, fallback: string, outputExtension: string) {
  if (!header) return fallback;
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return filenameWithExpectedExtension(
        safeFilename(decodeURIComponent(encoded.replace(/^"|"$/g, ''))),
        fallback,
        outputExtension,
      );
    } catch {
      return fallback;
    }
  }
  const plain = header.match(/filename="([^"]+)"/i)?.[1] || header.match(/filename=([^;]+)/i)?.[1];
  return plain
    ? filenameWithExpectedExtension(safeFilename(plain), fallback, outputExtension)
    : fallback;
}

function filenameWithExpectedExtension(filename: string, fallback: string, outputExtension: string) {
  return filename.toLowerCase().endsWith(`.${outputExtension.toLowerCase()}`) ? filename : fallback;
}
