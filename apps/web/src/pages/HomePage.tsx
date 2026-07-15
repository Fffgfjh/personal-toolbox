import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Heart, Layers3, ShieldCheck, Sparkles } from 'lucide-react';
import { ToolCard } from '../components/ToolCard';
import { useFavorites } from '../hooks/useFavorites';
import { toolCatalog, toolCategories } from '../tools/registry';
import type { ToolCategoryId } from '../tools/types';
import { projectConfig } from '../config/project';

export function HomePage() {
  const [params] = useSearchParams();
  const { favorites } = useFavorites();
  const query = (params.get('q') || '').trim().toLowerCase();
  const category = params.get('category') as ToolCategoryId | null;

  useEffect(() => {
    document.title = `${projectConfig.name} · ${projectConfig.description}`;
  }, []);

  const visibleTools = useMemo(() => toolCatalog.filter((tool) => {
    if (category && tool.category !== category) return false;
    if (!query) return true;
    const haystack = [tool.name, tool.description, ...tool.keywords].join(' ').toLowerCase();
    return haystack.includes(query);
  }), [category, query]);

  const selectedCategory = toolCategories.find((item) => item.id === category);
  const favoriteTools = toolCatalog.filter((tool) => favorites.includes(tool.id));

  return (
    <>
      <section className="hero-section">
        <div>
          <span className="eyebrow"><Sparkles size={15} /> 独立、可配置、隐私优先</span>
          <h1>{selectedCategory?.name || (query ? '搜索结果' : '把常用工具放在一个清楚的地方')}</h1>
          <p>{selectedCategory?.description || (query ? `与“${params.get('q')}”相关的工具` : '图片和文件尽量在浏览器本地处理，文档转换通过独立 API 安全接入。')}</p>
        </div>
        {!query && !category && (
          <div className="hero-facts" aria-label="项目特点">
            <span><Layers3 /><b>{toolCatalog.length}</b><small>个工具入口</small></span>
            <span><ShieldCheck /><b>本地优先</b><small>减少文件上传</small></span>
          </div>
        )}
      </section>

      {!query && !category && favoriteTools.length > 0 && (
        <ToolSection title="我的收藏" icon={<Heart size={18} />} tools={favoriteTools} />
      )}

      {visibleTools.length > 0 ? (
        selectedCategory || query
          ? <ToolSection title={selectedCategory?.name || '匹配工具'} tools={visibleTools} />
          : toolCategories.map((item) => {
            const tools = visibleTools.filter((tool) => tool.category === item.id);
            return tools.length ? <ToolSection key={item.id} title={item.name} description={item.description} tools={tools} /> : null;
          })
      ) : (
        <div className="empty-state"><SearchEmpty /><h2>没有找到匹配工具</h2><p>换一个关键词，或清除当前分类后再试。</p></div>
      )}
    </>
  );
}

function ToolSection({ title, description, icon, tools }: { title: string; description?: string; icon?: React.ReactNode; tools: typeof toolCatalog }) {
  return (
    <section className="tool-section">
      <div className="section-heading"><div><h2>{icon}{title}</h2>{description && <p>{description}</p>}</div><span>{tools.length}</span></div>
      <div className="tool-grid">{tools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div>
    </section>
  );
}

function SearchEmpty() {
  return <span className="empty-icon">?</span>;
}
