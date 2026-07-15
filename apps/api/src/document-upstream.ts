import type { DocumentToolId } from '@personal-toolbox/contracts';

export const documentUpstreamPaths: Readonly<Record<DocumentToolId, string>> = {
  'pdf-to-word': '/api/v1/convert/pdf/word',
  'office-to-pdf': '/api/v1/convert/file/pdf',
  'image-to-pdf': '/api/v1/convert/img/pdf',
  'pdf-to-image': '/api/v1/convert/pdf/img',
  'pdf-merge': '/api/v1/general/merge-pdfs',
  'pdf-split': '/api/v1/general/split-pages',
  'pdf-extract-pages': '/api/v1/general/extract-pages',
  'pdf-compress': '/api/v1/misc/compress-pdf',
  'pdf-repair': '/api/v1/misc/repair',
  'pdf-ocr': '/api/v1/misc/ocr-pdf',
  'pdf-watermark': '/api/v1/security/add-watermark',
  'pdf-page-numbers': '/api/v1/misc/add-page-numbers',
  'pdf-protect': '/api/v1/security/add-password',
  'pdf-unlock': '/api/v1/security/remove-password',
  'pdf-metadata-remover': '/api/v1/misc/remove-metadata',
};
