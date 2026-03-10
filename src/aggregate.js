import { sortRows } from './utils.js';

export function aggregateRecords(records, { providerFilter, modelFilter, sortBy, maxRows }) {
  const map = new Map();

  const providerAllow = providerFilter
    ? new Set(providerFilter.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean))
    : null;

  const modelNeedle = modelFilter?.trim().toLowerCase() || null;

  for (const r of records) {
    const provider = String(r.provider || 'unknown').toLowerCase();
    const model = String(r.model || 'unknown');

    if (providerAllow && !providerAllow.has(provider)) continue;
    if (modelNeedle && !model.toLowerCase().includes(modelNeedle)) continue;

    const key = `${provider}|||${model}`;
    if (!map.has(key)) {
      map.set(key, {
        provider,
        model,
        sessionsSet: new Set(),
        sessions: 0,
        turns: 0,
        tokens_in: 0,
        tokens_out: 0,
        cached_tokens: 0,
        reasoning_tokens: 0,
        last_seen: null,
      });
    }

    const row = map.get(key);
    row.sessionsSet.add(r.sessionId);
    row.turns += Number(r.turns || 0);
    row.tokens_in += Number(r.tokens_in || 0);
    row.tokens_out += Number(r.tokens_out || 0);
    row.cached_tokens += Number(r.cached_tokens || 0);
    row.reasoning_tokens += Number(r.reasoning_tokens || 0);

    const ts = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
    if (!Number.isNaN(ts.getTime()) && (!row.last_seen || ts > row.last_seen)) {
      row.last_seen = ts;
    }
  }

  const rows = [...map.values()].map((r) => ({
    ...r,
    sessions: r.sessionsSet.size,
    session_ids: [...r.sessionsSet],
    sessionsSet: undefined,
  }));

  const sorted = sortRows(rows, sortBy);
  return typeof maxRows === 'number' && maxRows > 0 ? sorted.slice(0, maxRows) : sorted;
}

export function providerTotals(rows) {
  const out = new Map();
  for (const r of rows) {
    if (!out.has(r.provider)) {
      out.set(r.provider, {
        provider: r.provider,
        models: 0,
        sessions: 0,
        turns: 0,
        tokens_in: 0,
        tokens_out: 0,
        cached_tokens: 0,
        reasoning_tokens: 0,
        _sessionSet: new Set(),
      });
    }
    const t = out.get(r.provider);
    t.models += 1;
    for (const sid of r.session_ids || []) t._sessionSet.add(sid);
    t.turns += r.turns;
    t.tokens_in += r.tokens_in;
    t.tokens_out += r.tokens_out;
    t.cached_tokens += r.cached_tokens;
    t.reasoning_tokens += r.reasoning_tokens;
  }
  return [...out.values()]
    .map((t) => ({
      ...t,
      sessions: t._sessionSet.size,
      _sessionSet: undefined,
    }))
    .sort((a, b) => b.tokens_out - a.tokens_out);
}

export function summarizeRows(rows) {
  const sessionSet = new Set();

  const summary = {
    models: rows.length,
    sessions: 0,
    turns: 0,
    tokens_in: 0,
    tokens_out: 0,
    tokens_total: 0,
    cached_tokens: 0,
    reasoning_tokens: 0,
  };

  for (const row of rows) {
    for (const sid of row.session_ids || []) sessionSet.add(sid);
    summary.turns += Number(row.turns || 0);
    summary.tokens_in += Number(row.tokens_in || 0);
    summary.tokens_out += Number(row.tokens_out || 0);
    summary.cached_tokens += Number(row.cached_tokens || 0);
    summary.reasoning_tokens += Number(row.reasoning_tokens || 0);
  }

  summary.sessions = sessionSet.size;
  summary.tokens_total = summary.tokens_in + summary.tokens_out;

  return summary;
}
