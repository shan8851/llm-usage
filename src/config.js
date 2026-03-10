import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import TOML from 'toml';
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

function mergeConfig(base, patch) {
  return {
    ...base,
    ...patch,
    paths: {
      ...base.paths,
      ...(patch.paths || {}),
    },
    openrouter: {
      ...base.openrouter,
      ...(patch.openrouter || {}),
    },
  };
}

export async function loadConfig(configPath) {
  const resolved = expandHome(configPath || '~/.config/llm-usage/config.toml');

  let parsed = {};
  try {
    const raw = await fs.readFile(resolved, 'utf8');
    parsed = TOML.parse(raw);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const cfg = mergeConfig(defaultConfig, parsed);

  cfg.paths.claude = (cfg.paths.claude || []).map(expandHome);
  cfg.paths.codex = (cfg.paths.codex || []).map(expandHome);
  cfg.openrouter.baseUrl = cfg.openrouter.baseUrl || defaultConfig.openrouter.baseUrl;
  cfg.openrouter.apiKey = process.env[cfg.openrouter.apiKeyEnv] || process.env.OPENROUTER_API_KEY || null;

  return {
    config: cfg,
    configPath: resolved,
  };
}

export function exampleConfigToml() {
  return `# llm-usage config\n\n[paths]\nclaude = [\"~/.claude/projects\", \"~/.config/claude/projects\"]\ncodex = [\"~/.codex/sessions\"]\n\n[openrouter]\nenabled = true\nbaseUrl = \"https://openrouter.ai/api/v1\"\napiKeyEnv = \"OPENROUTER_API_KEY\"\n`;
}
