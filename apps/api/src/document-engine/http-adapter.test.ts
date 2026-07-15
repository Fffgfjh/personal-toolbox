import { describe, expect, it, vi } from 'vitest';
import {
  documentToolCatalog,
  type DocumentToolId,
  type DocumentToolDefinition,
} from '@personal-toolbox/contracts';
import type { ParsedDocumentRequest } from '../multipart.js';
import { documentUpstreamFields, documentUpstreamPaths } from '../document-upstream.js';
import {
  HttpDocumentEngineAdapter,
  type FetchImplementation,
} from './http-adapter.js';

function parsedRequest(definition: DocumentToolDefinition): ParsedDocumentRequest {
  const extension = definition.inputExtensions[0] ?? '.bin';
  const files = Array.from({ length: definition.minFiles }, (_, index) => ({
    filename: `sample-${index + 1}${extension}`,
    mimetype: extension === '.pdf' ? 'application/pdf' : 'application/octet-stream',
    bytes: new Uint8Array([index + 1, 2, 3]),
  }));
  const fields = Object.fromEntries(definition.fields.map((field) => {
    if (field.defaultValue !== undefined) return [field.name, String(field.defaultValue)];
    if (field.type === 'password') return [field.name, 'test-password'];
    if (field.type === 'number') return [field.name, String(field.min ?? 1)];
    if (field.options?.[0]) return [field.name, String(field.options[0].value)];
    return [field.name, 'test-value'];
  }));
  return { files, fields };
}

function validOutput(definition: DocumentToolDefinition) {
  if (definition.outputExtension === 'pdf') {
    return new TextEncoder().encode('%PDF-1.7\n%%EOF');
  }
  return new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);
}

function successfulFetch(definition: DocumentToolDefinition) {
  return vi.fn<FetchImplementation>(async () => new Response(validOutput(definition), {
    status: 200,
    headers: { 'content-type': 'application/octet-stream' },
  }));
}

function engineOptions(overrides: Partial<ConstructorParameters<typeof HttpDocumentEngineAdapter>[0]> = {}) {
  return {
    baseUrl: 'http://document-engine:8080',
    apiKey: '',
    timeoutMs: 1_000,
    maxOutputBytes: 1_024,
    ...overrides,
  };
}

function toolDefinition(id: DocumentToolId) {
  const definition = documentToolCatalog.find((tool) => tool.id === id);
  if (!definition) throw new Error(`Missing document tool: ${id}`);
  return definition;
}

describe('HTTP document engine compatibility', () => {
  it('keeps an explicit upstream binding for every public document tool', () => {
    const expectedPaths: Record<DocumentToolId, string> = {
      'pdf-to-word': '/api/v1/convert/pdf/word',
      'office-to-pdf': '/api/v1/convert/file/pdf',
      'image-to-pdf': '/api/v1/convert/img/pdf',
      'pdf-to-image': '/api/v1/convert/pdf/img',
      'pdf-merge': '/api/v1/general/merge-pdfs',
      'pdf-split': '/api/v1/general/split-pages',
      'pdf-extract-pages': '/api/v1/general/rearrange-pages',
      'pdf-compress': '/api/v1/misc/compress-pdf',
      'pdf-repair': '/api/v1/misc/repair',
      'pdf-ocr': '/api/v1/misc/ocr-pdf',
      'pdf-watermark': '/api/v1/security/add-watermark',
      'pdf-page-numbers': '/api/v1/misc/add-page-numbers',
      'pdf-protect': '/api/v1/security/add-password',
      'pdf-unlock': '/api/v1/security/remove-password',
      'pdf-metadata-remover': '/api/v1/misc/update-metadata',
    };
    expect(documentUpstreamPaths).toEqual(expectedPaths);
    expect(Object.keys(documentUpstreamPaths).sort()).toEqual(documentToolCatalog.map(({ id }) => id).sort());
  });

  it.each(documentToolCatalog)('maps $id to its approved operation and multipart contract', async (definition) => {
    const fetchImplementation = successfulFetch(definition);
    const adapter = new HttpDocumentEngineAdapter(engineOptions({
      apiKey: 'server-only-key',
    }), fetchImplementation);
    const parsed = parsedRequest(definition);

    await adapter.execute({ definition, parsed, requestId: `request-${definition.id}` });

    expect(fetchImplementation).toHaveBeenCalledOnce();
    const [input, init] = fetchImplementation.mock.calls[0] ?? [];
    expect(String(input)).toBe(`http://document-engine:8080${documentUpstreamPaths[definition.id]}`);
    expect(init?.method).toBe('POST');
    expect(init?.redirect).toBe('error');
    expect(new Headers(init?.headers).get('x-api-key')).toBe('server-only-key');
    expect(new Headers(init?.headers).get('x-request-id')).toBe(`request-${definition.id}`);
    expect(init?.body).toBeInstanceOf(FormData);

    const body = init?.body as FormData;
    expect(body.getAll('fileInput')).toHaveLength(definition.minFiles);
    const expectedFields = documentUpstreamFields(definition.id, parsed.fields);
    for (const name of new Set(expectedFields.map(([fieldName]) => fieldName))) {
      expect(body.getAll(name).map(String)).toEqual(
        expectedFields.filter(([fieldName]) => fieldName === name).map(([, value]) => value),
      );
    }
  });

  it('adapts public fields to the current engine contract without changing the shared catalog', () => {
    expect(documentUpstreamFields('pdf-to-word', {})).toContainEqual(['outputFormat', 'docx']);
    expect(documentUpstreamFields('image-to-pdf', { fitOption: 'fitDocumentToPage' }))
      .toContainEqual(['fitOption', 'fitDocumentToImage']);
    expect(documentUpstreamFields('pdf-to-image', { imageFormat: 'png', dpi: '150' }))
      .toEqual(expect.arrayContaining([
        ['singleOrMultiple', 'multiple'],
        ['colorType', 'color'],
        ['includeAnnotations', 'false'],
        ['pageNumbers', 'all'],
      ]));
    expect(documentUpstreamFields('pdf-merge', {})).toEqual(expect.arrayContaining([
      ['sortType', 'orderProvided'],
      ['removeCertSign', 'true'],
    ]));
    expect(documentUpstreamFields('pdf-extract-pages', { pageNumbers: '1-3' }))
      .toContainEqual(['customMode', 'CUSTOM']);
    expect(documentUpstreamFields('pdf-compress', { optimizeLevel: '2' }))
      .toEqual(expect.arrayContaining([
        ['linearize', 'false'],
        ['normalize', 'false'],
        ['grayscale', 'false'],
      ]));
    expect(documentUpstreamFields('pdf-ocr', { languages: 'chi_sim+eng', deskew: 'true' }))
      .toEqual(expect.arrayContaining([
        ['languages', 'chi_sim'],
        ['languages', 'eng'],
        ['ocrType', 'skip-text'],
        ['ocrRenderType', 'hocr'],
      ]));
    expect(documentUpstreamFields('pdf-watermark', { watermarkText: '内部文件', position: 'center', opacity: '0.35' }))
      .toEqual(expect.arrayContaining([
        ['watermarkType', 'text'],
        ['alphabet', 'chinese'],
        ['fontSize', '30'],
      ]));
    expect(documentUpstreamFields('pdf-watermark', { watermarkText: 'Internal', position: 'center' }))
      .not.toContainEqual(['position', 'center']);
    expect(documentUpstreamFields('pdf-page-numbers', { startingNumber: '1', position: '8' }))
      .toEqual(expect.arrayContaining([
        ['pagesToNumber', 'all'],
        ['fontSize', '12'],
        ['fontType', 'helvetica'],
      ]));
    expect(documentUpstreamFields('pdf-protect', { password: 'secret' }))
      .toContainEqual(['keyLength', '256']);
  });

  it.each(['top-left', 'bottom-right'])('rejects unsupported watermark position %s before fetch', async (position) => {
    const definition = toolDefinition('pdf-watermark');
    const fetchImplementation = successfulFetch(definition);
    const parsed = parsedRequest(definition);
    parsed.fields.position = position;
    const adapter = new HttpDocumentEngineAdapter(engineOptions(), fetchImplementation);

    await expect(adapter.execute({ definition, parsed, requestId: `watermark-${position}` }))
      .rejects.toMatchObject({ reason: 'unsupported' });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('accepts an exact-size binary response and normalizes its public content type', async () => {
    const definition = toolDefinition('pdf-merge');
    const output = validOutput(definition);
    const adapter = new HttpDocumentEngineAdapter(engineOptions({
      maxOutputBytes: output.byteLength,
    }), async () => new Response(output, {
      status: 200,
      headers: {
        'content-length': String(output.byteLength),
        'content-type': 'application/octet-stream',
      },
    }));

    await expect(adapter.execute({ definition, parsed: parsedRequest(definition), requestId: 'exact-size' }))
      .resolves.toMatchObject({ contentType: 'application/pdf' });
  });

  it('rejects declared and streamed outputs above the configured limit', async () => {
    const definition = toolDefinition('pdf-merge');
    const output = validOutput(definition);
    const declared = new HttpDocumentEngineAdapter(engineOptions({
      maxOutputBytes: output.byteLength,
    }), async () => new Response(output, {
      status: 200,
      headers: { 'content-length': String(output.byteLength + 1) },
    }));
    await expect(declared.execute({ definition, parsed: parsedRequest(definition), requestId: 'declared-large' }))
      .rejects.toMatchObject({ reason: 'output_too_large' });

    const streamed = new HttpDocumentEngineAdapter(engineOptions({
      maxOutputBytes: output.byteLength - 1,
    }), async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(output.subarray(0, 5));
        controller.enqueue(output.subarray(5));
        controller.close();
      },
    }), { status: 200 }));
    await expect(streamed.execute({ definition, parsed: parsedRequest(definition), requestId: 'streamed-large' }))
      .rejects.toMatchObject({ reason: 'output_too_large' });
  });

  it.each([
    ['dangerous content type', new TextEncoder().encode('%PDF-1.7\n%%EOF'), 'text/html'],
    ['invalid signature', new TextEncoder().encode('not a PDF'), 'application/pdf'],
    ['empty response', new Uint8Array(), 'application/pdf'],
  ])('rejects a %s', async (_caseName, output, contentType) => {
    const definition = toolDefinition('pdf-merge');
    const adapter = new HttpDocumentEngineAdapter(engineOptions(), async () => new Response(output, {
      status: 200,
      headers: { 'content-type': contentType },
    }));

    await expect(adapter.execute({ definition, parsed: parsedRequest(definition), requestId: 'invalid-result' }))
      .rejects.toMatchObject({ reason: 'invalid_response' });
  });

  it.each([
    [204, 'invalid_response'],
    [206, 'invalid_response'],
    [302, 'contract'],
  ] as const)('rejects unexpected upstream status %s as %s', async (status, reason) => {
    const definition = toolDefinition('pdf-merge');
    const body = status === 204 ? null : validOutput(definition);
    const adapter = new HttpDocumentEngineAdapter(engineOptions(), async () => new Response(body, { status }));

    await expect(adapter.execute({ definition, parsed: parsedRequest(definition), requestId: `status-${status}` }))
      .rejects.toMatchObject({ reason });
  });

  it('keeps the timeout active while the response body is being read', async () => {
    const definition = toolDefinition('pdf-merge');
    const output = validOutput(definition);
    const fetchImplementation: FetchImplementation = async (_input, init) => new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(output.subarray(0, 5));
          init?.signal?.addEventListener('abort', () => {
            controller.error(new DOMException('aborted', 'AbortError'));
          }, { once: true });
        },
      }),
      { status: 200, headers: { 'content-type': 'application/pdf' } },
    );
    const adapter = new HttpDocumentEngineAdapter(engineOptions({ timeoutMs: 5 }), fetchImplementation);

    await expect(adapter.execute({ definition, parsed: parsedRequest(definition), requestId: 'body-timeout' }))
      .rejects.toMatchObject({ reason: 'timeout' });
  });

  it('distinguishes timeouts, client cancellation and unavailable engines', async () => {
    const pendingFetch: FetchImplementation = (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    });
    const definition = documentToolCatalog[0];
    if (!definition) throw new Error('Document catalog is empty.');
    const parsed = parsedRequest(definition);

    const alreadyAborted = new AbortController();
    alreadyAborted.abort();
    const unusedFetch = successfulFetch(definition);
    const cancelledBeforeCopy = new HttpDocumentEngineAdapter(engineOptions(), unusedFetch);
    await expect(cancelledBeforeCopy.execute({
      definition,
      parsed,
      requestId: 'already-cancelled',
      signal: alreadyAborted.signal,
    })).rejects.toMatchObject({ reason: 'cancelled' });
    expect(unusedFetch).not.toHaveBeenCalled();

    const timedOut = new HttpDocumentEngineAdapter(engineOptions({ timeoutMs: 5 }), pendingFetch);
    await expect(timedOut.execute({ definition, parsed, requestId: 'timeout' }))
      .rejects.toMatchObject({ reason: 'timeout' });

    const controller = new AbortController();
    const cancelled = new HttpDocumentEngineAdapter(engineOptions(), pendingFetch);
    const cancelledRequest = cancelled.execute({
      definition,
      parsed,
      requestId: 'cancelled',
      signal: controller.signal,
    });
    controller.abort();
    await expect(cancelledRequest)
      .rejects.toMatchObject({ reason: 'cancelled' });

    const unavailable = new HttpDocumentEngineAdapter(engineOptions({
      baseUrl: 'http://private-document-host:8080',
    }), async () => {
      throw new Error('connect ECONNREFUSED private-document-host:8080');
    });
    await expect(unavailable.execute({ definition, parsed, requestId: 'unavailable' }))
      .rejects.toMatchObject({ reason: 'unavailable' });
  });
});
