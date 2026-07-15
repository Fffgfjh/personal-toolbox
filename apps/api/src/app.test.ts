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
    const app = await createApp();
    const unknown = await app.inject({ method: 'POST', url: '/api/v1/document-tools/nope/run', ...multipart([{ name: 'a.pdf', content: 'pdf' }]) });
    const wrongType = await app.inject({ method: 'POST', url: '/api/v1/document-tools/pdf-merge/run', ...multipart([{ name: 'a.exe', content: 'x' }, { name: 'b.pdf', content: 'pdf' }]) });
    const tooFew = await app.inject({ method: 'POST', url: '/api/v1/document-tools/pdf-merge/run', ...multipart([{ name: 'a.pdf', content: 'pdf' }]) });

    expect(unknown.statusCode).toBe(404);
    expect(wrongType.statusCode).toBe(415);
    expect(tooFew.statusCode).toBe(422);
  });

  it('maps multipart limits and required fields to stable client errors', async () => {
    const app = await createApp();
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
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(['result']), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="../../merged.pdf"',
      },
    }));
    const app = await createApp({ DOCUMENT_SERVICE_BASE_URL: 'http://documents:8080' }, fetchMock);
    const response = await app.inject({ method: 'POST', url: '/api/v1/document-tools/pdf-merge/run', ...multipart([{ name: 'a.pdf', content: 'pdf' }, { name: 'b.pdf', content: 'pdf' }]) });

    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://documents:8080/api/v1/general/merge-pdfs');
    expect(response.headers['content-disposition']).toContain('merged.pdf');
  });

  it('serves an OpenAPI document independently from the web app', async () => {
    const app = await createApp({ ENABLE_API_DOCS: 'true' });
    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ info: { title: 'Personal Toolbox API' } });
  });
});
