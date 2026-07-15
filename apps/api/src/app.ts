import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { documentToolCatalog, findDocumentTool } from '@personal-toolbox/contracts';
import type { ApiConfig } from './config.js';
import { ApiError, sendApiError } from './errors.js';
import { parseDocumentRequest } from './multipart.js';
import { proxyDocumentRequest } from './proxy.js';
import type { FetchImplementation } from './proxy.js';

export interface BuildAppOptions {
  config: ApiConfig;
  fetchImplementation?: FetchImplementation;
  logger?: boolean;
}

export async function buildApp({ config, fetchImplementation, logger = false }: BuildAppOptions) {
  const app = Fastify({
    logger: logger ? { level: config.logLevel } : false,
    bodyLimit: config.maxRequestBytes,
    requestIdHeader: 'x-request-id',
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || config.allowedOrigins.includes('*') || config.allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
  });
  await app.register(rateLimit, { max: config.rateLimitMax, timeWindow: config.rateLimitWindow });
  await app.register(multipart, {
    limits: {
      files: 10,
      fileSize: config.maxFileBytes,
      fields: 20,
      parts: 30,
    },
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Personal Toolbox API',
        description: '独立的文档工具 API。前端只依赖这里公开的稳定契约。',
        version: '0.1.0',
      },
      tags: [{ name: 'system' }, { name: 'documents' }],
    },
  });
  if (config.enableApiDocs) {
    await app.register(swaggerUi, { routePrefix: '/docs' });
  }

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) return sendApiError(error, request, reply);
    if (typeof error === 'object' && error !== null && 'code' in error) {
      if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
        return sendApiError(new ApiError(413, 'file_too_large', '单个文件超过大小限制。'), request, reply);
      }
      if (error.code === 'FST_FILES_LIMIT') {
        return sendApiError(new ApiError(413, 'too_many_files', '上传文件数量超过全局限制。'), request, reply);
      }
      if (error.code === 'FST_FIELDS_LIMIT' || error.code === 'FST_PARTS_LIMIT') {
        return sendApiError(new ApiError(413, 'too_many_parts', '上传表单字段数量超过限制。'), request, reply);
      }
    }
    request.log.error(error);
    return sendApiError(new ApiError(500, 'internal_error', '服务器暂时无法完成请求。'), request, reply);
  });

  app.get('/api/v1/health', {
    schema: { tags: ['system'], summary: '健康检查' },
  }, async () => ({
    status: 'ok' as const,
    service: 'personal-toolbox-api' as const,
    documentServiceConfigured: Boolean(config.documentServiceBaseUrl),
    timestamp: new Date().toISOString(),
  }));

  app.get('/api/v1/document-tools', {
    schema: { tags: ['documents'], summary: '获取文档工具契约' },
  }, async () => documentToolCatalog);

  app.post<{ Params: { toolId: string } }>('/api/v1/document-tools/:toolId/run', {
    config: { rateLimit: { max: 15, timeWindow: '1 minute' } },
    schema: {
      tags: ['documents'],
      summary: '运行文档工具',
      consumes: ['multipart/form-data'],
      params: {
        type: 'object',
        required: ['toolId'],
        properties: { toolId: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const definition = findDocumentTool(request.params.toolId);
    if (!definition) throw new ApiError(404, 'unknown_tool', '没有找到这个文档工具。');
    const parsed = await parseDocumentRequest(request, definition, config.maxRequestBytes);
    return proxyDocumentRequest(config, definition, parsed, reply, fetchImplementation);
  });

  return app;
}
