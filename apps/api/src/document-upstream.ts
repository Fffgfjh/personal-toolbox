import type { DocumentToolId } from '@personal-toolbox/contracts';

type UpstreamField = readonly [name: string, value: string];
type FieldTransform = (fields: Readonly<Record<string, string>>) => UpstreamField[];

interface DocumentUpstreamOperation {
  path: string;
  transformFields?: FieldTransform;
}

function entries(fields: Readonly<Record<string, string>>) {
  return Object.entries(fields) as UpstreamField[];
}

function without(fields: Readonly<Record<string, string>>, ...names: string[]) {
  const omitted = new Set(names);
  return entries(fields).filter(([name]) => !omitted.has(name));
}

function defaulted(
  fields: Readonly<Record<string, string>>,
  defaults: Readonly<Record<string, string>>,
) {
  const result = [...entries(fields)];
  const existing = new Set(result.map(([name]) => name));
  for (const [name, value] of Object.entries(defaults)) {
    if (!existing.has(name)) result.push([name, value]);
  }
  return result;
}

const operations: Readonly<Record<DocumentToolId, DocumentUpstreamOperation>> = {
  'pdf-to-word': {
    path: '/api/v1/convert/pdf/word',
    transformFields: (fields) => defaulted(fields, { outputFormat: 'docx' }),
  },
  'office-to-pdf': { path: '/api/v1/convert/file/pdf' },
  'image-to-pdf': {
    path: '/api/v1/convert/img/pdf',
    transformFields: (fields) => defaulted(Object.fromEntries(entries(fields).map(([name, value]) => (
      name === 'fitOption' && value === 'fitDocumentToPage'
        ? [name, 'fitDocumentToImage'] as const
        : [name, value] as const
    ))), { colorType: 'color' }),
  },
  'pdf-to-image': {
    path: '/api/v1/convert/pdf/img',
    transformFields: (fields) => defaulted(fields, {
      singleOrMultiple: 'multiple',
      colorType: 'color',
      includeAnnotations: 'false',
      pageNumbers: 'all',
    }),
  },
  'pdf-merge': {
    path: '/api/v1/general/merge-pdfs',
    transformFields: (fields) => defaulted(fields, {
      sortType: 'orderProvided',
      removeCertSign: 'true',
      generateToc: 'false',
    }),
  },
  'pdf-split': { path: '/api/v1/general/split-pages' },
  'pdf-extract-pages': {
    path: '/api/v1/general/rearrange-pages',
    transformFields: (fields) => defaulted(fields, { customMode: 'CUSTOM' }),
  },
  'pdf-compress': {
    path: '/api/v1/misc/compress-pdf',
    transformFields: (fields) => defaulted(fields, {
      linearize: 'false',
      normalize: 'false',
      grayscale: 'false',
    }),
  },
  'pdf-repair': { path: '/api/v1/misc/repair' },
  'pdf-ocr': {
    path: '/api/v1/misc/ocr-pdf',
    transformFields: (fields) => {
      const result = without(fields, 'languages');
      const languages = (fields.languages || 'eng').split('+').map((value) => value.trim()).filter(Boolean);
      for (const language of languages) result.push(['languages', language]);
      return defaulted(Object.fromEntries(result), {
        sidecar: 'false',
        clean: 'false',
        cleanFinal: 'false',
        ocrType: 'skip-text',
        ocrRenderType: 'hocr',
        removeImagesAfter: 'false',
      }).flatMap(([name, value]) => name === 'languages'
        ? languages.map((language) => ['languages', language] as const)
        : [[name, value] as const]);
    },
  },
  'pdf-watermark': {
    path: '/api/v1/security/add-watermark',
    transformFields: (fields) => defaulted(Object.fromEntries(without(fields, 'position')), {
      watermarkType: 'text',
      alphabet: /[\u3400-\u9fff]/u.test(fields.watermarkText ?? '') ? 'chinese' : 'roman',
      fontSize: '30',
      rotation: '0',
      widthSpacer: '50',
      heightSpacer: '50',
      customColor: '#d3d3d3',
      convertPDFToImage: 'false',
    }),
  },
  'pdf-page-numbers': {
    path: '/api/v1/misc/add-page-numbers',
    transformFields: (fields) => defaulted(fields, {
      pageNumbers: 'all',
      pagesToNumber: 'all',
      fontSize: '12',
      fontType: 'helvetica',
    }),
  },
  'pdf-protect': {
    path: '/api/v1/security/add-password',
    transformFields: (fields) => defaulted(fields, { keyLength: '256' }),
  },
  'pdf-unlock': { path: '/api/v1/security/remove-password' },
  'pdf-metadata-remover': { path: '/api/v1/misc/update-metadata' },
};

export const documentUpstreamPaths: Readonly<Record<DocumentToolId, string>> = Object.fromEntries(
  Object.entries(operations).map(([id, operation]) => [id, operation.path]),
) as Record<DocumentToolId, string>;

export function documentUpstreamFields(
  toolId: DocumentToolId,
  fields: Readonly<Record<string, string>>,
) {
  return operations[toolId].transformFields?.(fields) ?? entries(fields);
}
