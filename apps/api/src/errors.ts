import type { FastifyReply, FastifyRequest } from 'fastify';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function sendApiError(error: ApiError, request: FastifyRequest, reply: FastifyReply) {
  return reply.code(error.statusCode).send({
    code: error.code,
    message: error.message,
    requestId: request.id,
  });
}
