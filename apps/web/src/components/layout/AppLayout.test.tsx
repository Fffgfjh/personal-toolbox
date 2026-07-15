import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLayout } from './AppLayout';

const mobileSidebarMedia = '(max-width: 900px)';

function mockViewport(mobile: boolean) {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: query === mobileSidebarMedia ? mobile : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<div>首页内容</div>} />
          <Route path="about" element={<div>关于页内容</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => localStorage.clear());

describe('AppLayout mobile sidebar', () => {
  it('removes the closed mobile sidebar and its links from interaction', () => {
    mockViewport(true);
    renderLayout();

    const menuButton = screen.getByRole('button', { name: '打开菜单' });
    const sidebar = document.getElementById('tool-sidebar');
    const sidebarLink = sidebar?.querySelector('a');

    expect(menuButton).toHaveAttribute('aria-controls', 'tool-sidebar');
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(sidebar).toHaveAttribute('aria-hidden', 'true');
    expect(sidebar).toHaveAttribute('inert');
    expect(sidebarLink?.closest('[inert]')).toBe(sidebar);
  });

  it('exposes the sidebar and moves focus to its close button when opened', async () => {
    mockViewport(true);
    renderLayout();

    const menuButton = screen.getByRole('button', { name: '打开菜单' });
    const sidebar = document.getElementById('tool-sidebar')!;
    fireEvent.click(menuButton);

    const closeButton = within(sidebar).getByRole('button', { name: '关闭菜单' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(sidebar).not.toHaveAttribute('aria-hidden');
    expect(sidebar).not.toHaveAttribute('inert');
    await waitFor(() => expect(closeButton).toHaveFocus());
  });

  it('closes on Escape and restores focus to the menu button', async () => {
    mockViewport(true);
    renderLayout();

    const menuButton = screen.getByRole('button', { name: '打开菜单' });
    const sidebar = document.getElementById('tool-sidebar')!;
    fireEvent.click(menuButton);
    await waitFor(() => expect(within(sidebar).getByRole('button', { name: '关闭菜单' })).toHaveFocus());

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(sidebar).toHaveAttribute('aria-hidden', 'true');
    expect(sidebar).toHaveAttribute('inert');
    await waitFor(() => expect(menuButton).toHaveFocus());
  });

  it('closes after navigation, keeps drawer semantics in sync, and focuses the new content', async () => {
    mockViewport(true);
    renderLayout();

    const menuButton = screen.getByRole('button', { name: '打开菜单' });
    const sidebar = document.getElementById('tool-sidebar')!;
    fireEvent.click(menuButton);
    fireEvent.click(within(sidebar).getByRole('link', { name: '关于项目' }));

    expect(await screen.findByText('关于页内容')).toBeInTheDocument();
    await waitFor(() => {
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');
      expect(sidebar).toHaveAttribute('aria-hidden', 'true');
      expect(sidebar).toHaveAttribute('inert');
      expect(screen.getByRole('main')).toHaveFocus();
    });
  });

  it('keeps the desktop sidebar available when the drawer state is closed', () => {
    mockViewport(false);
    renderLayout();

    const sidebar = document.getElementById('tool-sidebar');
    expect(sidebar).not.toHaveAttribute('aria-hidden');
    expect(sidebar).not.toHaveAttribute('inert');
  });
});
