import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';

afterEach(() => cleanup());

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function PaletteHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>打开搜索</button>
      <CommandPalette isOpen={open} onClose={() => setOpen(false)} />
      <LocationProbe />
    </>
  );
}

function renderPalette() {
  return render(
    <MemoryRouter>
      <PaletteHarness />
    </MemoryRouter>,
  );
}

describe('CommandPalette', () => {
  it('exposes dialog and combobox semantics, then restores focus on Escape', async () => {
    renderPalette();
    const trigger = screen.getByRole('button', { name: '打开搜索' });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog', { name: '搜索工具' })).toBeInTheDocument();
    const input = screen.getByRole('combobox', { name: '搜索工具' });
    expect(input).toHaveAttribute('aria-controls', 'command-results');
    await waitFor(() => expect(input).toHaveFocus());

    const closeButton = screen.getByRole('button', { name: '关闭搜索' });
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(input).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: '搜索工具' })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('does not treat IME confirmation as navigation', async () => {
    renderPalette();
    fireEvent.click(screen.getByRole('button', { name: '打开搜索' }));
    const input = screen.getByRole('combobox', { name: '搜索工具' });
    await waitFor(() => expect(input).toHaveFocus());
    fireEvent.change(input, { target: { value: '合并' } });

    const activeOptionId = input.getAttribute('aria-activedescendant');
    expect(activeOptionId).toBeTruthy();
    expect(document.getElementById(activeOptionId!)).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(window, { key: 'Enter', isComposing: true });

    expect(screen.getByRole('dialog', { name: '搜索工具' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });

  it('moves the active option and opens it with the keyboard', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    renderPalette();
    fireEvent.click(screen.getByRole('button', { name: '打开搜索' }));
    const input = screen.getByRole('combobox', { name: '搜索工具' });
    await waitFor(() => expect(input).toHaveFocus());
    const firstOption = input.getAttribute('aria-activedescendant');

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).not.toBe(firstOption);
    expect(scrollIntoView).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(screen.getByTestId('location')).not.toHaveTextContent(/^\/$/);
    expect(screen.queryByRole('dialog', { name: '搜索工具' })).not.toBeInTheDocument();
  });
});
