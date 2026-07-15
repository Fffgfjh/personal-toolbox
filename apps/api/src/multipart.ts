import path from 'node:path';
import type { FastifyRequest } from 'fastify';
import type { DocumentToolDefinition } from '@personal-toolbox/contracts';
import { ApiError } from './errors.js';

export interface BufferedUpload {
  filename: string;
  mimetype: string;
  bytes: Uint8Array;
}

export interface ParsedDocumentRequest {
  files: BufferedUpload[];
  fields: Record<string, string>;
}

export async function parseDocumentRequest(
  request: FastifyRequest,
  definition: DocumentToolDefinition,
  maxRequestBytes: number,
): Promise<ParsedDocumentRequest> {
  if (!request.isMultipart()) {
    throw new ApiError(415, 'multipart_required', '请使用 multipart/form-data 上传文件。');
  }

  const files: BufferedUpload[] = [];
  const fields: Record<string, string> = {};
  let totalBytes = 0;

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      const filename = safeFilename(part.filename || 'upload');
      const extension = path.extname(filename).toLowerCase();
      if (!definition.inputExtensions.includes(extension)) {
        part.file.resume();
        throw new ApiError(415, 'unsupported_file_type', `不支持 ${extension || '无扩展名'} 文件。`);
      }

      const buffer = await part.toBuffer();
      totalBytes += buffer.byteLength;
      if (totalBytes > maxRequestBytes) {
        throw new ApiError(413, 'request_too_large', '上传文件总大小超过限制。');
      }
      files.push({ filename, mimetype: part.mimetype, bytes: new Uint8Array(buffer) });
    } else {
      if (!definition.fields.some((field) => field.name === part.fieldname)) {
        throw new ApiError(422, 'unknown_field', `不支持字段 ${part.fieldname}。`);
      }
      fields[part.fieldname] = String(part.value);
    }
  }

  if (files.length < definition.minFiles) {
    throw new ApiError(422, 'missing_files', `至少需要 ${definition.minFiles} 个文件。`);
  }
  if (files.length > definition.maxFiles) {
    throw new ApiError(413, 'too_many_files', `最多允许 ${definition.maxFiles} 个文件。`);
  }

  for (const field of definition.fields) {
    const raw = fields[field.name];
    if ((raw === undefined || raw === '') && field.required && field.defaultValue === undefined) {
      throw new ApiError(422, 'missing_field', `缺少必填字段：${field.label}。`);
    }
    if (raw === undefined && field.defaultValue !== undefined) {
      fields[field.name] = String(field.defaultValue);
    }
    const value = fields[field.name];
    if (value !== undefined && field.type === 'number') {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || (field.min !== undefined && numeric < field.min) || (field.max !== undefined && numeric > field.max)) {
        throw new ApiError(422, 'invalid_field', `${field.label}超出允许范围。`);
      }
    }
    if (value !== undefined && field.options && !field.options.some((option) => String(option.value) === value)) {
      throw new ApiError(422, 'invalid_field', `${field.label}不是允许的选项。`);
    }
  }

  return { files, fields };
}

export function safeFilename(filename: string) {
  const cleaned = [...path.basename(filename.replaceAll('\\', '/'))]
    .filter((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
    .join('')
    .trim();
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : 'upload';
}
