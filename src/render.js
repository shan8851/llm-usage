import chalk from 'chalk';
import Table from 'cli-table3';
import { formatCompact, formatNumber } from './utils.js';

function colourProvider(provider) {
  if (provider === 'claude') return chalk.hex('#D97706')(provider);
  if (provider === 'codex') return chalk.hex('#2563EB')(provider);
  if (provider === 'openrouter') return chalk.hex('#059669')(provider);
  return provider;
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
    head: ['Scope', 'Models', 'Sessions', 'Turns', 'In', 'Out', 'Total', 'Cached', 'Reasoning'],
    style: { head: ['yellow'], border: ['grey'] },
    colAligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
  });

  table.push([
    'selected',
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
  if (compact) return formatCompact(n);
  return formatNumber(n);
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
    table.push(['note', 'model/token breakdown not available from public key/credits endpoints']);
    return `\n${table.toString()}`;
  }

  if (orData.key) {
    const d = orData.key?.data || orData.key;
    const limit = d?.limit ?? d?.rate_limit ?? d?.rateLimit;
    const usage = d?.usage ?? d?.used ?? d?.requests;
    const remaining = d?.limit_remaining ?? d?.remaining;

    if (usage != null) table.push(['key usage', String(usage)]);
    if (limit != null) table.push(['key limit', String(limit)]);
    if (remaining != null) table.push(['key remaining', String(remaining)]);
  }
  if (orData.keyError) table.push(['key status', `error: ${orData.keyError}`]);

  if (orData.credits) {
    const d = orData.credits?.data || orData.credits;
    const total = d?.total_credits;
    const used = d?.total_usage;
    const left = total != null && used != null ? Number(total) - Number(used) : null;

    if (total != null) table.push(['credits total', String(total)]);
    if (used != null) table.push(['credits used', String(used)]);
    if (left != null && Number.isFinite(left)) table.push(['credits left', left.toFixed(6)]);
  }
  if (orData.creditsError) table.push(['credits status', `error: ${orData.creditsError}`]);

  if (table.length === 0) {
    table.push(['status', 'no data returned']);
  }

  table.push(['note', 'model/token breakdown not available from public key/credits endpoints']);

  return `\n${table.toString()}`;
}
