import fs from 'node:fs';
import readline from 'node:readline';
import fg from 'fast-glob';
import path from 'node:path';
import { inRange, safeDate } from './utils.js';

function sessionIdFromFile(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  return `codex:${base}`;
}

function delta(current = {}, previous = null) {
  if (!previous) return { ...current };
  const keys = ['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens', 'total_tokens'];
  const out = {};
  for (const key of keys) {
    const c = Number(current?.[key] || 0);
    const p = Number(previous?.[key] || 0);
    out[key] = Math.max(0, c - p);
  }
  return out;
}

export async function collectCodexRows(paths, from, to) {
  const files = await fg(paths.map((p) => `${p.replace(/\\/g, '/')}/**/*.jsonl`), {
    onlyFiles: true,
    absolute: true,
    unique: true,
    suppressErrors: true,
  });

  const records = [];

  for (const file of files) {
    const sessionId = sessionIdFromFile(file);
    let currentModel = 'unknown';
    let previousTotals = null;

    const stream = fs.createReadStream(file, 'utf8');
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line?.trim()) continue;

      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }

      if (obj?.type === 'turn_context' && obj?.payload?.model) {
        currentModel = obj.payload.model;
      }

      if (obj?.type !== 'event_msg' || obj?.payload?.type !== 'token_count') {
        continue;
      }

      const ts = safeDate(obj?.timestamp);
      if (!ts || !inRange(ts, from, to)) {
        // still advance previous totals, as token_count is cumulative and we need continuity
        previousTotals = obj?.payload?.info?.total_token_usage || previousTotals;
        continue;
      }

      const totals = obj?.payload?.info?.total_token_usage;
      if (!totals || typeof totals !== 'object') continue;

      const d = delta(totals, previousTotals);
      previousTotals = totals;

      records.push({
        provider: 'codex',
        model: currentModel || 'unknown',
        sessionId,
        timestamp: ts,
        turns: 1,
        tokens_in: Number(d.input_tokens || 0),
        tokens_out: Number(d.output_tokens || 0),
        cached_tokens: Number(d.cached_input_tokens || 0),
        reasoning_tokens: Number(d.reasoning_output_tokens || 0),
      });
    }
  }

  return records;
}
