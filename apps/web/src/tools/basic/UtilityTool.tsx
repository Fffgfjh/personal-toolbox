import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Play, RefreshCw, Trash2 } from 'lucide-react';
import { hash as bcryptHash } from 'bcryptjs';
import { md5, sha1, sha256 } from 'hash-wasm';
import {
  convertCase,
  convertNumberBase,
  decodeBase64,
  decodeHtmlEntities,
  decodeJwt,
  encodeBase64,
  encodeHtmlEntities,
  formatJson,
  formatSqlText,
  formatXml,
  jsonToYaml,
  minifyJson,
  parseColor,
  slugify,
  textStatistics,
  yamlToJson,
} from './textOperations';
import type { CaseMode } from './textOperations';

const BCRYPT_MIN_ROUNDS = 4;
const BCRYPT_MAX_ROUNDS = 14;
const BCRYPT_ROUNDS_ERROR = `Bcrypt 计算轮数必须是 ${BCRYPT_MIN_ROUNDS} 到 ${BCRYPT_MAX_ROUNDS} 之间的整数。`;

export type UtilityKind =
  | 'json'
  | 'yaml-json'
  | 'base64'
  | 'url'
  | 'hash'
  | 'hmac'
  | 'uuid'
  | 'password'
  | 'timestamp'
  | 'regex'
  | 'case'
  | 'statistics'
  | 'jwt'
  | 'html-entities'
  | 'slug'
  | 'number-base'
  | 'color'
  | 'sql'
  | 'xml'
  | 'bcrypt';

const samples: Partial<Record<UtilityKind, string>> = {
  json: '{"name":"toolbox","features":["local","api"]}',
  'yaml-json': 'name: toolbox\nfeatures:\n  - local\n  - api',
  base64: '你好，Personal Toolbox',
  url: 'https://example.com/search?q=个人工具箱',
  hash: '需要计算摘要的文本',
  hmac: '需要签名的消息',
  timestamp: String(Math.floor(Date.now() / 1000)),
  regex: 'toolbox-2026\npersonal-toolbox',
  case: 'Personal toolbox example',
  statistics: '在这里输入或粘贴文本。\n统计会包含字符、单词、行数和字节数。',
  jwt: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjMiLCJyb2xlIjoiZGVtbyJ9.',
  'html-entities': '<section class="toolbox">Hello & 你好</section>',
  slug: 'Personal Toolbox 项目 2026',
  'number-base': 'ff',
  color: '#0f9f76',
  sql: 'select id,name from tools where enabled=true order by name',
  xml: '<toolbox><tool id="1">JSON</tool><tool id="2">PDF</tool></toolbox>',
  bcrypt: 'change-me',
};

export function UtilityTool({ kind }: { kind: UtilityKind }) {
  const mountedRef = useRef(true);
  const runGenerationRef = useRef(0);
  const runningRef = useRef(false);
  const [input, setInput] = useState(samples[kind] || '');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'reverse'>('forward');
  const [caseMode, setCaseMode] = useState<CaseMode>('snake');
  const [fromBase, setFromBase] = useState(16);
  const [toBase, setToBase] = useState(10);
  const [pattern, setPattern] = useState('[a-z]+-(\\d+)');
  const [flags, setFlags] = useState('gi');
  const [secret, setSecret] = useState('secret-key');
  const [length, setLength] = useState(24);
  const [algorithm, setAlgorithm] = useState('sha256');
  const [roundsInput, setRoundsInput] = useState('10');
  const bcryptRounds = parseBcryptRounds(roundsInput);
  const bcryptRoundsError = kind === 'bcrypt' && bcryptRounds === null ? BCRYPT_ROUNDS_ERROR : '';
  const displayedError = bcryptRoundsError || error;

  const inputHidden = kind === 'uuid' || kind === 'password';
  const hint = useMemo(() => kind === 'jwt' ? '这里只解码，不会验证签名，也不会把 Token 发送到服务器。' : '', [kind]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runGenerationRef.current += 1;
      runningRef.current = false;
    };
  }, []);

  async function run() {
    if (runningRef.current) return;
    runningRef.current = true;
    const generation = runGenerationRef.current + 1;
    runGenerationRef.current = generation;
    const isCurrent = () => mountedRef.current && generation === runGenerationRef.current;
    setBusy(true);
    setError('');
    try {
      const result = await execute();
      if (!isCurrent()) return;
      setOutput(result);
    } catch (runError) {
      if (!isCurrent()) return;
      setOutput('');
      setError(runError instanceof Error ? runError.message : '处理失败，请检查输入。');
    } finally {
      if (isCurrent()) {
        runningRef.current = false;
        setBusy(false);
      }
    }
  }

  function clear() {
    if (runningRef.current) return;
    setInput('');
    setOutput('');
    setError('');
  }

  async function execute(): Promise<string> {
    switch (kind) {
      case 'json': return direction === 'forward' ? formatJson(input) : minifyJson(input);
      case 'yaml-json': return direction === 'forward' ? yamlToJson(input) : jsonToYaml(input);
      case 'base64': return direction === 'forward' ? encodeBase64(input) : decodeBase64(input);
      case 'url': return direction === 'forward' ? encodeURIComponent(input) : decodeURIComponent(input);
      case 'hash': return algorithm === 'md5' ? md5(input) : algorithm === 'sha1' ? sha1(input) : sha256(input);
      case 'hmac': return createHmac(input, secret);
      case 'uuid': return Array.from({ length: 8 }, () => crypto.randomUUID()).join('\n');
      case 'password': return createPassword(length);
      case 'timestamp': return convertTimestamp(input);
      case 'regex': return runRegex(input, pattern, flags);
      case 'case': return convertCase(input, caseMode);
      case 'statistics': return JSON.stringify(textStatistics(input), null, 2);
      case 'jwt': return decodeJwt(input);
      case 'html-entities': return direction === 'forward' ? encodeHtmlEntities(input) : decodeHtmlEntities(input);
      case 'slug': return slugify(input);
      case 'number-base': return convertNumberBase(input, fromBase, toBase);
      case 'color': return JSON.stringify(parseColor(input), null, 2);
      case 'sql': return formatSqlText(input);
      case 'xml': return formatXml(input);
      case 'bcrypt': {
        if (bcryptRounds === null) throw new Error(BCRYPT_ROUNDS_ERROR);
        return bcryptHash(input, bcryptRounds);
      }
    }
  }

  async function copyOutput() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="workbench">
      <div className="workbench-toolbar">
        <div className="control-row">
          {['json', 'yaml-json', 'base64', 'url', 'html-entities'].includes(kind) && (
            <select value={direction} disabled={busy} onChange={(event) => setDirection(event.target.value as typeof direction)} aria-label="转换方向">
              <option value="forward">{forwardLabel(kind)}</option>
              <option value="reverse">{reverseLabel(kind)}</option>
            </select>
          )}
          {kind === 'case' && <select value={caseMode} disabled={busy} aria-label="大小写格式" onChange={(event) => setCaseMode(event.target.value as CaseMode)}><option value="snake">snake_case</option><option value="camel">camelCase</option><option value="kebab">kebab-case</option><option value="constant">CONSTANT_CASE</option><option value="title">Title Case</option><option value="upper">大写</option><option value="lower">小写</option></select>}
          {kind === 'number-base' && <><label>输入进制<input type="number" min="2" max="36" value={fromBase} disabled={busy} onChange={(event) => setFromBase(Number(event.target.value))} /></label><label>输出进制<input type="number" min="2" max="36" value={toBase} disabled={busy} onChange={(event) => setToBase(Number(event.target.value))} /></label></>}
          {kind === 'regex' && <><label className="grow-control">表达式<input value={pattern} disabled={busy} onChange={(event) => setPattern(event.target.value)} /></label><label>标志<input className="short-input" value={flags} disabled={busy} onChange={(event) => setFlags(event.target.value)} /></label></>}
          {kind === 'hmac' && <label className="grow-control">密钥<input type="password" value={secret} disabled={busy} onChange={(event) => setSecret(event.target.value)} /></label>}
          {kind === 'hash' && <select value={algorithm} disabled={busy} aria-label="摘要算法" onChange={(event) => setAlgorithm(event.target.value)}><option value="sha256">SHA-256</option><option value="sha1">SHA-1</option><option value="md5">MD5</option></select>}
          {kind === 'password' && <label>长度<input type="number" min="8" max="256" value={length} disabled={busy} onChange={(event) => setLength(Number(event.target.value))} /></label>}
          {kind === 'bcrypt' && <label>计算轮数<input type="number" min={BCRYPT_MIN_ROUNDS} max={BCRYPT_MAX_ROUNDS} step="1" value={roundsInput} disabled={busy} aria-invalid={Boolean(bcryptRoundsError)} aria-describedby={bcryptRoundsError ? 'bcrypt-rounds-error' : undefined} onChange={(event) => { setRoundsInput(event.target.value); setError(''); }} /></label>}
        </div>
        <div className="toolbar-actions">
          <button className="secondary-button" type="button" onClick={clear} disabled={busy}><Trash2 size={16} /> 清空</button>
          <button className="primary-button" type="button" onClick={run} disabled={busy || Boolean(bcryptRoundsError)}><Play size={16} /> {busy ? '处理中…' : actionLabel(kind)}</button>
        </div>
      </div>

      {hint && <p className="privacy-hint">{hint}</p>}
      <div className={`editor-grid ${inputHidden ? 'single-output' : ''}`}>
        {!inputHidden && <label className="editor-panel"><span>输入</span><textarea value={input} disabled={busy} onChange={(event) => setInput(event.target.value)} spellCheck={false} /></label>}
        <label className="editor-panel output-panel">
          <span>结果 <button type="button" onClick={copyOutput} disabled={!output}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? '已复制' : '复制'}</button></span>
          <textarea value={output} readOnly placeholder="处理结果会显示在这里" spellCheck={false} />
        </label>
      </div>
      {displayedError && <div id={bcryptRoundsError ? 'bcrypt-rounds-error' : undefined} className="error-banner" role="alert">{displayedError}</div>}
      {(kind === 'uuid' || kind === 'password') && <button className="secondary-button regenerate-button" type="button" onClick={run} disabled={busy}><RefreshCw size={16} /> 再生成一组</button>}
    </div>
  );
}

function forwardLabel(kind: UtilityKind) {
  return ({ json: '格式化 JSON', 'yaml-json': 'YAML → JSON', base64: '编码 Base64', url: '编码 URL', 'html-entities': '编码实体' } as Partial<Record<UtilityKind, string>>)[kind] || '正向转换';
}

function reverseLabel(kind: UtilityKind) {
  return ({ json: '压缩 JSON', 'yaml-json': 'JSON → YAML', base64: '解码 Base64', url: '解码 URL', 'html-entities': '解码实体' } as Partial<Record<UtilityKind, string>>)[kind] || '反向转换';
}

function actionLabel(kind: UtilityKind) {
  if (kind === 'uuid' || kind === 'password') return '生成';
  if (kind === 'hash' || kind === 'hmac' || kind === 'bcrypt') return '计算';
  if (kind === 'regex') return '匹配';
  return '处理';
}

async function createHmac(input: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input)));
  return [...signature].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createPassword(length: number) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=';
  const bytes = crypto.getRandomValues(new Uint8Array(Math.max(8, Math.min(256, length))));
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
}

function parseBcryptRounds(value: string) {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const rounds = Number(normalized);
  return Number.isSafeInteger(rounds) && rounds >= BCRYPT_MIN_ROUNDS && rounds <= BCRYPT_MAX_ROUNDS
    ? rounds
    : null;
}

function convertTimestamp(input: string) {
  const normalized = input.trim();
  const numeric = Number(normalized);
  const date = Number.isFinite(numeric) && normalized !== ''
    ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
    : new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new Error('无法识别这个时间。');
  return JSON.stringify({ iso: date.toISOString(), local: date.toLocaleString(), unixSeconds: Math.floor(date.getTime() / 1000), unixMilliseconds: date.getTime() }, null, 2);
}

function runRegex(input: string, pattern: string, flags: string) {
  const safeFlags = flags.includes('g') ? flags : `${flags}g`;
  const expression = new RegExp(pattern, safeFlags);
  const matches = [...input.matchAll(expression)].slice(0, 100).map((match) => ({ match: match[0], index: match.index, groups: match.slice(1) }));
  return JSON.stringify({ count: matches.length, matches }, null, 2);
}
