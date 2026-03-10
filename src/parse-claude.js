import fs from 'node:fs';
import readline from 'node:readline';
import fg from 'fast-glob';
import path from 'node:path';
import { inRange, safeDate } from './utils.js';

function sessionIdFromFile(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  return `claude:${base}`;
}

export async function collectClaudeRows(paths, from, to) {
  const files = await fg(paths.map((p) => `${p.replace(/\\/g, '/')}/**/*.jsonl`), {
    onlyFiles: true,
    absolute: true,
    unique: true,
    suppressErrors: true,
  });

  const records = [];

  for (const file of files) {
    const sessionId = sessionIdFromFile(file);
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

      const message = obj?.message;
      const usage = message?.usage;
      if (!usage || typeof usage !== 'object') continue;

      const ts = safeDate(obj?.timestamp || message?.timestamp || obj?.created_at);
      if (!ts || !inRange(ts, from, to)) continue;

      records.push({
        provider: 'claude',
        model: message?.model || 'unknown',
        sessionId,
        timestamp: ts,
        turns: 1,
        tokens_in: Number(usage.input_tokens || 0),
        tokens_out: Number(usage.output_tokens || 0),
        cached_tokens: Number(usage.cache_creation_input_tokens || 0) + Number(usage.cache_read_input_tokens || 0),
        reasoning_tokens: 0,
      });
    }
  }

  return records;
}
