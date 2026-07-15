import { describe, expect, it } from 'vitest';
import { createProjectConfig } from './project';

describe('project configuration', () => {
  it('provides readable defaults without repository-specific links', () => {
    const config = createProjectConfig({});

    expect(config.name).toBe('个人工具箱');
    expect(config.repositoryUrl).toBe('');
    expect(config.issuesUrl).toBe('');
    expect(config.apiBaseUrl).toBe('/api');
  });

  it('normalizes environment overrides and derives the issue URL', () => {
    const config = createProjectConfig({
      VITE_APP_NAME: ' My Toolbox ',
      VITE_REPOSITORY_URL: 'https://github.com/example/toolbox/',
      VITE_API_BASE_URL: 'https://tools.example.com/api/',
      VITE_OWNER_NAME: 'Example Owner',
      VITE_OWNER_URL: 'https://example.com/owner',
      VITE_SUPPORT_URL: 'https://example.com/support',
    });

    expect(config.name).toBe('My Toolbox');
    expect(config.issuesUrl).toBe('https://github.com/example/toolbox/issues/new/choose');
    expect(config.apiBaseUrl).toBe('https://tools.example.com/api');
    expect(config.ownerName).toBe('Example Owner');
    expect(config.ownerUrl).toBe('https://example.com/owner');
    expect(config.supportUrl).toBe('https://example.com/support');
  });

  it('allows the document gateway to be disabled explicitly', () => {
    expect(createProjectConfig({ VITE_API_BASE_URL: '' }).apiBaseUrl).toBe('');
  });
});
