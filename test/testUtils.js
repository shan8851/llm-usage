import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));

export const projectRoot = path.resolve(testDir, '..');

export const fixturePaths = {
  claude: path.join(testDir, 'fixtures', 'claude'),
  codex: path.join(testDir, 'fixtures', 'codex'),
};

const createConfigToml = ({ openrouterEnabled = true } = {}) =>
  [
    '[paths]',
    `claude = [${JSON.stringify(fixturePaths.claude)}]`,
    `codex = [${JSON.stringify(fixturePaths.codex)}]`,
    '',
    '[openrouter]',
    `enabled = ${openrouterEnabled}`,
    'baseUrl = "https://openrouter.ai/api/v1"',
    'apiKeyEnv = "OPENROUTER_API_KEY"',
    '',
  ].join('\n');

export const writeFixtureConfig = async (options) => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'llm-usage-test-'));
  const configPath = path.join(tmpDir, 'config.toml');

  await writeFile(configPath, createConfigToml(options), 'utf8');

  return configPath;
};

export const runCli = (args, env = {}) =>
  spawnSync(process.execPath, ['./bin/llm-usage.js', ...args], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENROUTER_API_KEY: '',
      ...env,
    },
    encoding: 'utf8',
  });
