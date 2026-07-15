import { projectDefaults } from './defaults';

type Environment = Record<string, string | boolean | undefined>;

export interface ProjectConfig {
  name: string;
  shortName: string;
  description: string;
  repositoryUrl: string;
  issuesUrl: string;
  ownerName: string;
  ownerUrl: string;
  supportUrl: string;
  apiBaseUrl: string;
}

function readString(env: Environment, key: string, fallback: string) {
  const value = env[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function readOptionalString(env: Environment, key: string, fallback = '') {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : fallback;
}

function withoutTrailingSlash(value: string) {
  return value === '/' ? value : value.replace(/\/+$/, '');
}

export function createProjectConfig(env: Environment): ProjectConfig {
  const repositoryUrl = withoutTrailingSlash(readOptionalString(env, 'VITE_REPOSITORY_URL', projectDefaults.repositoryUrl));
  const apiBaseUrl = withoutTrailingSlash(readOptionalString(
    env,
    'VITE_API_BASE_URL',
    projectDefaults.apiBaseUrl,
  ));

  return {
    name: readString(env, 'VITE_APP_NAME', projectDefaults.name),
    shortName: readString(env, 'VITE_APP_SHORT_NAME', projectDefaults.shortName),
    description: readString(env, 'VITE_APP_DESCRIPTION', projectDefaults.description),
    repositoryUrl,
    issuesUrl: repositoryUrl ? `${repositoryUrl}/issues/new/choose` : '',
    ownerName: readOptionalString(env, 'VITE_OWNER_NAME', projectDefaults.ownerName),
    ownerUrl: readOptionalString(env, 'VITE_OWNER_URL', projectDefaults.ownerUrl),
    supportUrl: readOptionalString(env, 'VITE_SUPPORT_URL', projectDefaults.supportUrl),
    apiBaseUrl,
  };
}

export const projectConfig = createProjectConfig(import.meta.env);
