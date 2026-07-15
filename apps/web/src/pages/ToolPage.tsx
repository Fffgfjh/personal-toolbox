import { Fragment, Suspense, useEffect } from 'react';
import { ArrowLeft, Heart, Server } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useFavorites } from '../hooks/useFavorites';
import { findTool } from '../tools/registry';
import { projectConfig } from '../config/project';

export function ToolPage() {
  const { toolId = '' } = useParams();
  const tool = findTool(toolId);
  const { favorites, toggleFavorite } = useFavorites();

  useEffect(() => {
    if (tool) document.title = `${tool.name} · ${projectConfig.name}`;
  }, [tool]);

  if (!tool) return <Navigate to="/404" replace />;
  const Icon = tool.icon;
  const favorite = favorites.includes(tool.id);

  return (
    <div className="tool-page">
      <Link className="back-link" to="/"><ArrowLeft size={16} /> 返回工具列表</Link>
      <header className="tool-header">
        <span className="tool-page-icon"><Icon /></span>
        <div><h1>{tool.name}</h1><p>{tool.description}</p></div>
        <button className={`favorite-tool-button ${favorite ? 'is-active' : ''}`} type="button" onClick={() => toggleFavorite(tool.id)}>
          <Heart size={18} fill={favorite ? 'currentColor' : 'none'} /> {favorite ? '已收藏' : '收藏'}
        </button>
      </header>
      {tool.serverSide && <div className="server-notice"><Server size={17} /><span>此工具通过独立后端处理文件；浏览器本地工具不会上传内容。</span></div>}
      <section className="tool-workspace">
        <Suspense fallback={
          <div className="skeleton-workspace">
            <div className="skeleton-block" style={{ height: 60, width: '100%' }}></div>
            <div className="skeleton-block" style={{ height: 300, width: '100%', marginTop: 24 }}></div>
          </div>
        }>
          <Fragment key={tool.id}>{tool.render()}</Fragment>
        </Suspense>
      </section>
    </div>
  );
}
