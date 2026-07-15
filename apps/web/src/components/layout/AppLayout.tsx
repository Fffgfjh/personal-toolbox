import { useEffect, useRef, useState } from 'react';
import { Github, Info, Menu, Moon, Search, Sun, X, ChevronRight } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { projectConfig } from '../../config/project';
import { findTool, toolCatalog, toolCategories } from '../../tools/registry';
import { CommandPalette } from '../CommandPalette';

const mobileSidebarMedia = '(max-width: 900px)';

function initialDarkMode() {
  const stored = localStorage.getItem('personal-toolbox:theme');
  return stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function initialMobileSidebar() {
  return window.matchMedia(mobileSidebarMedia).matches;
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(initialDarkMode);
  const [commandOpen, setCommandOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [mobileSidebar, setMobileSidebar] = useState(initialMobileSidebar);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const locationKey = `${location.pathname}${location.search}`;
  const previousLocationRef = useRef(locationKey);
  const sidebarHidden = mobileSidebar && !sidebarOpen;

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    localStorage.setItem('personal-toolbox:theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(mobileSidebarMedia);
    const handleMediaChange = (event: MediaQueryListEvent) => {
      setMobileSidebar(event.matches);
      if (!event.matches) setSidebarOpen(false);
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, []);

  useEffect(() => {
    if (previousLocationRef.current === locationKey) return;
    previousLocationRef.current = locationKey;
    setSidebarOpen(false);
    const focusTimer = window.setTimeout(() => mainRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [locationKey]);

  useEffect(() => {
    const activeTool = location.pathname.startsWith('/tools/')
      ? findTool(location.pathname.slice('/tools/'.length))
      : undefined;
    if (!activeTool) return;
    setExpandedCategories((current) => (
      current.includes(activeTool.category) ? current : [...current, activeTool.category]
    ));
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (mobileSidebar && sidebarOpen) closeButtonRef.current?.focus();
  }, [mobileSidebar, sidebarOpen]);

  useEffect(() => {
    if (!mobileSidebar || !sidebarOpen) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setSidebarOpen(false);
      menuButtonRef.current?.focus();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [mobileSidebar, sidebarOpen]);

  const closeSidebar = () => {
    setSidebarOpen(false);
    if (mobileSidebar) menuButtonRef.current?.focus();
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  };

  return (
    <div className="app-shell">
      <aside
        id="tool-sidebar"
        className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}
        aria-label="工具分类"
        aria-hidden={sidebarHidden || undefined}
        inert={sidebarHidden || undefined}
      >
        <div className="brand-panel">
          <Link to="/" className="brand-mark" aria-label={`${projectConfig.name}首页`}>
            <span className="brand-symbol">Y</span>
            <span><strong>{projectConfig.shortName}</strong><small>{projectConfig.description}</small></span>
          </Link>
          <button ref={closeButtonRef} className="mobile-close" type="button" onClick={closeSidebar} aria-label="关闭菜单"><X /></button>
        </div>

        <nav className="category-nav">
          <Link to="/" className={`all-tools-link ${location.pathname === '/' && !location.search ? 'active' : ''}`}><span>全部工具</span><b>{toolCatalog.length}</b></Link>
          {toolCategories.map((category) => {
            const isExpanded = expandedCategories.includes(category.id);
            const tools = toolCatalog.filter((tool) => tool.category === category.id);
            const isActive = new URLSearchParams(location.search).get('category') === category.id;
            return (
              <div key={category.id} className="category-group">
                <Link
                  to={`/?category=${category.id}`}
                  className={`category-header ${isExpanded ? 'is-expanded' : ''} ${isActive ? 'is-active' : ''}`}
                  onClick={() => toggleCategory(category.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`category-${category.id}`}
                >
                  <span className="category-title">{category.name}</span>
                  <span className="category-meta">
                    <b>{tools.length}</b>
                    <ChevronRight size={14} className="expand-icon" />
                  </span>
                </Link>
                <div
                  id={`category-${category.id}`}
                  className="category-content"
                  aria-hidden={!isExpanded}
                  inert={!isExpanded}
                >
                  <div className="category-content-inner">
                    {tools.map((tool) => (
                      <NavLink key={tool.id} to={`/tools/${tool.id}`} className="tool-link">
                        <tool.icon size={14} /> <span>{tool.name}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <Link to="/about"><Info size={16} /> 关于项目</Link>
          <span>前后端分离 · 本地优先</span>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-backdrop" type="button" aria-label="关闭菜单" onClick={closeSidebar} />}

      <div className="app-main">
        <header className="topbar">
          <button
            ref={menuButtonRef}
            className="icon-button menu-button"
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="打开菜单"
            aria-controls="tool-sidebar"
            aria-expanded={sidebarOpen}
          >
            <Menu />
          </button>
          <button className="global-search-trigger" type="button" onClick={() => setCommandOpen(true)} aria-label="全局搜索">
            <Search size={16} aria-hidden="true" />
            <span className="search-placeholder">搜索工具、格式或用途…</span>
            <div className="search-kbd-hint" aria-hidden="true"><kbd>Ctrl/⌘</kbd><kbd>K</kbd></div>
          </button>
          <div className="topbar-actions">
            {projectConfig.repositoryUrl && (
              <a className="icon-button" href={projectConfig.repositoryUrl} target="_blank" rel="noreferrer" aria-label="GitHub 仓库"><Github /></a>
            )}
            <button className="icon-button" type="button" onClick={() => setDarkMode((value) => !value)} aria-label={darkMode ? '切换浅色主题' : '切换深色主题'}>
              {darkMode ? <Sun /> : <Moon />}
            </button>
          </div>
        </header>

        <main ref={mainRef} className="page-container" tabIndex={-1}><Outlet /></main>
      </div>

      <CommandPalette isOpen={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}
