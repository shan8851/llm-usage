import chalk from 'chalk';
import Table from 'cli-table3';
import { formatCompact, formatNumber } from './utils.js';

const openRouterModelBreakdownNote = 'model/token breakdown not available from public key/credits endpoints';

function colourProvider(provider) {
  if (provider === 'claude') return chalk.hex('#D97706')(provider);
  if (provider === 'codex') return chalk.hex('#2563EB')(provider);
  if (provider === 'openrouter') return chalk.hex('#059669')(provider);
  return provider;
}

function coerceFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function formatLooseValue(value) {
  const numeric = coerceFiniteNumber(value);
  if (numeric == null) return String(value);

  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: Number.isInteger(numeric) ? 0 : 6,
  }).format(numeric);
}

function unwrapResponseLayers(value) {
  const layers = [];
  const seen = new Set();
  let current = value;

  while (current && typeof current === 'object' && !Array.isArray(current) && !seen.has(current)) {
    layers.push(current);
    seen.add(current);
    current = current.data;
  }

  return layers;
}

function readPathValue(value, path) {
  return path.reduce(
    (acc, key) => (acc && typeof acc === 'object' && key in acc ? acc[key] : undefined),
    value,
  );
}

function pickResponseValue(value, paths) {
  const layers = unwrapResponseLayers(value);

  for (const layer of layers) {
    for (const path of paths) {
      const candidate = readPathValue(layer, path);
      if (candidate != null) return candidate;
    }
  }

  return null;
}

function humanModel(model) {
  if (!model) return 'unknown';
  if (model === '<synthetic>') return 'synthetic (system)';

  const m = /^(.*)-(\d{4})(\d{2})(\d{2})$/.exec(model);
  if (!m) return model;

  const [, base, y, mo, d] = m;
  return `${base} (${y}-${mo}-${d})`;
}

export function renderRowsTable(rows) {
  const table = new Table({
    head: [
      'Provider',
      'Model',
      'Sessions',
      'Turns',
      'In',
      'Out',
      'Cached',
      'Reasoning',
      'Last Seen',
    ],
    style: {
      head: ['cyan'],
      border: ['grey'],
      compact: false,
    },
    colAligns: ['left', 'left', 'right', 'right', 'right', 'right', 'right', 'right', 'left'],
  });

  for (const row of rows) {
    table.push([
      colourProvider(row.provider),
      humanModel(row.model),
      formatNumber(row.sessions),
      formatNumber(row.turns),
      formatCompact(row.tokens_in),
      formatCompact(row.tokens_out),
      formatCompact(row.cached_tokens),
      formatCompact(row.reasoning_tokens),
      row.last_seen ? row.last_seen.toISOString().replace('T', ' ').slice(0, 19) : '-',
    ]);
  }

  return table.toString();
}

export function renderProviderTotalsTable(totals) {
  const table = new Table({
    head: ['Provider', 'Models', 'Sessions', 'Turns', 'In', 'Out', 'Cached'],
    style: { head: ['magenta'], border: ['grey'] },
    colAligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
  });

  for (const t of totals) {
    table.push([
      colourProvider(t.provider),
      formatNumber(t.models),
      formatNumber(t.sessions),
      formatNumber(t.turns),
      formatCompact(t.tokens_in),
      formatCompact(t.tokens_out),
      formatCompact(t.cached_tokens),
    ]);
  }

  return table.toString();
}

export function renderSummaryTable(summary) {
  const table = new Table({
    head: ['Scope', 'Providers', 'Models', 'Sessions', 'Turns', 'In', 'Out', 'Total', 'Cached', 'Reasoning'],
    style: { head: ['yellow'], border: ['grey'] },
    colAligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
  });

  table.push([
    'selected',
    formatNumber(summary.providers),
    formatNumber(summary.models),
    formatNumber(summary.sessions),
    formatNumber(summary.turns),
    formatCompact(summary.tokens_in),
    formatCompact(summary.tokens_out),
    formatCompact(summary.tokens_total),
    formatCompact(summary.cached_tokens),
    formatCompact(summary.reasoning_tokens),
  ]);

  return table.toString();
}

export function formatMetricValue(metric, summary, compact = true) {
  const n = Number(summary?.[metric] || 0);
  const tokenMetrics = new Set([
    'tokens_total',
    'tokens_in',
    'tokens_out',
    'cached_tokens',
    'reasoning_tokens',
  ]);

  if (compact) {
    return tokenMetrics.has(metric) ? formatCompact(n) : formatNumber(n);
  }

  return String(Math.round(n));
}

export function renderOpenRouterBlock(orData) {
  if (!orData) return null;

  const table = new Table({
    head: ['OpenRouter', 'Value'],
    style: { head: ['green'], border: ['grey'] },
    colAligns: ['left', 'left'],
  });

  if (orData.disabled) {
    table.push(['status', 'disabled']);
    return `\n${table.toString()}`;
  }

  if (orData.missingApiKey) {
    table.push(['status', `missing API key env: ${orData.apiKeyEnv || 'OPENROUTER_API_KEY'}`]);
    table.push(['hint', `export ${orData.apiKeyEnv || 'OPENROUTER_API_KEY'}=...`]);
    table.push(['note', openRouterModelBreakdownNote]);
    return `\n${table.toString()}`;
  }

  if (orData.key) {
    const limit = pickResponseValue(orData.key, [['limit'], ['rate_limit'], ['rateLimit'], ['limits', 'limit']]);
    const usage = pickResponseValue(orData.key, [['usage'], ['used'], ['requests'], ['request_count']]);
    const remaining = pickResponseValue(orData.key, [['limit_remaining'], ['remaining'], ['remaining_requests']]);

    if (usage != null) table.push(['key usage', formatLooseValue(usage)]);
    if (limit != null) table.push(['key limit', formatLooseValue(limit)]);
    if (remaining != null) table.push(['key remaining', formatLooseValue(remaining)]);
  }
  if (orData.keyError) table.push(['key status', `error: ${orData.keyError}`]);

  if (orData.credits) {
    const total = pickResponseValue(orData.credits, [['total_credits'], ['totalCredits'], ['credits_total']]);
    const used = pickResponseValue(orData.credits, [['total_usage'], ['totalUsage'], ['credits_used']]);
    const remaining = pickResponseValue(orData.credits, [['remaining_credits'], ['remainingCredits'], ['balance'], ['credits_remaining']]);
    const totalNumber = coerceFiniteNumber(total);
    const usedNumber = coerceFiniteNumber(used);
    const left = remaining ?? (totalNumber != null && usedNumber != null ? totalNumber - usedNumber : null);

    if (total != null) table.push(['credits total', formatLooseValue(total)]);
    if (used != null) table.push(['credits used', formatLooseValue(used)]);
    if (left != null) table.push(['credits left', formatLooseValue(left)]);
  }
  if (orData.creditsError) table.push(['credits status', `error: ${orData.creditsError}`]);

  if (table.length === 0) {
    table.push(['status', 'no data returned']);
  }

  table.push(['note', openRouterModelBreakdownNote]);

  return `\n${table.toString()}`;
}
