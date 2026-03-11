import fs from 'node:fs/promises';
import TOML from 'toml';
import { z } from 'zod';
import { expandHome } from './utils.js';

export const defaultConfig = {
  paths: {
    claude: ['~/.claude/projects', '~/.config/claude/projects'],
    codex: ['~/.codex/sessions'],
  },
  openrouter: {
    enabled: true,
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
  },
};

const stringArraySchema = z.array(z.string().min(1));

const configSchema = z.object({
  paths: z.object({
    claude: stringArraySchema,
    codex: stringArraySchema,
  }),
  openrouter: z.object({
    enabled: z.boolean(),
    baseUrl: z.string().min(1),
    apiKeyEnv: z.string().min(1),
  }),
});

const mergeConfig = (base, patch) => ({
  ...base,
  ...patch,
  paths: {
    ...base.paths,
    ...(patch.paths ?? {}),
  },
  openrouter: {
    ...base.openrouter,
    ...(patch.openrouter ?? {}),
  },
});

const formatConfigPath = (issuePath) => (issuePath.length ? issuePath.join('.') : 'config');

const formatConfigError = (configPath, issues) =>
  [
    `Invalid config at ${configPath}:`,
    ...issues.map(({ path, message }) => `- ${formatConfigPath(path)}: ${message}`),
  ].join('\n');

const renderTomlArray = (values) => `[${values.map((value) => JSON.stringify(value)).join(', ')}]`;

export async function loadConfig(configPath) {
  const resolved = expandHome(configPath || '~/.config/llm-usage/config.toml');

  let parsed = {};
  try {
    const raw = await fs.readFile(resolved, 'utf8');
    try {
      parsed = TOML.parse(raw);
    } catch (err) {
      throw new Error(`Invalid TOML in ${resolved}: ${err.message}`);
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      parsed = {};
    } else {
      throw err;
    }
  }

  const validation = configSchema.safeParse(mergeConfig(defaultConfig, parsed));
  if (!validation.success) {
    throw new Error(formatConfigError(resolved, validation.error.issues));
  }

  const cfg = validation.data;
  const openRouterApiKeyEnv = cfg.openrouter.apiKeyEnv;

  return {
    config: {
      ...cfg,
      paths: {
        claude: cfg.paths.claude.map(expandHome),
        codex: cfg.paths.codex.map(expandHome),
      },
      openrouter: {
        ...cfg.openrouter,
        apiKey: process.env[openRouterApiKeyEnv] ?? process.env.OPENROUTER_API_KEY ?? null,
      },
    },
    configPath: resolved,
  };
}

export function exampleConfigToml() {
  return [
    '# llm-usage config',
    '',
    '[paths]',
    `claude = ${renderTomlArray(defaultConfig.paths.claude)}`,
    `codex = ${renderTomlArray(defaultConfig.paths.codex)}`,
    '',
    '[openrouter]',
    `enabled = ${defaultConfig.openrouter.enabled}`,
    `baseUrl = ${JSON.stringify(defaultConfig.openrouter.baseUrl)}`,
    `apiKeyEnv = ${JSON.stringify(defaultConfig.openrouter.apiKeyEnv)}`,
    '',
  ].join('\n');
}
