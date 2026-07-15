export interface ApiConfig {
  host: string;
  port: number;
  logLevel: string;
  allowedOrigins: string[];
  documentServiceBaseUrl: string;
  documentServiceApiKey: string;
  documentServiceTimeoutMs: number;
  maxFileBytes: number;
  maxRequestBytes: number;
  rateLimitMax: number;
  rateLimitWindow: string;
  enableApiDocs: boolean;
}

type Environment = Record<string, string | undefined>;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function booleanValue(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function trimTrailingSlash(value: string | undefined) {
  return (value ?? '').trim().replace(/\/+$/, '');
}

export function loadApiConfig(env: Environment = process.env): ApiConfig {
  const origins = (env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    host: env.HOST?.trim() || '0.0.0.0',
    port: positiveInteger(env.PORT, 3001),
    logLevel: env.LOG_LEVEL?.trim() || 'info',
    allowedOrigins: origins,
    documentServiceBaseUrl: trimTrailingSlash(env.DOCUMENT_SERVICE_BASE_URL),
    documentServiceApiKey: env.DOCUMENT_SERVICE_API_KEY?.trim() || '',
    documentServiceTimeoutMs: positiveInteger(env.DOCUMENT_SERVICE_TIMEOUT_MS, 180_000),
    maxFileBytes: positiveInteger(env.MAX_FILE_BYTES, 100 * 1024 * 1024),
    maxRequestBytes: positiveInteger(env.MAX_REQUEST_BYTES, 250 * 1024 * 1024),
    rateLimitMax: positiveInteger(env.RATE_LIMIT_MAX, 60),
    rateLimitWindow: env.RATE_LIMIT_WINDOW?.trim() || '1 minute',
    enableApiDocs: booleanValue(env.ENABLE_API_DOCS, true),
  };
}
