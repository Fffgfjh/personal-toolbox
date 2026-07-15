import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Download, FlipHorizontal2, FlipVertical2, ImagePlus, RotateCcw, RotateCw, Scan, Trash2, Link, Unlink } from 'lucide-react';
import { clampCrop, fittedPreviewSize, rotatedSize } from './imageMath';
import type { CropRect } from './imageMath';

export type ImageStudioMode = 'compress' | 'resize' | 'crop' | 'convert' | 'metadata';
type OutputFormat = 'image/png' | 'image/jpeg' | 'image/webp';

interface DragState {
  kind: 'move' | 'resize';
  startX: number;
  startY: number;
  crop: CropRect;
}

const fullCrop: CropRect = { x: 0, y: 0, width: 1, height: 1 };
const minOutputDimension = 1;
const maxOutputDimension = 12000;
const maxOutputPixels = 32_000_000;

interface OutputDimensions {
  width: number;
  height: number;
}

interface PendingImageLoad {
  generation: number;
  image: HTMLImageElement;
  url: string;
}

function clampOutputDimension(value: number, fallback = minOutputDimension) {
  const finite = Number.isFinite(value) ? value : fallback;
  return Math.min(maxOutputDimension, Math.max(minOutputDimension, Math.round(finite)));
}

function constrainOutputDimensions(width: number, height: number): OutputDimensions {
  const safeWidth = Math.max(minOutputDimension, Number.isFinite(width) ? width : minOutputDimension);
  const safeHeight = Math.max(minOutputDimension, Number.isFinite(height) ? height : minOutputDimension);
  const pixelScale = Math.sqrt(maxOutputPixels / (safeWidth * safeHeight));
  const scale = Math.min(1, maxOutputDimension / safeWidth, maxOutputDimension / safeHeight, pixelScale);
  return {
    width: clampOutputDimension(Math.floor(safeWidth * scale)),
    height: clampOutputDimension(Math.floor(safeHeight * scale)),
  };
}

function isValidDimensionInput(value: string) {
  if (!value.trim()) return false;
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric >= minOutputDimension && numeric <= maxOutputDimension;
}

export function ImageStudio({ mode }: { mode: ImageStudioMode }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const outputRevisionRef = useRef(0);
  const loadGenerationRef = useRef(0);
  const pendingImageLoadRef = useRef<PendingImageLoad | null>(null);
  const activeExportRef = useRef<symbol | null>(null);
  const mountedRef = useRef(true);
  const [file, setFile] = useState<File | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [draggingFile, setDraggingFile] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [crop, setCrop] = useState<CropRect>(fullCrop);
  const [format, setFormat] = useState<OutputFormat>(mode === 'convert' ? 'image/webp' : 'image/jpeg');
  const [quality, setQuality] = useState(mode === 'compress' ? 0.72 : 0.9);
  const [targetWidth, setTargetWidth] = useState(0);
  const [targetHeight, setTargetHeight] = useState(0);
  const [widthInput, setWidthInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [lockAspect, setLockAspect] = useState(true);
  const [outputUrl, setOutputUrl] = useState('');
  const [outputSize, setOutputSize] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rotated = image ? rotatedSize(image.naturalWidth, image.naturalHeight, rotation) : { width: 1, height: 1 };
  const widthValid = isValidDimensionInput(widthInput);
  const heightValid = isValidDimensionInput(heightInput);
  const pixelCountValid = widthValid && heightValid && Number(widthInput) * Number(heightInput) <= maxOutputPixels;
  const dimensionsValid = widthValid
    && heightValid
    && pixelCountValid
    && Number.isSafeInteger(targetWidth)
    && Number.isSafeInteger(targetHeight)
    && targetWidth === Number(widthInput)
    && targetHeight === Number(heightInput)
    && targetWidth >= minOutputDimension
    && targetWidth <= maxOutputDimension
    && targetHeight >= minOutputDimension
    && targetHeight <= maxOutputDimension;

  useEffect(() => () => { if (outputUrl) URL.revokeObjectURL(outputUrl); }, [outputUrl]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadGenerationRef.current += 1;
      outputRevisionRef.current += 1;
      const pending = pendingImageLoadRef.current;
      if (!pending) return;
      pending.image.onload = null;
      pending.image.onerror = null;
      pending.image.src = '';
      URL.revokeObjectURL(pending.url);
      pendingImageLoadRef.current = null;
    };
  }, []);

  useEffect(() => {
    outputRevisionRef.current += 1;
    setOutputUrl('');
    setOutputSize(0);
    setError('');
  }, [crop, flipX, flipY, format, heightInput, quality, rotation, targetHeight, targetWidth, widthInput, zoom]);

  useLayoutEffect(() => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const preview = fittedPreviewSize(rotated.width, rotated.height);
    canvas.width = preview.width;
    canvas.height = preview.height;
    drawTransformed(canvas, image, rotation, flipX, flipY, zoom, preview.scale);
  }, [flipX, flipY, image, rotated.height, rotated.width, rotation, zoom]);

  useEffect(() => {
    function pointerMove(event: PointerEvent) {
      const drag = dragRef.current;
      const stage = stageRef.current;
      if (!drag || !stage) return;
      const rect = stage.getBoundingClientRect();
      const dx = (event.clientX - drag.startX) / rect.width;
      const dy = (event.clientY - drag.startY) / rect.height;
      if (drag.kind === 'move') {
        setCrop(clampCrop({ ...drag.crop, x: drag.crop.x + dx, y: drag.crop.y + dy }));
      } else {
        setCrop(clampCrop({ ...drag.crop, width: drag.crop.width + dx, height: drag.crop.height + dy }));
      }
    }
    const pointerUp = () => { dragRef.current = null; };
    window.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp);
    return () => {
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
    };
  }, []);

  function cancelPendingImageLoad() {
    const pending = pendingImageLoadRef.current;
    if (!pending) return;
    pending.image.onload = null;
    pending.image.onerror = null;
    pending.image.src = '';
    URL.revokeObjectURL(pending.url);
    pendingImageLoadRef.current = null;
  }

  function beginImageSelection() {
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    outputRevisionRef.current += 1;
    cancelPendingImageLoad();
    setOutputUrl('');
    setOutputSize(0);
    setError('');
    return generation;
  }

  function loadFile(selected: File, generation = beginImageSelection()) {
    if (generation !== loadGenerationRef.current) return;
    if (!selected.type.startsWith('image/')) {
      setError('请选择浏览器支持的图片文件。');
      return;
    }
    const url = URL.createObjectURL(selected);
    const nextImage = new Image();
    pendingImageLoadRef.current = { generation, image: nextImage, url };
    nextImage.onload = () => {
      const pending = pendingImageLoadRef.current;
      if (generation !== loadGenerationRef.current || pending?.image !== nextImage) return;
      pendingImageLoadRef.current = null;
      URL.revokeObjectURL(url);
      setFile(selected);
      setImage(nextImage);
      setRotation(0);
      setFlipX(false);
      setFlipY(false);
      setZoom(1);
      setCrop(fullCrop);
      setOutputDimensions(constrainOutputDimensions(nextImage.naturalWidth, nextImage.naturalHeight));
      setOutputUrl('');
      setOutputSize(0);
      setError('');
    };
    nextImage.onerror = () => {
      const pending = pendingImageLoadRef.current;
      if (generation !== loadGenerationRef.current || pending?.image !== nextImage) return;
      pendingImageLoadRef.current = null;
      URL.revokeObjectURL(url);
      setError('浏览器无法读取这张图片。');
    };
    nextImage.src = url;
  }

  async function loadDemoImage() {
    const generation = beginImageSelection();
    try {
      const demoFile = await createDemoImage();
      if (generation === loadGenerationRef.current) loadFile(demoFile, generation);
    } catch (demoError) {
      if (generation !== loadGenerationRef.current) return;
      setError(demoError instanceof Error ? demoError.message : '无法生成示例图片。');
    }
  }

  function selectFile(files: FileList | null) {
    const selected = files?.[0];
    if (selected) loadFile(selected);
    if (inputRef.current) inputRef.current.value = '';
  }

  function rotate(delta: number) {
    if (!image) return;
    const next = (rotation + delta + 360) % 360;
    const size = rotatedSize(image.naturalWidth, image.naturalHeight, next);
    setRotation(next);
    setOutputDimensions(constrainOutputDimensions(size.width, size.height));
    setCrop(fullCrop);
  }

  function changeWidth(value: number) {
    const width = clampOutputDimension(value, targetWidth || minOutputDimension);
    if (lockAspect) {
      const aspectRatio = (rotated.width * crop.width) / (rotated.height * crop.height);
      setOutputDimensions(constrainOutputDimensions(width, width / aspectRatio));
      return;
    }
    setTargetWidth(width);
    setWidthInput(String(width));
  }

  function changeHeight(value: number) {
    const height = clampOutputDimension(value, targetHeight || minOutputDimension);
    if (lockAspect) {
      const aspectRatio = (rotated.width * crop.width) / (rotated.height * crop.height);
      setOutputDimensions(constrainOutputDimensions(height * aspectRatio, height));
      return;
    }
    setTargetHeight(height);
    setHeightInput(String(height));
  }

  function setOutputDimensions(dimensions: OutputDimensions) {
    setTargetWidth(dimensions.width);
    setTargetHeight(dimensions.height);
    setWidthInput(String(dimensions.width));
    setHeightInput(String(dimensions.height));
  }

  function updateWidthInput(value: string) {
    setWidthInput(value);
    if (isValidDimensionInput(value)) changeWidth(Number(value));
  }

  function updateHeightInput(value: string) {
    setHeightInput(value);
    if (isValidDimensionInput(value)) changeHeight(Number(value));
  }

  function adjustCropWithKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    const direction = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 0.05 : 0.01;
    setCrop((current) => clampCrop(event.altKey
      ? {
          ...current,
          width: current.width + direction.x * step,
          height: current.height + direction.y * step,
        }
      : {
          ...current,
          x: current.x + direction.x * step,
          y: current.y + direction.y * step,
        }));
  }

  function startCropDrag(event: React.PointerEvent, kind: DragState['kind']) {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { kind, startX: event.clientX, startY: event.clientY, crop };
  }

  async function exportImage() {
    if (!image || activeExportRef.current) return;
    if (!dimensionsValid) {
      setError(`输出宽高必须是 ${minOutputDimension}–${maxOutputDimension} 之间的整数，且总像素不能超过 3200 万。`);
      return;
    }
    const activeExport = Symbol('image-export');
    activeExportRef.current = activeExport;
    setBusy(true);
    setError('');
    const outputRevision = outputRevisionRef.current;
    let sourceCanvas: HTMLCanvasElement | null = null;
    let outputCanvas: HTMLCanvasElement | null = null;
    try {
      sourceCanvas = document.createElement('canvas');
      const sourceDimensions = constrainOutputDimensions(rotated.width, rotated.height);
      const sourceScale = Math.min(sourceDimensions.width / rotated.width, sourceDimensions.height / rotated.height);
      sourceCanvas.width = sourceDimensions.width;
      sourceCanvas.height = sourceDimensions.height;
      drawTransformed(sourceCanvas, image, rotation, flipX, flipY, zoom, sourceScale, true);

      const sx = Math.round(crop.x * sourceCanvas.width);
      const sy = Math.round(crop.y * sourceCanvas.height);
      const sw = Math.max(1, Math.round(crop.width * sourceCanvas.width));
      const sh = Math.max(1, Math.round(crop.height * sourceCanvas.height));
      outputCanvas = document.createElement('canvas');
      outputCanvas.width = clampOutputDimension(targetWidth, sw);
      outputCanvas.height = clampOutputDimension(targetHeight, sh);
      const context = outputCanvas.getContext('2d');
      if (!context) throw new Error('浏览器无法创建图片画布。');
      if (format === 'image/jpeg') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, outputCanvas.width, outputCanvas.height);
      const blob = await canvasBlob(outputCanvas, format, quality);
      if (!mountedRef.current || outputRevision !== outputRevisionRef.current) return;
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
    } catch (exportError) {
      if (mountedRef.current && outputRevision === outputRevisionRef.current) {
        setError(exportError instanceof Error ? exportError.message : '图片导出失败。');
      }
    } finally {
      if (sourceCanvas) {
        sourceCanvas.width = 0;
        sourceCanvas.height = 0;
      }
      if (outputCanvas) {
        outputCanvas.width = 0;
        outputCanvas.height = 0;
      }
      if (activeExportRef.current === activeExport) {
        activeExportRef.current = null;
        if (mountedRef.current) setBusy(false);
      }
    }
  }

  function reset() {
    loadGenerationRef.current += 1;
    outputRevisionRef.current += 1;
    cancelPendingImageLoad();
    dragRef.current = null;
    setFile(null);
    setImage(null);
    setOutputUrl('');
    setOutputSize(0);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  }

  if (!image) {
    return (
      <div>
        <button
          type="button"
          className={`drop-zone image-drop-zone ${draggingFile ? 'is-dragging' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => { event.preventDefault(); setDraggingFile(true); }}
          onDragLeave={() => setDraggingFile(false)}
          onDrop={(event) => { event.preventDefault(); setDraggingFile(false); selectFile(event.dataTransfer.files); }}
        >
          <ImagePlus size={46} /><strong>拖入图片开始编辑</strong><span>支持 PNG、JPEG、WebP、GIF 等浏览器可读取格式</span>
        </button>
        <div className="image-start-actions">
          <span>想先熟悉操作？</span>
          <button className="secondary-button" type="button" onClick={() => void loadDemoImage()}>使用示例图片</button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={(event) => selectFile(event.target.files)} />
        {error && <div className="error-banner" role="alert">{error}</div>}
      </div>
    );
  }

  return (
    <div className="image-studio">
      <div className="image-stage-card">
        <div className="image-stage-toolbar">
          <span><strong>{file?.name}</strong><small>{image.naturalWidth} × {image.naturalHeight} · {formatFileSize(file?.size || 0)}</small></span>
          <div><button type="button" onClick={() => rotate(-90)} title="向左旋转"><RotateCcw /></button><button type="button" onClick={() => rotate(90)} title="向右旋转"><RotateCw /></button><button type="button" onClick={() => setFlipX((value) => !value)} className={flipX ? 'is-active' : ''} title="水平翻转" aria-label="水平翻转" aria-pressed={flipX}><FlipHorizontal2 /></button><button type="button" onClick={() => setFlipY((value) => !value)} className={flipY ? 'is-active' : ''} title="垂直翻转" aria-label="垂直翻转" aria-pressed={flipY}><FlipVertical2 /></button><button type="button" onClick={reset} title="移除图片" aria-label="移除图片"><Trash2 /></button></div>
        </div>
        <div className="image-stage-viewport">
          <div ref={stageRef} className="image-stage">
            <canvas ref={canvasRef} aria-label="图片编辑预览" />
            <div className="crop-shade crop-shade-top" style={{ height: `${crop.y * 100}%` }} />
            <div className="crop-shade crop-shade-left" style={{ top: `${crop.y * 100}%`, width: `${crop.x * 100}%`, height: `${crop.height * 100}%` }} />
            <div className="crop-shade crop-shade-right" style={{ top: `${crop.y * 100}%`, left: `${(crop.x + crop.width) * 100}%`, right: 0, height: `${crop.height * 100}%` }} />
            <div className="crop-shade crop-shade-bottom" style={{ top: `${(crop.y + crop.height) * 100}%`, bottom: 0 }} />
            <div className="crop-box" role="region" tabIndex={0} aria-label="裁剪区域。方向键移动，Alt 加方向键调整大小，按住 Shift 可加速。" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight Shift+ArrowUp Shift+ArrowDown Shift+ArrowLeft Shift+ArrowRight" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }} onPointerDown={(event) => startCropDrag(event, 'move')} onKeyDown={adjustCropWithKeyboard}>
              <span className="crop-grid horizontal one" /><span className="crop-grid horizontal two" /><span className="crop-grid vertical one" /><span className="crop-grid vertical two" />
              <span className="crop-handle" onPointerDown={(event) => startCropDrag(event, 'resize')} aria-hidden="true" />
            </div>
          </div>
        </div>
        <div className="zoom-control"><Scan size={17} /><span>缩放</span><input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="图片预览缩放比例" aria-valuetext={`${Math.round(zoom * 100)}%`} /><b>{Math.round(zoom * 100)}%</b></div>
      </div>

      <aside className="image-controls">
        <section><h3>输出尺寸</h3><div className="dimension-row"><label>宽度<input type="number" min={minOutputDimension} max={maxOutputDimension} step="1" value={widthInput} aria-invalid={!widthValid || (heightValid && !pixelCountValid)} onChange={(event) => updateWidthInput(event.target.value)} onBlur={() => changeWidth(Number(widthInput))} /></label><button type="button" className={lockAspect ? 'is-active' : ''} onClick={() => setLockAspect((value) => !value)} title={lockAspect ? "解锁比例" : "锁定比例"} aria-label="锁定宽高比例" aria-pressed={lockAspect}>{lockAspect ? <Link size={16} /> : <Unlink size={16} />}</button><label>高度<input type="number" min={minOutputDimension} max={maxOutputDimension} step="1" value={heightInput} aria-invalid={!heightValid || (widthValid && !pixelCountValid)} onChange={(event) => updateHeightInput(event.target.value)} onBlur={() => changeHeight(Number(heightInput))} /></label></div><p className="image-keyboard-hint">单边不超过 12000，总像素不超过 3200 万。方向键移动裁剪框，Alt + 方向键调整大小，Shift 加速。</p><button className="text-button" type="button" onClick={() => { setCrop(fullCrop); setOutputDimensions(constrainOutputDimensions(rotated.width, rotated.height)); }}>恢复完整画面</button></section>
        <section><h3>格式与质量</h3><label>输出格式<select value={format} onChange={(event) => setFormat(event.target.value as OutputFormat)}><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></label>{format !== 'image/png' && <label>质量：{Math.round(quality * 100)}%<input type="range" min="0.1" max="1" step="0.01" value={quality} onChange={(event) => setQuality(Number(event.target.value))} /></label>}<p>通过画布重新编码会清除 EXIF、定位和相机元数据。</p></section>
        <button className="primary-button export-button" type="button" onClick={() => void exportImage()} disabled={busy || !dimensionsValid} title={!dimensionsValid ? `宽高必须是 ${minOutputDimension}–${maxOutputDimension} 之间的整数，且总像素不超过 3200 万` : undefined}><Download size={18} /> {busy ? '正在导出…' : '生成预览'}</button>
        {outputUrl && <section className="output-preview" role="status" aria-live="polite" aria-atomic="true" aria-label="图片导出结果"><img src={outputUrl} alt="处理后的图片预览" /><div><span>{targetWidth} × {targetHeight}</span><b>{formatFileSize(outputSize)}</b></div><a className="primary-button" href={outputUrl} download={`edited.${format.split('/')[1] === 'jpeg' ? 'jpg' : format.split('/')[1]}`}><Download size={17} /> 下载图片</a></section>}
        {error && <div className="error-banner" role="alert">{error}</div>}
      </aside>
    </div>
  );
}

function drawTransformed(canvas: HTMLCanvasElement, image: HTMLImageElement, rotation: number, flipX: boolean, flipY: boolean, zoom: number, scale: number, contextRequired = false) {
  const context = canvas.getContext('2d');
  if (!context) {
    if (contextRequired) throw new Error('浏览器无法创建源图片画布。');
    return;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  context.rotate((rotation * Math.PI) / 180);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  const width = image.naturalWidth * scale * zoom;
  const height = image.naturalHeight * scale * zoom;
  context.drawImage(image, -width / 2, -height / 2, width, height);
  context.restore();
}

function canvasBlob(canvas: HTMLCanvasElement, format: OutputFormat, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('浏览器不支持所选输出格式。')), format, quality));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function createDemoImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 800;
  const context = canvas.getContext('2d')!;
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#087d5d');
  gradient.addColorStop(0.55, '#16a37c');
  gradient.addColorStop(1, '#93dfbd');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(255,255,255,.13)';
  context.beginPath();
  context.arc(1040, 80, 310, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#ffffff';
  context.font = '700 72px system-ui, sans-serif';
  context.fillText('Personal Toolbox', 90, 350);
  context.font = '400 30px system-ui, sans-serif';
  context.fillStyle = 'rgba(255,255,255,.82)';
  context.fillText('拖动裁剪框 · 旋转 · 缩放 · 转换格式', 94, 410);
  return new Promise<File>((resolve, reject) => canvas.toBlob((blob) => blob
    ? resolve(new File([blob], 'toolbox-demo.png', { type: 'image/png' }))
    : reject(new Error('无法生成示例图片。')), 'image/png'));
}
