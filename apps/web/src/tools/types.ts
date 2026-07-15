import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type ToolCategoryId = 'image' | 'file' | 'document' | 'developer' | 'text' | 'generator';

export interface ToolCategory {
  id: ToolCategoryId;
  name: string;
  description: string;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: ToolCategoryId;
  keywords: string[];
  icon: LucideIcon;
  featured?: boolean;
  serverSide?: boolean;
  render: () => ReactNode;
}
