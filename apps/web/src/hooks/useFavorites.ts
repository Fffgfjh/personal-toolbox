import { useCallback, useEffect, useState } from 'react';

const storageKey = 'personal-toolbox:favorites';
const changeEvent = 'personal-toolbox:favorites-change';

function readFavorites() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(readFavorites);

  useEffect(() => {
    const update = () => setFavorites(readFavorites());
    window.addEventListener(changeEvent, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(changeEvent, update);
      window.removeEventListener('storage', update);
    };
  }, []);

  const toggleFavorite = useCallback((toolId: string) => {
    const current = readFavorites();
    const next = current.includes(toolId) ? current.filter((id) => id !== toolId) : [...current, toolId];
    localStorage.setItem(storageKey, JSON.stringify(next));
    window.dispatchEvent(new Event(changeEvent));
  }, []);

  return { favorites, toggleFavorite };
}
