import { describe, expect, it } from 'vitest';
import { loadApiConfig } from './config.js';

describe('API configuration', () => {
  it('uses safe local defaults and leaves the upstream disabled', () => {
    const config = loadApiConfig({});
    expect(config.port).toBe(3001);
    expect(config.allowedOrigins).toEqual(['http://localhost:5173']);
    expect(config.documentServiceBaseUrl).toBe('');
  });

  it('normalizes origins, URLs and positive numeric limits', () => {
    const config = loadApiConfig({
      ALLOWED_ORIGINS: 'https://one.example, https://two.example ',
      DOCUMENT_SERVICE_BASE_URL: 'http://document-service:8080/',
      PORT: '4100',
      MAX_FILE_BYTES: '-1',
      ENABLE_API_DOCS: 'false',
    });
    expect(config.allowedOrigins).toEqual(['https://one.example', 'https://two.example']);
    expect(config.documentServiceBaseUrl).toBe('http://document-service:8080');
    expect(config.port).toBe(4100);
    expect(config.maxFileBytes).toBe(100 * 1024 * 1024);
    expect(config.enableApiDocs).toBe(false);
  });
});
