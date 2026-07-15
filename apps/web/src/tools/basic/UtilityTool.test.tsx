import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UtilityTool } from './UtilityTool';

const { bcryptHash } = vi.hoisted(() => ({
  bcryptHash: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  hash: bcryptHash,
}));

beforeEach(() => {
  bcryptHash.mockReset().mockResolvedValue('$2b$mocked-safe-hash');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('UtilityTool Bcrypt round validation', () => {
  it.each(['', '3', '15', '31', '10.5'])(
    'rejects invalid round value %j without invoking Bcrypt',
    (rounds) => {
      render(<UtilityTool kind="bcrypt" />);

      const roundsInput = screen.getByRole('spinbutton', { name: '计算轮数' });
      const calculateButton = screen.getByRole('button', { name: '计算' });
      fireEvent.change(roundsInput, { target: { value: rounds } });

      expect(roundsInput).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent('Bcrypt 计算轮数必须是 4 到 14 之间的整数。');
      expect(calculateButton).toBeDisabled();

      fireEvent.click(calculateButton);
      expect(bcryptHash).not.toHaveBeenCalled();
    },
  );

  it.each(['4', '14'])('accepts boundary round value %s using the mocked Bcrypt implementation', async (rounds) => {
    render(<UtilityTool kind="bcrypt" />);

    fireEvent.change(screen.getByRole('spinbutton', { name: '计算轮数' }), { target: { value: rounds } });
    const calculateButton = screen.getByRole('button', { name: '计算' });
    expect(calculateButton).toBeEnabled();
    fireEvent.click(calculateButton);

    await waitFor(() => expect(bcryptHash).toHaveBeenCalledWith('change-me', Number(rounds)));
    expect(screen.getByPlaceholderText('处理结果会显示在这里')).toHaveValue('$2b$mocked-safe-hash');
  });

  it('keeps a delayed Bcrypt calculation single-flight and locks its inputs', async () => {
    const pendingHash = deferred<string>();
    bcryptHash.mockReturnValueOnce(pendingHash.promise);
    render(<UtilityTool kind="bcrypt" />);

    const input = screen.getByRole('textbox', { name: '输入' });
    const roundsInput = screen.getByRole('spinbutton', { name: '计算轮数' });
    const clearButton = screen.getByRole('button', { name: '清空' });
    const calculateButton = screen.getByRole('button', { name: '计算' });

    fireEvent.click(calculateButton);
    await waitFor(() => expect(bcryptHash).toHaveBeenCalledOnce());

    expect(input).toBeDisabled();
    expect(roundsInput).toBeDisabled();
    expect(clearButton).toBeDisabled();
    expect(calculateButton).toBeDisabled();

    fireEvent.click(clearButton);
    fireEvent.click(calculateButton);
    expect(input).toHaveValue('change-me');
    expect(bcryptHash).toHaveBeenCalledOnce();

    await act(async () => {
      pendingHash.resolve('$2b$delayed-safe-hash');
      await pendingHash.promise;
    });

    expect(screen.getByPlaceholderText('处理结果会显示在这里')).toHaveValue('$2b$delayed-safe-hash');
    expect(input).toBeEnabled();
    expect(roundsInput).toBeEnabled();
    expect(clearButton).toBeEnabled();
  });

  it('ignores a delayed Bcrypt result after unmount without React warnings', async () => {
    const pendingHash = deferred<string>();
    bcryptHash.mockReturnValueOnce(pendingHash.promise);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { unmount } = render(<UtilityTool kind="bcrypt" />);

    fireEvent.click(screen.getByRole('button', { name: '计算' }));
    await waitFor(() => expect(bcryptHash).toHaveBeenCalledOnce());
    unmount();

    await act(async () => {
      pendingHash.resolve('$2b$late-unmounted-hash');
      await pendingHash.promise;
    });

    expect(screen.queryByDisplayValue('$2b$late-unmounted-hash')).not.toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
