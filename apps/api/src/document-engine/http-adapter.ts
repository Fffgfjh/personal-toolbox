import type { DocumentToolId } from '@personal-toolbox/contracts';
import type { ApiConfig } from '../config.js';
import { documentUpstreamFields, documentUpstreamPaths } from '../document-upstream.js';
import {
  DocumentEngineError,
  type DocumentEngineAdapter,
  type DocumentEngineFailureReason,
  type DocumentEngineRunRequest,
} from './adapter.js';

export type FetchImplementation = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface HttpDocumentEngineOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  maxOutputBytes: number;
  operationPaths?: Readonly<Record<DocumentToolId, string>>;
}

const expectedContentTypes: Readonly<Record<string, string>> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  zip: 'application/zip',
};

export class HttpDocumentEngineAdapter implements DocumentEngineAdapter {
  readonly id = 'http-document-engine';
  readonly configured: boolean;
  private readonly operationPaths: Readonly<Record<DocumentToolId, string>>;

  constructor(
    private readonly options: HttpDocumentEngineOptions,
    private readonly fetchImplementation: FetchImplementation = fetch,
  ) {
    this.configured = Boolean(options.baseUrl);
    this.operationPaths = options.operationPaths ?? documentUpstreamPaths;
  }

  async execute({ definition, parsed, requestId, signal }: DocumentEngineRunRequest) {
    if (signal?.aborted) throw new DocumentEngineError('cancelled');

    if (
      definition.id === 'pdf-watermark'
      && parsed.fields.position !== undefined
      && parsed.fields.position !== 'center'
    ) {
      throw new DocumentEngineError('unsupported');
    }

    const body = new FormData();
    for (const file of parsed.files) {
      const arrayBuffer = new ArrayBuffer(file.bytes.byteLength);
      new Uint8Array(arrayBuffer).set(file.bytes);
      body.append('fileInput', new Blob([arrayBuffer], { type: file.mimetype }), file.filename);
    }
    for (const [name, value] of documentUpstreamFields(definition.id, parsed.fields)) {
      body.append(name, value);
    }

    const headers = new Headers();
    if (this.options.apiKey) headers.set('X-API-KEY', this.options.apiKey);
    if (requestId) headers.set('X-Request-ID', requestId);

    const controller = new AbortController();
    let abortReason: Extract<DocumentEngineFailureReason, 'cancelled' | 'timeout'> | undefined;
    const abort = (reason: typeof abortReason) => {
      if (controller.signal.aborted) return;
      abortReason = reason;
      controller.abort();
    };
    const onClientAbort = () => abort('cancelled');
    if (signal?.aborted) onClientAbort();
    else signal?.addEventListener('abort', onClientAbort, { once: true });
    const timeout = setTimeout(() => abort('timeout'), this.options.timeoutMs);

    try {
      const response = await this.fetchImplementation(
        `${this.options.baseUrl}${this.operationPaths[definition.id]}`,
        { method: 'POST', body, headers, signal: controller.signal, redirect: 'error' },
      );
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => undefined);
        if (response.status === 401 || response.status === 403) {
          throw new DocumentEngineError('authentication');
        }
        if (
          response.status === 404
          || response.status === 405
          || (response.status >= 300 && response.status < 400)
        ) {
          throw new DocumentEngineError('contract');
        }
        if (response.status === 429) {
          throw new DocumentEngineError('busy');
        }
        if (response.status >= 500) {
          throw new DocumentEngineError('unavailable');
        }
        if (response.status >= 200 && response.status < 300) {
          throw new DocumentEngineError('invalid_response');
        }
        throw new DocumentEngineError('rejected');
      }

      const upstreamContentType = response.headers.get('content-type') || '';
      if (!isAllowedContentType(definition.outputExtension, upstreamContentType)) {
        await response.body?.cancel().catch(() => undefined);
        throw new DocumentEngineError('invalid_response');
      }

      const bytes = await readBoundedBody(response, this.options.maxOutputBytes);
      if (!hasExpectedSignature(definition.outputExtension, bytes)) {
        throw new DocumentEngineError('invalid_response');
      }

      return {
        bytes,
        contentType: expectedContentTypes[definition.outputExtension] || 'application/octet-stream',
        contentDisposition: response.headers.get('content-disposition') ?? undefined,
      };
    } catch (error) {
      if (error instanceof DocumentEngineError) throw error;
      throw new DocumentEngineError(abortReason ?? 'unavailable', error);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onClientAbort);
    }
  }
}

export function createHttpDocumentEngine(
  config: ApiConfig,
  fetchImplementation: FetchImplementation = fetch,
) {
  return new HttpDocumentEngineAdapter({
    baseUrl: config.documentServiceBaseUrl,
    apiKey: config.documentServiceApiKey,
    timeoutMs: config.documentServiceTimeoutMs,
    maxOutputBytes: config.maxOutputBytes,
  }, fetchImplementation);
}

function isAllowedContentType(extension: string, rawContentType: string) {
  const contentType = rawContentType.split(';', 1)[0]?.trim().toLowerCase() || '';
  if (!contentType || contentType === 'application/octet-stream') return true;
  if (extension === 'pdf') return contentType === 'application/pdf' || contentType === 'application/x-pdf';
  if (extension === 'zip') {
    return contentType === 'application/zip' || contentType === 'application/x-zip-compressed';
  }
  if (extension === 'docx') {
    return contentType === expectedContentTypes.docx || contentType === 'application/zip';
  }
  return false;
}

async function readBoundedBody(response: Response, maxOutputBytes: number) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxOutputBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new DocumentEngineError('output_too_large');
  }
  if (!response.body) throw new DocumentEngineError('invalid_response');

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxOutputBytes) {
        await reader.cancel().catch(() => undefined);
        throw new DocumentEngineError('output_too_large');
      }
      chunks.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
    }
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) throw new DocumentEngineError('invalid_response');
  if (chunks.length === 1) return chunks[0] as Buffer;
  return Buffer.concat(chunks, totalBytes);
}

function hasExpectedSignature(extension: string, bytes: Uint8Array) {
  if (extension === 'pdf') {
    return bytes.byteLength >= 5
      && bytes[0] === 0x25
      && bytes[1] === 0x50
      && bytes[2] === 0x44
      && bytes[3] === 0x46
      && bytes[4] === 0x2d;
  }
  if (extension === 'zip' || extension === 'docx') {
    return bytes.byteLength >= 4
      && bytes[0] === 0x50
      && bytes[1] === 0x4b
      && (
        (bytes[2] === 0x03 && bytes[3] === 0x04)
        || (bytes[2] === 0x05 && bytes[3] === 0x06)
        || (bytes[2] === 0x07 && bytes[3] === 0x08)
      );
  }
  return false;
}
