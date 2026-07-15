import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  documentToolCatalog,
  type DocumentToolDefinition,
} from '@personal-toolbox/contracts';
import { buildApp } from '../app.js';
import { loadApiConfig } from '../config.js';

const liveBaseUrl = process.env.LIVE_DOCUMENT_SERVICE_BASE_URL?.trim().replace(/\/+$/, '') ?? '';
const describeLive = liveBaseUrl ? describe.sequential : describe.skip;
const metadataMarker = 'PERSONAL_TOOLBOX_METADATA_MARKER';

interface TestFile {
  name: string;
  mimetype: string;
  bytes: Buffer;
}

function createMinimalPdf() {
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>\nendobj\n',
    '4 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n',
    `5 0 obj\n<< /Title (${metadataMarker}) /Author (${metadataMarker}) >>\nendobj\n`,
  ];
  let content = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(content, 'latin1'));
    content += object;
  }
  const xrefOffset = Buffer.byteLength(content, 'latin1');
  content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  content += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  content += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(content, 'latin1');
}

const minimalPdf = createMinimalPdf();
const minimalPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function fieldsFor(definition: DocumentToolDefinition) {
  const fields: Record<string, string> = {};
  for (const field of definition.fields) {
    if (field.defaultValue !== undefined) fields[field.name] = String(field.defaultValue);
    else if (field.required) fields[field.name] = field.type === 'password' ? 'live-test-password' : '1';
  }
  if (definition.id === 'pdf-ocr') fields.languages = 'eng';
  if (definition.id === 'pdf-watermark') fields.watermarkText = 'Personal Toolbox';
  if (definition.id === 'pdf-protect' || definition.id === 'pdf-unlock') fields.password = 'live-test-password';
  return fields;
}

function multipart(files: TestFile[], fields: Record<string, string>) {
  const boundary = `----personal-toolbox-live-${Date.now()}`;
  const chunks: Buffer[] = [];
  for (const file of files) {
    chunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="fileInput"; filename="${file.name}"\r\nContent-Type: ${file.mimetype}\r\n\r\n`,
    ));
    chunks.push(file.bytes, Buffer.from('\r\n'));
  }
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    ));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(chunks),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

describeLive('live document engine compatibility', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let protectedPdf: Buffer | undefined;

  beforeAll(async () => {
    app = await buildApp({
      config: loadApiConfig({
        ENABLE_API_DOCS: 'false',
        DOCUMENT_SERVICE_BASE_URL: liveBaseUrl,
        DOCUMENT_SERVICE_API_KEY: process.env.LIVE_DOCUMENT_SERVICE_API_KEY,
        DOCUMENT_SERVICE_TIMEOUT_MS: process.env.LIVE_DOCUMENT_SERVICE_TIMEOUT_MS ?? '600000',
      }),
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  for (const definition of documentToolCatalog) {
    it(`processes ${definition.id}`, async () => {
      let source: TestFile;
      if (definition.id === 'office-to-pdf') {
        source = { name: 'sample.txt', mimetype: 'text/plain', bytes: Buffer.from('Personal Toolbox live test') };
      } else if (definition.id === 'image-to-pdf') {
        source = { name: 'sample.png', mimetype: 'image/png', bytes: minimalPng };
      } else if (definition.id === 'pdf-unlock') {
        if (!protectedPdf) throw new Error('pdf-protect must succeed before pdf-unlock runs.');
        source = { name: 'protected.pdf', mimetype: 'application/pdf', bytes: protectedPdf };
      } else {
        source = { name: 'sample.pdf', mimetype: 'application/pdf', bytes: minimalPdf };
      }
      const files = Array.from({ length: definition.minFiles }, (_, index) => ({
        ...source,
        name: source.name.replace('.', `-${index + 1}.`),
      }));
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/document-tools/${definition.id}/run`,
        ...multipart(files, fieldsFor(definition)),
      });

      expect(response.statusCode, response.body).toBe(200);
      expect(response.rawPayload.byteLength).toBeGreaterThan(0);
      expect(response.headers['content-disposition']).toContain('attachment');
      if (definition.id === 'pdf-watermark' || definition.id === 'pdf-page-numbers') {
        expect(response.rawPayload.equals(source.bytes)).toBe(false);
      }
      if (definition.id === 'pdf-metadata-remover') {
        expect(response.rawPayload.toString('latin1')).not.toContain(metadataMarker);
      }
      if (definition.id === 'pdf-protect') protectedPdf = Buffer.from(response.rawPayload);
    }, 660_000);
  }
});
