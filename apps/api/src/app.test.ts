import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';
import { loadApiConfig } from './config.js';

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function createApp(overrides: Record<string, string> = {}, fetchImplementation?: typeof fetch) {
  const app = await buildApp({
    config: loadApiConfig({ ENABLE_API_DOCS: 'false', ...overrides }),
    fetchImplementation,
  });
  apps.push(app);
  return app;
}

function multipart(files: Array<{ name: string; content: string }>, fields: Record<string, string> = {}) {
  const boundary = '----personal-toolbox-test-boundary';
  const chunks: string[] = [];
  for (const file of files) {
    chunks.push(`--${boundary}\r\nContent-Disposition: form-data; name="fileInput"; filename="${file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n${file.content}\r\n`);
  }
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  }
  chunks.push(`--${boundary}--\r\n`);
  return { payload: Buffer.from(chunks.join('')), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

describe('personal toolbox API', () => {
  it('reports health and exposes the frontend-independent catalog', async () => {
    const app = await createApp();
    const health = await app.inject({ method: 'GET', url: '/api/v1/health' });
    const catalog = await app.inject({ method: 'GET', url: '/api/v1/document-tools' });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ status: 'ok', documentServiceConfigured: false });
    expect(catalog.json()).toHaveLength(15);
  });

  it('validates tool IDs, file types and file counts before proxying', async () => {
    const app = await createApp({ DOCUMENT_SERVICE_BASE_URL: 'http://documents:8080' }, vi.fn());
    const unknown = await app.inject({ method: 'POST', url: '/api/v1/document-tools/nope/run', ...multipart([{ name: 'a.pdf', content: 'pdf' }]) });
    const wrongType = await app.inject({ method: 'POST', url: '/api/v1/document-tools/pdf-merge/run', ...multipart([{ name: 'a.exe', content: 'x' }, { name: 'b.pdf', content: 'pdf' }]) });
    const tooFew = await app.inject({ method: 'POST', url: '/api/v1/document-tools/pdf-merge/run', ...multipart([{ name: 'a.pdf', content: 'pdf' }]) });

    expect(unknown.statusCode).toBe(404);
    expect(wrongType.statusCode).toBe(415);
    expect(tooFew.statusCode).toBe(422);
  });

  it('maps multipart limits and required fields to stable client errors', async () => {
    const app = await createApp({ DOCUMENT_SERVICE_BASE_URL: 'http://documents:8080' }, vi.fn());
    const tooMany = await app.inject({ method: 'POST', url: '/api/v1/document-tools/pdf-merge/run', ...multipart(Array.from({ length: 11 }, (_, index) => ({ name: `${index}.pdf`, content: 'pdf' }))) });
    const missingWatermark = await app.inject({ method: 'POST', url: '/api/v1/document-tools/pdf-watermark/run', ...multipart([{ name: 'a.pdf', content: 'pdf' }]) });

    expect(tooMany.statusCode).toBe(413);
    expect(tooMany.json()).toMatchObject({ code: 'too_many_files' });
    expect(missingWatermark.statusCode).toBe(422);
    expect(missingWatermark.json()).toMatchObject({ code: 'missing_field' });
  });

  it('keeps the document service disabled until explicitly configured', async () => {
    const app = await createApp();
    const response = await app.inject({ method: 'POST', url: '/api/v1/document-tools/pdf-merge/run', ...multipart([{ name: 'a.pdf', content: 'pdf' }, { name: 'b.pdf', content: 'pdf' }]) });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: 'document_service_disabled' });
  });

  it('proxies only an approved operation and returns a sanitized download', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(['%PDF-1.7\n%%EOF']), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="../../merged.html"',
      },
    }));
    const app = await createApp({ DOCUMENT_SERVICE_BASE_URL: 'http://documents:8080' }, fetchMock);
    const response = await app.inject({ method: 'POST', url: '/api/v1/document-tools/pdf-merge/run', ...multipart([{ name: 'a.pdf', content: 'pdf' }, { name: 'b.pdf', content: 'pdf' }]) });

    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://documents:8080/api/v1/general/merge-pdfs');
    expect(response.headers['content-disposition']).toContain('result.pdf');
    expect(response.headers['content-disposition']).not.toContain('merged.html');
  });

  it('does not expose private upstream connection details', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED private-document-host:8080'));
    const app = await createApp({ DOCUMENT_SERVICE_BASE_URL: 'http://private-document-host:8080' }, fetchMock);
    const response = await app.inject({ method: 'POST', url: '/api/v1/document-tools/pdf-merge/run', ...multipart([{ name: 'a.pdf', content: 'pdf' }, { name: 'b.pdf', content: 'pdf' }]) });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toMatchObject({
      code: 'upstream_unavailable',
      message: '暂时无法连接文档处理服务，请稍后重试。',
    });
    expect(response.body).not.toContain('private-document-host');
  });

  it.each([
    [401, 502, 'upstream_auth_failed'],
    [403, 502, 'upstream_auth_failed'],
    [302, 502, 'upstream_contract_mismatch'],
    [404, 502, 'upstream_contract_mismatch'],
    [405, 502, 'upstream_contract_mismatch'],
    [429, 429, 'busy'],
    [400, 422, 'upstream_rejected'],
    [206, 502, 'upstream_invalid_response'],
    [500, 502, 'upstream_unavailable'],
  ] as const)('normalizes upstream status %s without blaming client input incorrectly', async (upstreamStatus, expectedStatus, code) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('private upstream response', { status: upstreamStatus }));
    const app = await createApp({ DOCUMENT_SERVICE_BASE_URL: 'http://documents:8080' }, fetchMock);
    const response = await app.inject({ method: 'POST', url: '/api/v1/document-tools/pdf-merge/run', ...multipart([{ name: 'a.pdf', content: 'pdf' }, { name: 'b.pdf', content: 'pdf' }]) });

    expect(response.statusCode).toBe(expectedStatus);
    expect(response.json()).toMatchObject({ code });
    expect(response.body).not.toContain('private upstream response');
  });

  it('rejects invalid and oversized successful upstream responses', async () => {
    const invalidFetch = vi.fn().mockResolvedValue(new Response('{"private":"error"}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const invalidApp = await createApp({ DOCUMENT_SERVICE_BASE_URL: 'http://documents:8080' }, invalidFetch);
    const invalidResponse = await invalidApp.inject({ method: 'POST', url: '/api/v1/document-tools/pdf-merge/run', ...multipart([{ name: 'a.pdf', content: 'pdf' }, { name: 'b.pdf', content: 'pdf' }]) });
    expect(invalidResponse.statusCode).toBe(502);
    expect(invalidResponse.json()).toMatchObject({ code: 'upstream_invalid_response' });

    const oversizedFetch = vi.fn().mockResolvedValue(new Response('%PDF-1.7\n%%EOF', {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    }));
    const oversizedApp = await createApp({
      DOCUMENT_SERVICE_BASE_URL: 'http://documents:8080',
      MAX_OUTPUT_BYTES: '5',
    }, oversizedFetch);
    const oversizedResponse = await oversizedApp.inject({ method: 'POST', url: '/api/v1/document-tools/pdf-merge/run', ...multipart([{ name: 'a.pdf', content: 'pdf' }, { name: 'b.pdf', content: 'pdf' }]) });
    expect(oversizedResponse.statusCode).toBe(502);
    expect(oversizedResponse.json()).toMatchObject({ code: 'upstream_output_too_large' });
  });

  it('returns an explicit error for watermark positions the engine cannot honor', async () => {
    const fetchMock = vi.fn();
    const app = await createApp({ DOCUMENT_SERVICE_BASE_URL: 'http://documents:8080' }, fetchMock);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/document-tools/pdf-watermark/run',
      ...multipart([{ name: 'a.pdf', content: 'pdf' }], {
        watermarkText: 'Internal',
        position: 'top-left',
      }),
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'unsupported_option' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('limits concurrent buffered document jobs before parsing another upload', async () => {
    let completeFetch: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      completeFetch = resolve;
    }));
    const app = await createApp({
      DOCUMENT_SERVICE_BASE_URL: 'http://documents:8080',
      DOCUMENT_SERVICE_MAX_CONCURRENCY: '1',
    }, fetchMock);
    const request = { method: 'POST' as const, url: '/api/v1/document-tools/pdf-merge/run', ...multipart([{ name: 'a.pdf', content: 'pdf' }, { name: 'b.pdf', content: 'pdf' }]) };

    const first = app.inject(request);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const second = await app.inject(request);

    expect(second.statusCode).toBe(429);
    expect(second.json()).toMatchObject({ code: 'busy' });
    completeFetch?.(new Response('%PDF-1.7\n%%EOF', {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    }));
    expect((await first).statusCode).toBe(200);
  });

  it('returns the stable API error shape when the route rate limit is exceeded', async () => {
    const app = await createApp({ RATE_LIMIT_MAX: '100' });

    for (let index = 0; index < 15; index += 1) {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/document-tools/unknown-${index}/run`,
      });
      expect(response.statusCode).toBe(404);
    }

    const limited = await app.inject({
      method: 'POST',
      url: '/api/v1/document-tools/unknown-limited/run',
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({
      code: 'rate_limited',
      message: '请求过于频繁，请稍后重试。',
    });
  });

  it('serves an OpenAPI document independently from the web app', async () => {
    const app = await createApp({ ENABLE_API_DOCS: 'true' });
    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ info: { title: 'Personal Toolbox API' } });
  });
});
