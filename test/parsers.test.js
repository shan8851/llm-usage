import assert from 'node:assert/strict';
import test from 'node:test';
import { collectClaudeRows } from '../src/parse-claude.js';
import { collectCodexRows } from '../src/parse-codex.js';
import { fixturePaths } from './testUtils.js';

const from = new Date('2026-03-10T00:00:00.000Z');
const to = new Date('2026-03-11T00:00:00.000Z');

test('collectClaudeRows reads usage records from local JSONL logs', async () => {
  const rows = await collectClaudeRows([fixturePaths.claude], from, to);

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    provider: 'claude',
    model: 'claude-opus-4-1',
    sessionId: 'claude:exampleSession',
    timestamp: new Date('2026-03-10T10:00:00.000Z'),
    turns: 1,
    tokens_in: 120,
    tokens_out: 45,
    cached_tokens: 25,
    reasoning_tokens: 0,
  });
  assert.equal(rows[1].model, '<synthetic>');
});

test('collectCodexRows computes deltas across out-of-range cumulative totals', async () => {
  const rows = await collectCodexRows([fixturePaths.codex], from, to);

  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => ({
      provider: row.provider,
      model: row.model,
      sessionId: row.sessionId,
      timestamp: row.timestamp,
      turns: row.turns,
      tokens_in: row.tokens_in,
      tokens_out: row.tokens_out,
      cached_tokens: row.cached_tokens,
      reasoning_tokens: row.reasoning_tokens,
    })),
    [
      {
        provider: 'codex',
        model: 'gpt-5.4',
        sessionId: 'codex:exampleSession',
        timestamp: new Date('2026-03-10T11:00:00.000Z'),
        turns: 1,
        tokens_in: 50,
        tokens_out: 20,
        cached_tokens: 15,
        reasoning_tokens: 5,
      },
      {
        provider: 'codex',
        model: 'gpt-5.4',
        sessionId: 'codex:exampleSession',
        timestamp: new Date('2026-03-10T11:05:00.000Z'),
        turns: 1,
        tokens_in: 60,
        tokens_out: 30,
        cached_tokens: 10,
        reasoning_tokens: 5,
      },
    ],
  );
});
