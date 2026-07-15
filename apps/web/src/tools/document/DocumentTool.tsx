import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Download, FilePlus2, LoaderCircle, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import type { DocumentFieldDefinition, DocumentToolDefinition } from '@personal-toolbox/contracts';
import { projectConfig } from '../../config/project';
import { runDocumentTool } from '../../api/client';

type FieldValue = string | number | boolean;

export function DocumentTool({ definition }: { definition: DocumentToolDefinition }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fields, setFields] = useState<Record<string, FieldValue>>(() => Object.fromEntries(
    definition.fields.filter((field) => field.defaultValue !== undefined).map((field) => [field.name, field.defaultValue!]),
  ));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; filename: string; size: number } | null>(null);
  const accept = definition.inputExtensions.join(',');
  const totalBytes = useMemo(() => files.reduce((total, file) => total + file.size, 0), [files]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError('');
    setFiles((current) => [...current, ...Array.from(list)].slice(0, definition.maxFiles));
    if (inputRef.current) inputRef.current.value = '';
  }

  function move(index: number, delta: number) {
    setFiles((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target]!, copy[index]!];
      return copy;
    });
  }

  async function run() {
    if (files.length < definition.minFiles) {
      setError(`至少需要选择 ${definition.minFiles} 个文件。`);
      return;
    }
    if (!projectConfig.apiBaseUrl) {
      setError('这个前端还没有配置独立 API 地址。');
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError('');
    try {
      const response = await runDocumentTool(definition, files, fields, controller.signal);
      if (result) URL.revokeObjectURL(result.url);
      setResult({ url: URL.createObjectURL(response.blob), filename: response.filename, size: response.blob.size });
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : '文档处理失败。');
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="document-tool">
      <div className="document-main">
        <button className="drop-zone compact-drop-zone" type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}>
          <FilePlus2 size={34} /><strong>{files.length ? '继续添加文件' : '拖入文件或点击选择'}</strong><span>支持 {definition.inputExtensions.join('、')} · 最多 {definition.maxFiles} 个</span>
        </button>
        <input ref={inputRef} type="file" hidden accept={accept} multiple={definition.maxFiles > 1} onChange={(event) => addFiles(event.target.files)} />

        {files.length > 0 && <div className="upload-list"><div className="upload-list-heading"><span>已选文件</span><b>{files.length} 个 · {formatBytes(totalBytes)}</b></div>{files.map((file, index) => <div className="upload-item" key={`${file.name}-${file.lastModified}-${index}`}><span className="file-order">{index + 1}</span><div><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></div>{files.length > 1 && <span className="reorder-buttons"><button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="上移"><ArrowUp /></button><button type="button" onClick={() => move(index, 1)} disabled={index === files.length - 1} aria-label="下移"><ArrowDown /></button></span>}<button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} aria-label="移除"><Trash2 /></button></div>)}</div>}

        {definition.fields.some((field) => field.type !== 'hidden') && <div className="document-fields"><h3>处理选项</h3>{definition.fields.map((field) => <DocumentField key={field.name} definition={field} value={fields[field.name] ?? ''} onChange={(value) => setFields((current) => ({ ...current, [field.name]: value }))} />)}</div>}
      </div>

      <aside className="document-sidebar">
        <div className="privacy-card"><ShieldCheck /><div><strong>处理边界清楚</strong><p>文件只发送到你配置的独立 API；API 再按固定白名单访问文档服务。</p></div></div>
        <dl className="job-summary"><div><dt>文件要求</dt><dd>{definition.minFiles === definition.maxFiles ? `${definition.minFiles} 个` : `${definition.minFiles}–${definition.maxFiles} 个`}</dd></div><div><dt>输出格式</dt><dd>.{definition.outputExtension}</dd></div><div><dt>任务等级</dt><dd>{definition.processingClass === 'heavy' ? '较慢' : '标准'}</dd></div></dl>
        {!busy ? <button className="primary-button run-document-button" type="button" onClick={() => void run()} disabled={files.length < definition.minFiles}><Download size={18} /> 开始处理</button> : <button className="danger-button run-document-button" type="button" onClick={() => abortRef.current?.abort()}><XCircle size={18} /> 取消处理</button>}
        {busy && <div className="processing-state"><LoaderCircle className="spin" /><span>正在上传并处理，请保持页面打开…</span></div>}
        {result && <div className="document-result"><CheckCircle2 /><strong>处理完成</strong><span>{result.filename} · {formatBytes(result.size)}</span><a className="primary-button" href={result.url} download={result.filename}><Download size={17} /> 下载结果</a></div>}
        {error && <div className="error-banner" role="alert">{error}</div>}
      </aside>
    </div>
  );
}

function DocumentField({ definition, value, onChange }: { definition: DocumentFieldDefinition; value: FieldValue; onChange: (value: FieldValue) => void }) {
  if (definition.type === 'hidden') return null;
  if (definition.type === 'checkbox') return <label className="checkbox-field"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><span>{definition.label}</span></label>;
  if (definition.type === 'select') return <label>{definition.label}<select value={String(value)} onChange={(event) => onChange(event.target.value)}>{definition.options?.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select></label>;
  return <label>{definition.label}<input type={definition.type} required={definition.required} min={definition.min} max={definition.max} step={definition.step} value={String(value)} onChange={(event) => onChange(definition.type === 'number' ? Number(event.target.value) : event.target.value)} /></label>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
