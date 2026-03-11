import assert from 'node:assert/strict';
import test from 'node:test';
import { exampleConfigToml } from '../src/config.js';
import { runCli, writeFixtureConfig } from './testUtils.js';

const from = '2026-03-10T00:00:00.000Z';
const to = '2026-03-11T00:00:00.000Z';

test('root help keeps the public surface lean', () => {
  const result = runCli(['--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /--metric <metric>/);
  assert.match(result.stdout, /--sort <field>/);
  assert.doesNotMatch(result.stdout, /--include-synthetic/);
  assert.doesNotMatch(result.stdout, /--max-rows/);
  assert.doesNotMatch(result.stdout, /--totals-only/);
  assert.doesNotMatch(result.stdout, /--no-openrouter/);
});

test('daily help only shows the options it actually supports', () => {
  const result = runCli(['daily', '--help']);

  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /--sort <field>/);
  assert.doesNotMatch(result.stdout, /--metric <metric>/);
});

test('print-config-example stays aligned with runtime defaults', () => {
  const result = runCli(['--print-config-example']);

  assert.equal(result.status, 0);
  assert.equal(result.stdout, `${exampleConfigToml()}\n`);
});

test('root json output hides synthetic rows and stays quiet about missing OpenRouter config', async () => {
  const configPath = await writeFixtureConfig();
  const result = runCli(['--config', configPath, '--from', from, '--to', to, '--json']);

  assert.equal(result.status, 0);

  const payload = JSON.parse(result.stdout);

  assert.deepEqual(payload.meta, {
    from,
    to,
    configPath,
    recordsParsed: 4,
    recordsUsed: 3,
    rowsFiltered: 2,
    syntheticRowsHidden: 1,
  });
  assert.equal(payload.summary.providers, 2);
  assert.equal(payload.summary.models, 2);
  assert.equal(payload.summary.sessions, 2);
  assert.equal(payload.summary.tokens_in, 230);
  assert.equal(payload.summary.tokens_out, 95);
  assert.equal(payload.summary.tokens_total, 325);
  assert.equal(payload.summary.cached_tokens, 50);
  assert.equal(payload.summary.reasoning_tokens, 10);
  assert.equal(payload.rows.length, 2);
  assert.equal(payload.providerTotals.length, 2);
  assert.equal(payload.openrouter, null);
});

test('metric value-only mode stays pipe-friendly', async () => {
  const configPath = await writeFixtureConfig();
  const result = runCli([
    '--config',
    configPath,
    '--from',
    from,
    '--to',
    to,
    '--metric',
    'tokens_total',
    '--value-only',
  ]);

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '325');
});

test('invalid sort values fail fast with a useful message', () => {
  const result = runCli(['--sort', 'not-a-real-sort']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must be one of/);
});

test('default text output does not mention hidden synthetic rows or missing OpenRouter config', async () => {
  const configPath = await writeFixtureConfig();
  const result = runCli(['--config', configPath, '--from', from, '--to', to]);

  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /synthetic/i);
  assert.doesNotMatch(result.stdout, /OpenRouter/);
});
