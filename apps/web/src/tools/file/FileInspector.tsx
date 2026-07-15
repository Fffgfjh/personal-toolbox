import { useEffect, useRef, useState } from 'react';
import { Check, Clipboard, FileCheck2, FileUp, RotateCcw } from 'lucide-react';
import { createMD5, createSHA256 } from 'hash-wasm';
import { detectFileType, formatBytes } from './fileAnalysis';
import type { DetectedFileType } from './fileAnalysis';

interface AnalysisResult {
  type: DetectedFileType;
  md5: string;
  sha256: string;
  elapsedMs: number;
}

export function FileInspector({ mode }: { mode: 'checksum' | 'type' }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const generationRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');

  useEffect(() => () => {
    generationRef.current += 1;
  }, []);

  async function analyze(selected: File) {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const isCurrent = () => generation === generationRef.current;
    setFile(selected);
    setBusy(true);
    setResult(null);
    setProgress(0);
    setError('');
    const started = performance.now();
    try {
      const header = new Uint8Array(await selected.slice(0, 32).arrayBuffer());
      if (!isCurrent()) return;
      const type = detectFileType(header, selected.name, selected.type);
      const md5 = await createMD5();
      if (!isCurrent()) return;
      const sha256 = await createSHA256();
      if (!isCurrent()) return;
      const chunkSize = 4 * 1024 * 1024;
      for (let offset = 0; offset < selected.size; offset += chunkSize) {
        const chunk = new Uint8Array(await selected.slice(offset, offset + chunkSize).arrayBuffer());
        if (!isCurrent()) return;
        md5.update(chunk);
        sha256.update(chunk);
        if (isCurrent()) {
          setProgress(Math.min(100, Math.round(((offset + chunk.byteLength) / selected.size) * 100)));
        }
      }
      if (!isCurrent()) return;
      if (selected.size === 0) setProgress(100);
      setResult({ type, md5: md5.digest('hex'), sha256: sha256.digest('hex'), elapsedMs: performance.now() - started });
    } catch {
      if (isCurrent()) setError('文件分析失败，请重试或更换文件。');
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }

  function chooseFiles(files: FileList | null) {
    const selected = files?.[0];
    if (selected) void analyze(selected);
  }

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1200);
  }

  function reset() {
    generationRef.current += 1;
    setFile(null);
    setResult(null);
    setBusy(false);
    setProgress(0);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="file-inspector">
      {!file ? (
        <button
          type="button"
          className={`drop-zone ${dragging ? 'is-dragging' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFiles(event.dataTransfer.files); }}
        >
          <FileUp size={42} />
          <strong>拖入任意文件，或点击选择</strong>
          <span>分析在浏览器本地进行，不会上传文件</span>
        </button>
      ) : (
        <>
          <div className="selected-file-card">
            <FileCheck2 size={32} />
            <div><strong>{file.name}</strong><span>{formatBytes(file.size)} · {file.type || '浏览器未提供 MIME'}</span></div>
            <button className="secondary-button" type="button" onClick={reset}><RotateCcw size={16} /> 换一个文件</button>
          </div>
          {busy && <div className="progress-block"><div><span>正在分块计算摘要…</span><b>{progress}%</b></div><progress value={progress} max="100" /></div>}
        </>
      )}
      <input ref={inputRef} type="file" hidden onChange={(event) => chooseFiles(event.target.files)} />

      {result && (
        <div className="analysis-results" role="status" aria-live="polite">
          <section><h3>文件识别</h3><dl><div><dt>推测类型</dt><dd>{result.type.label}</dd></div><div><dt>标准 MIME</dt><dd>{result.type.mime}</dd></div><div><dt>识别依据</dt><dd>{confidenceLabel(result.type.confidence)}</dd></div><div><dt>最后修改</dt><dd>{file ? new Date(file.lastModified).toLocaleString() : '-'}</dd></div></dl></section>
          <section className={mode === 'type' ? 'muted-result' : ''}><h3>文件摘要 <small>耗时 {Math.round(result.elapsedMs)}ms</small></h3><HashRow label="MD5" value={result.md5} copied={copied} onCopy={copy} /><HashRow label="SHA-256" value={result.sha256} copied={copied} onCopy={copy} /></section>
        </div>
      )}
      {error && <div className="error-banner" role="alert">{error}</div>}
    </div>
  );
}

function HashRow({ label, value, copied, onCopy }: { label: string; value: string; copied: string; onCopy: (label: string, value: string) => void }) {
  return <div className="hash-row"><span>{label}</span><code>{value}</code><button type="button" aria-label={`${copied === label ? '已复制' : '复制'} ${label} 摘要`} onClick={() => void onCopy(label, value)}>{copied === label ? <Check size={16} /> : <Clipboard size={16} />}</button></div>;
}

function confidenceLabel(confidence: DetectedFileType['confidence']) {
  return { signature: '文件头签名', browser: '浏览器 MIME', extension: '文件扩展名', unknown: '无法确定' }[confidence];
}
