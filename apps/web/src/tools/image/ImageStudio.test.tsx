import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageStudio } from './ImageStudio';

const canvasContext = {
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  drawImage: vi.fn(),
  fill: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  rotate: vi.fn(),
  save: vi.fn(),
  scale: vi.fn(),
  translate: vi.fn(),
} as unknown as CanvasRenderingContext2D;

class MockImage {
  naturalWidth = 16000;
  naturalHeight = 8000;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

describe('ImageStudio accessible interactions', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', MockImage);
    vi.stubGlobal('PointerEvent', MouseEvent);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:image-studio-test'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => canvasContext);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['image-result'], { type: 'image/jpeg' }));
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('supports keyboard crop movement and exposes pressed states and a named zoom slider', async () => {
    const { container } = render(<ImageStudio mode="crop" />);
    await loadTestImage(container);

    const cropRegion = screen.getByRole('region', { name: /方向键移动.*Alt 加方向键调整大小.*Shift 可加速/ });
    const stage = container.querySelector<HTMLElement>('.image-stage');
    const resizeHandle = container.querySelector<HTMLElement>('.crop-handle');
    expect(stage).not.toBeNull();
    expect(resizeHandle).not.toBeNull();
    vi.spyOn(stage!, 'getBoundingClientRect').mockReturnValue({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(resizeHandle!, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 50, clientY: 50 });
    fireEvent.pointerUp(window);
    expect(parseFloat(cropRegion.style.width)).toBeCloseTo(50);

    fireEvent.keyDown(cropRegion, { key: 'ArrowLeft', altKey: true });
    expect(parseFloat(cropRegion.style.width)).toBeCloseTo(49);

    fireEvent.keyDown(cropRegion, { key: 'ArrowRight' });
    expect(parseFloat(cropRegion.style.left)).toBeCloseTo(1);
    fireEvent.keyDown(cropRegion, { key: 'ArrowRight', shiftKey: true });
    expect(parseFloat(cropRegion.style.left)).toBeCloseTo(6);

    const horizontalFlip = screen.getByRole('button', { name: '水平翻转' });
    expect(horizontalFlip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(horizontalFlip);
    expect(horizontalFlip).toHaveAttribute('aria-pressed', 'true');

    const aspectLock = screen.getByRole('button', { name: '锁定宽高比例' });
    expect(aspectLock).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('slider', { name: '图片预览缩放比例' })).toHaveAttribute('aria-valuetext', '100%');
  });

  it('clamps linked output dimensions and disables export while an input is invalid', async () => {
    const { container } = render(<ImageStudio mode="resize" />);
    await loadTestImage(container);

    const width = screen.getByRole('spinbutton', { name: '宽度' });
    const height = screen.getByRole('spinbutton', { name: '高度' });
    const exportButton = screen.getByRole('button', { name: /生成预览/ });
    expect(width).toHaveValue(8000);
    expect(height).toHaveValue(4000);
    expect(exportButton).toBeEnabled();

    fireEvent.change(width, { target: { value: '6000' } });
    expect(width).toHaveValue(6000);
    expect(height).toHaveValue(3000);

    fireEvent.change(width, { target: { value: '20000' } });
    expect(width).toHaveValue(20000);
    expect(width).toHaveAttribute('aria-invalid', 'true');
    expect(exportButton).toBeDisabled();
    fireEvent.blur(width);
    expect(width).toHaveValue(8000);
    expect(height).toHaveValue(4000);
    expect(exportButton).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '锁定宽高比例' }));
    fireEvent.change(width, { target: { value: '12000' } });
    fireEvent.change(height, { target: { value: '12000' } });
    expect(width).toHaveAttribute('aria-invalid', 'true');
    expect(height).toHaveAttribute('aria-invalid', 'true');
    expect(exportButton).toBeDisabled();

    fireEvent.change(height, { target: { value: '' } });
    expect(exportButton).toBeDisabled();
    expect(height).toHaveAttribute('aria-invalid', 'true');
  });

  it('announces export results and loading errors', async () => {
    const { container, unmount } = render(<ImageStudio mode="convert" />);
    await loadTestImage(container);
    fireEvent.click(screen.getByRole('button', { name: /生成预览/ }));
    expect(await screen.findByRole('status', { name: '图片导出结果' })).toHaveAttribute('aria-live', 'polite');
    fireEvent.change(screen.getByRole('spinbutton', { name: '宽度' }), { target: { value: '20000' } });
    await waitFor(() => expect(screen.queryByRole('status', { name: '图片导出结果' })).not.toBeInTheDocument());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:image-studio-test');

    unmount();
    const next = render(<ImageStudio mode="convert" />);
    const input = next.container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input!, {
      target: { files: [new File(['not-an-image'], 'notes.txt', { type: 'text/plain' })] },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('请选择浏览器支持的图片文件。');
  });

  it('discards an export that finishes after the image is replaced', async () => {
    const finishExports: BlobCallback[] = [];
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      finishExports.push(callback);
    });
    const { container } = render(<ImageStudio mode="convert" />);
    await loadTestImage(container);

    fireEvent.click(screen.getByRole('button', { name: /生成预览/ }));
    fireEvent.click(screen.getByRole('button', { name: '移除图片' }));
    await loadTestImage(container, 'replacement.png');
    const replacementExportButton = screen.getByRole('button', { name: /正在导出/ });
    expect(replacementExportButton).toBeDisabled();
    fireEvent.click(replacementExportButton);
    expect(toBlob).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishExports[0]?.(new Blob(['old-image-result'], { type: 'image/jpeg' }));
    });

    await waitFor(() => expect(screen.queryByRole('status', { name: '图片导出结果' })).not.toBeInTheDocument());
    await waitFor(() => expect(replacementExportButton).toBeEnabled());
    expect(screen.getByText('replacement.png')).toBeInTheDocument();
  });

  it('keeps export single-flight while changed parameters invalidate a delayed result', async () => {
    let finishExport: BlobCallback | undefined;
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      finishExport = callback;
    });
    const { container } = render(<ImageStudio mode="convert" />);
    await loadTestImage(container);

    const exportButton = screen.getByRole('button', { name: /生成预览/ });
    fireEvent.click(exportButton);
    expect(toBlob).toHaveBeenCalledTimes(1);
    expect(exportButton).toBeDisabled();

    fireEvent.change(screen.getByRole('slider', { name: /质量/ }), { target: { value: '0.8' } });
    expect(exportButton).toBeDisabled();
    fireEvent.click(exportButton);
    expect(toBlob).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishExport?.(new Blob(['stale-image-result'], { type: 'image/jpeg' }));
    });

    await waitFor(() => expect(exportButton).toBeEnabled());
    expect(screen.queryByRole('status', { name: '图片导出结果' })).not.toBeInTheDocument();
  });

  it('shows an export error when the source canvas context is unavailable', async () => {
    const { container } = render(<ImageStudio mode="convert" />);
    await loadTestImage(container);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementationOnce(() => null);
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');

    const exportButton = screen.getByRole('button', { name: /生成预览/ });
    fireEvent.click(exportButton);

    expect(screen.getByRole('alert')).toHaveTextContent('浏览器无法创建源图片画布。');
    expect(screen.queryByRole('status', { name: '图片导出结果' })).not.toBeInTheDocument();
    expect(toBlob).not.toHaveBeenCalled();
    expect(exportButton).toBeEnabled();
  });
});

async function loadTestImage(container: HTMLElement, filename = 'large.png') {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();
  fireEvent.change(input!, {
    target: { files: [new File(['image'], filename, { type: 'image/png' })] },
  });
  await waitFor(() => expect(screen.getByRole('region', { name: /裁剪区域/ })).toBeInTheDocument());
}
