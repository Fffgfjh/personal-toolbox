import { useEffect, useRef, useState, useMemo } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toolCatalog } from '../tools/registry';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();

  const results = useMemo(() => {
    if (!query.trim()) return toolCatalog;
    const lowerQuery = query.trim().toLowerCase();
    return toolCatalog.filter(tool => {
      const haystack = [tool.name, tool.description, ...tool.keywords].join(' ').toLowerCase();
      return haystack.includes(lowerQuery);
    });
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    setQuery('');
    setSelectedIndex(0);
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const selectedTool = results[selectedIndex];
    if (!selectedTool) return;
    document.getElementById(`command-option-${selectedTool.id}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [isOpen, results, selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.isComposing) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        if (document.activeElement === inputRef.current) {
          closeButtonRef.current?.focus();
        } else {
          inputRef.current?.focus();
        }
      } else if (e.key === 'Escape') {
        onClose();
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        e.preventDefault();
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        navigate(`/tools/${results[selectedIndex].id}`);
        onClose();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, navigate, onClose]);

  if (!isOpen) return null;

  const selectedTool = results[selectedIndex];

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div
        className="command-palette-container animate-fade-in-scale"
        role="dialog"
        aria-modal="true"
        aria-label="搜索工具"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="command-palette-header">
          <Search size={20} className="command-search-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            className="command-input"
            placeholder="搜索工具、格式或用途..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            role="combobox"
            aria-label="搜索工具"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={selectedTool ? `command-option-${selectedTool.id}` : undefined}
          />
          <div className="command-hint" aria-hidden="true"><kbd>Esc</kbd> 关闭</div>
          <button
            ref={closeButtonRef}
            type="button"
            className="command-close-button"
            aria-label="关闭搜索"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="command-palette-body">
          {results.length > 0 ? (
            <ul id="command-results" className="command-results" role="listbox" aria-label="匹配工具">
              {results.map((tool, index) => {
                const Icon = tool.icon;
                return (
                  <li
                    key={tool.id}
                    id={`command-option-${tool.id}`}
                    className={`command-item ${index === selectedIndex ? 'is-selected' : ''}`}
                    role="option"
                    aria-selected={index === selectedIndex}
                    onClick={() => {
                      navigate(`/tools/${tool.id}`);
                      onClose();
                    }}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <Icon size={18} className="command-item-icon" aria-hidden="true" />
                    <div className="command-item-content">
                      <span className="command-item-title">{tool.name}</span>
                      <span className="command-item-desc">{tool.description}</span>
                    </div>
                    <ArrowRight size={16} className="command-item-action" aria-hidden="true" />
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="command-empty" role="status">未找到匹配的工具</div>
          )}
        </div>
      </div>
    </div>
  );
}
