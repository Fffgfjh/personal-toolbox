import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { documentToolCatalog } from '@personal-toolbox/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runDocumentTool } from '../../api/client';
import { DocumentTool } from './DocumentTool';

vi.mock('../../api/client', () => ({ runDocumentTool: vi.fn() }));

const runDocumentToolMock = vi.mocked(runDocumentTool);

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('DocumentTool result lifecycle', () => {
  beforeEach(() => {
    let resultNumber = 0;
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:document-result-${++resultNumber}`),
      revokeObjectURL: vi.fn(),
    });
    runDocumentToolMock.mockResolvedValue({
      blob: new Blob(['pdf-result'], { type: 'application/pdf' }),
      filename: 'result.pdf',
      contentType: 'application/pdf',
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('invalidates an old download when files or options change', async () => {
    const definition = documentToolCatalog.find((tool) => tool.id === 'image-to-pdf')!;
    const { container } = render(<DocumentTool definition={definition} />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const firstFile = new File(['first'], 'first.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [firstFile] } });

    fireEvent.click(screen.getByRole('button', { name: '开始处理' }));
    expect(await screen.findByRole('link', { name: '下载结果' })).toHaveAttribute('download', 'result.pdf');

    fireEvent.change(screen.getByRole('combobox', { name: '适应方式' }), { target: { value: 'fillPage' } });
    await waitFor(() => expect(screen.queryByRole('link', { name: '下载结果' })).not.toBeInTheDocument());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:document-result-1');

    fireEvent.click(screen.getByRole('button', { name: '开始处理' }));
    expect(await screen.findByRole('link', { name: '下载结果' })).toBeInTheDocument();
    const secondFile = new File(['second'], 'second.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [secondFile] } });
    await waitFor(() => expect(screen.queryByRole('link', { name: '下载结果' })).not.toBeInTheDocument());
    expect(screen.getByText('first.png')).toBeInTheDocument();
    expect(screen.getByText('second.png')).toBeInTheDocument();
  });

  it('replaces the selected file for single-file operations', () => {
    const definition = documentToolCatalog.find((tool) => tool.id === 'pdf-to-word')!;
    const { container } = render(<DocumentTool definition={definition} />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;

    fireEvent.change(input, { target: { files: [new File(['one'], 'one.pdf', { type: 'application/pdf' })] } });
    expect(screen.getByText('one.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /更换文件/ })).toBeInTheDocument();

    fireEvent.change(input, { target: { files: [new File(['two'], 'two.pdf', { type: 'application/pdf' })] } });
    expect(screen.queryByText('one.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('two.pdf')).toBeInTheDocument();
  });

  it('requires a password before enabling PDF protection', () => {
    const definition = documentToolCatalog.find((tool) => tool.id === 'pdf-protect')!;
    const { container } = render(<DocumentTool definition={definition} />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;

    fireEvent.change(input, { target: { files: [new File(['pdf'], 'private.pdf', { type: 'application/pdf' })] } });

    const runButton = screen.getByRole('button', { name: '开始处理' });
    expect(runButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('打开密码'), { target: { value: 'correct horse battery staple' } });
    expect(runButton).toBeEnabled();
  });

  it('ignores a delayed response after cancellation even when the request ignores AbortSignal', async () => {
    const pendingResponse = deferred<Awaited<ReturnType<typeof runDocumentTool>>>();
    runDocumentToolMock.mockImplementationOnce(() => pendingResponse.promise);
    const definition = documentToolCatalog.find((tool) => tool.id === 'pdf-to-word')!;
    const { container } = render(<DocumentTool definition={definition} />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;

    fireEvent.change(input, { target: { files: [new File(['pdf'], 'source.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: '开始处理' }));
    await waitFor(() => expect(runDocumentToolMock).toHaveBeenCalledOnce());

    const signal = runDocumentToolMock.mock.calls[0]![3];
    expect(signal.aborted).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '取消处理' }));
    expect(signal.aborted).toBe(true);

    await act(async () => {
      pendingResponse.resolve({
        blob: new Blob(['late-result'], { type: 'application/pdf' }),
        filename: 'late-result.pdf',
        contentType: 'application/pdf',
      });
      await pendingResponse.promise;
    });

    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(container.querySelector('.document-result')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '下载结果' })).not.toBeInTheDocument();
  });
});
