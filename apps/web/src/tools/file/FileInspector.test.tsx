import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMD5, createSHA256 } from 'hash-wasm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileInspector } from './FileInspector';

vi.mock('hash-wasm', () => ({ createMD5: vi.fn(), createSHA256: vi.fn() }));

const createMD5Mock = vi.mocked(createMD5);
const createSHA256Mock = vi.mocked(createSHA256);
type Hasher = Awaited<ReturnType<typeof createMD5>>;

describe('FileInspector analysis generations', () => {
  beforeEach(() => {
    createMD5Mock.mockReset();
    createSHA256Mock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('keeps the newer file busy and ignores a late result from the previous file', async () => {
    const firstMd5 = deferred<Hasher>();
    const secondMd5 = deferred<Hasher>();
    createMD5Mock
      .mockImplementationOnce(() => firstMd5.promise)
      .mockImplementationOnce(() => secondMd5.promise);
    createSHA256Mock.mockResolvedValue(hasher('second-sha256'));

    const { container } = render(<FileInspector mode="checksum" />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    choose(input, testFile('first.txt', [1, 2, 3]));
    await waitFor(() => expect(createMD5Mock).toHaveBeenCalledTimes(1));

    choose(input, testFile('second.txt', [4, 5, 6]));
    await waitFor(() => expect(createMD5Mock).toHaveBeenCalledTimes(2));
    expect(screen.getByText('second.txt')).toBeInTheDocument();

    await act(async () => firstMd5.resolve(hasher('first-md5')));
    expect(screen.getByText('正在分块计算摘要…')).toBeInTheDocument();
    expect(screen.queryByText('first-md5')).not.toBeInTheDocument();
    expect(createSHA256Mock).not.toHaveBeenCalled();

    await act(async () => secondMd5.resolve(hasher('second-md5')));
    expect(await screen.findByText('second-md5')).toBeInTheDocument();
    expect(screen.getByText('second-sha256')).toBeInTheDocument();
    expect(screen.queryByText('first.txt')).not.toBeInTheDocument();
    expect(screen.queryByText('正在分块计算摘要…')).not.toBeInTheDocument();
  });

  it('invalidates delayed work on reset and unmount', async () => {
    const resetMd5 = deferred<Hasher>();
    const unmountMd5 = deferred<Hasher>();
    createMD5Mock
      .mockImplementationOnce(() => resetMd5.promise)
      .mockImplementationOnce(() => unmountMd5.promise);
    createSHA256Mock.mockResolvedValue(hasher('unused-sha256'));

    const { container, unmount } = render(<FileInspector mode="checksum" />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    choose(input, testFile('reset-me.txt', [1]));
    await waitFor(() => expect(createMD5Mock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: '换一个文件' }));

    await act(async () => resetMd5.resolve(hasher('reset-md5')));
    expect(screen.getByRole('button', { name: /拖入任意文件/ })).toBeInTheDocument();
    expect(screen.queryByText('reset-md5')).not.toBeInTheDocument();
    expect(screen.queryByText('正在分块计算摘要…')).not.toBeInTheDocument();
    expect(createSHA256Mock).not.toHaveBeenCalled();

    choose(input, testFile('unmount-me.txt', [2]));
    await waitFor(() => expect(createMD5Mock).toHaveBeenCalledTimes(2));
    unmount();
    await act(async () => unmountMd5.resolve(hasher('unmount-md5')));
    expect(createSHA256Mock).not.toHaveBeenCalled();
  });

  it('reports analysis failures without leaving an unhandled busy state', async () => {
    createMD5Mock.mockRejectedValue(new Error('hash worker failed'));

    const { container } = render(<FileInspector mode="checksum" />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    choose(input, testFile('broken.txt', [1, 2, 3]));

    expect(await screen.findByRole('alert')).toHaveTextContent('文件分析失败，请重试或更换文件。');
    expect(screen.queryByText('正在分块计算摘要…')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '换一个文件' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

function hasher(digest: string) {
  return {
    digest: vi.fn(() => digest),
    update: vi.fn(),
  } as unknown as Hasher;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function testFile(name: string, bytes: number[]) {
  const data = Uint8Array.from(bytes);
  return {
    lastModified: 0,
    name,
    size: data.byteLength,
    type: 'text/plain',
    slice(start = 0, end = data.byteLength) {
      const chunk = data.slice(start, end);
      return {
        arrayBuffer: async () => chunk.buffer,
      } as Blob;
    },
  } as File;
}

function choose(input: HTMLInputElement, file: File) {
  fireEvent.change(input, { target: { files: [file] } });
}
