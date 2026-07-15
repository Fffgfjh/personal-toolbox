import type { DocumentToolDefinition } from '@personal-toolbox/contracts';
import type { ParsedDocumentRequest } from '../multipart.js';

export type DocumentEngineFailureReason =
  | 'authentication'
  | 'busy'
  | 'cancelled'
  | 'contract'
  | 'invalid_response'
  | 'output_too_large'
  | 'rejected'
  | 'timeout'
  | 'unsupported'
  | 'unavailable';

export class DocumentEngineError extends Error {
  constructor(
    public readonly reason: DocumentEngineFailureReason,
    cause?: unknown,
  ) {
    super(`Document engine request failed: ${reason}`, cause === undefined ? undefined : { cause });
    this.name = 'DocumentEngineError';
  }
}

export interface DocumentEngineResult {
  bytes: Uint8Array;
  contentType: string;
  contentDisposition?: string;
}

export interface DocumentEngineRunRequest {
  definition: DocumentToolDefinition;
  parsed: ParsedDocumentRequest;
  requestId: string;
  signal?: AbortSignal;
}

export interface DocumentEngineAdapter {
  readonly id: string;
  readonly configured: boolean;
  execute(request: DocumentEngineRunRequest): Promise<DocumentEngineResult>;
}
