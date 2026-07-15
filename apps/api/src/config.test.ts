import { describe, expect, it } from 'vitest';
import { loadApiConfig } from './config.js';

describe('API configuration', () => {
  it('uses safe local defaults and leaves the upstream disabled', () => {
    const config = loadApiConfig({});
    expect(config.port).toBe(3001);
    expect(config.allowedOrigins).toEqual(['http://localhost:5173']);
    expect(config.documentServiceBaseUrl).toBe('');
    expect(config.documentServiceMaxConcurrency).toBe(1);
    expect(config.maxOutputBytes).toBe(250 * 1024 * 1024);
    expect(config.requestTimeoutMs).toBe(300_000);
    expect(config.trustProxyHops).toBe(0);
  });

  it('normalizes origins, URLs and positive numeric limits', () => {
    const config = loadApiConfig({
      ALLOWED_ORIGINS: 'https://one.example, https://two.example ',
      DOCUMENT_SERVICE_BASE_URL: 'http://document-service:8080/',
      PORT: '4100',
      MAX_FILE_BYTES: '-1',
      MAX_OUTPUT_BYTES: '5242880',
      DOCUMENT_SERVICE_MAX_CONCURRENCY: '3',
      REQUEST_TIMEOUT_MS: '45000',
      TRUST_PROXY_HOPS: '1',
      ENABLE_API_DOCS: 'false',
    });
    expect(config.allowedOrigins).toEqual(['https://one.example', 'https://two.example']);
    expect(config.documentServiceBaseUrl).toBe('http://document-service:8080');
    expect(config.port).toBe(4100);
    expect(config.maxFileBytes).toBe(100 * 1024 * 1024);
    expect(config.maxOutputBytes).toBe(5 * 1024 * 1024);
    expect(config.documentServiceMaxConcurrency).toBe(3);
    expect(config.requestTimeoutMs).toBe(45_000);
    expect(config.trustProxyHops).toBe(1);
    expect(config.enableApiDocs).toBe(false);
  });
});
