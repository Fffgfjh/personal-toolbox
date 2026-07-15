import { useEffect, useMemo, useState } from 'react';
import { Github, Info, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { projectConfig } from '../../config/project';
import { toolCatalog, toolCategories } from '../../tools/registry';

function initialDarkMode() {
  const stored = localStorage.getItem('personal-toolbox:theme');
  return stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(initialDarkMode);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    localStorage.setItem('personal-toolbox:theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => setSidebarOpen(false), [location.pathname]);

  const categoryCounts = useMemo(() => Object.fromEntries(
    toolCategories.map((category) => [category.id, toolCatalog.filter((tool) => tool.category === category.id).length]),
  ), []);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    navigate(search.trim() ? `/?q=${encodeURIComponent(search.trim())}` : '/');
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`} aria-label="工具分类">
        <div className="brand-panel">
          <Link to="/" className="brand-mark" aria-label={`${projectConfig.name}首页`}>
            <span className="brand-symbol">Y</span>
            <span><strong>{projectConfig.shortName}</strong><small>{projectConfig.description}</small></span>
          </Link>
          <button className="mobile-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="关闭菜单"><X /></button>
        </div>

        <nav className="category-nav">
          <NavLink to="/" end><span>全部工具</span><b>{toolCatalog.length}</b></NavLink>
          {toolCategories.map((category) => (
            <NavLink key={category.id} to={`/?category=${category.id}`}>
              <span>{category.name}</span><b>{categoryCounts[category.id]}</b>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link to="/about"><Info size={16} /> 关于项目</Link>
          <span>前后端分离 · 本地优先</span>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-backdrop" type="button" aria-label="关闭菜单" onClick={() => setSidebarOpen(false)} />}

      <div className="app-main">
        <header className="topbar">
          <button className="icon-button menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label="打开菜单"><Menu /></button>
          <form className="global-search" onSubmit={submitSearch} role="search">
            <Search size={18} aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索工具、格式或用途…" aria-label="搜索工具" />
            <button type="submit" className="search-submit">搜索</button>
          </form>
          <div className="topbar-actions">
            {projectConfig.repositoryUrl && (
              <a className="icon-button" href={projectConfig.repositoryUrl} target="_blank" rel="noreferrer" aria-label="GitHub 仓库"><Github /></a>
            )}
            <button className="icon-button" type="button" onClick={() => setDarkMode((value) => !value)} aria-label={darkMode ? '切换浅色主题' : '切换深色主题'}>
              {darkMode ? <Sun /> : <Moon />}
            </button>
          </div>
        </header>

        <main className="page-container"><Outlet /></main>
      </div>
    </div>
  );
}
