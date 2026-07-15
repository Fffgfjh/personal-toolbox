import { ArrowUpRight, Heart, Server } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ToolDefinition } from '../tools/types';
import { useFavorites } from '../hooks/useFavorites';

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  const { favorites, toggleFavorite } = useFavorites();
  const favorite = favorites.includes(tool.id);
  const Icon = tool.icon;

  return (
    <article className="tool-card">
      <Link className="tool-card-link" to={`/tools/${tool.id}`} aria-label={`打开${tool.name}`}>
        <span className="tool-card-icon"><Icon aria-hidden="true" /></span>
        <span className="tool-card-copy">
          <span className="tool-card-title">
            {tool.name}
            {tool.serverSide && <Server size={14} aria-label="需要服务端" />}
          </span>
          <span className="tool-card-description">{tool.description}</span>
        </span>
        <ArrowUpRight className="tool-card-arrow" size={18} aria-hidden="true" />
      </Link>
      <button
        type="button"
        className={`favorite-button ${favorite ? 'is-active' : ''}`}
        onClick={() => toggleFavorite(tool.id)}
        aria-label={favorite ? `取消收藏${tool.name}` : `收藏${tool.name}`}
      >
        <Heart size={17} fill={favorite ? 'currentColor' : 'none'} />
      </button>
    </article>
  );
}
