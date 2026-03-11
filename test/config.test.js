import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadConfig } from '../src/config.js';

const writeTempConfig = async (contents) => {
  const dirPath = await mkdtemp(path.join(os.tmpdir(), 'llm-usage-config-'));
  const configPath = path.join(dirPath, 'config.toml');

  await writeFile(configPath, contents, 'utf8');

  return configPath;
};

test('loadConfig reports invalid field types clearly', async () => {
  const configPath = await writeTempConfig('[paths]\nclaude = "not-an-array"\n');

  await assert.rejects(
    loadConfig(configPath),
    /paths\.claude: Invalid input: expected array, received string/,
  );
});

test('loadConfig reports invalid TOML clearly', async () => {
  const configPath = await writeTempConfig('[paths\nclaude = ["oops"]\n');

  await assert.rejects(loadConfig(configPath), /Invalid TOML in .*Expected/);
});
