import chalk from 'chalk';
import Table from 'cli-table3';
import { formatCompact, formatNumber } from './utils.js';

function colourProvider(provider) {
  if (provider === 'claude') return chalk.hex('#D97706')(provider);
  if (provider === 'codex') return chalk.hex('#2563EB')(provider);
  if (provider === 'openrouter') return chalk.hex('#059669')(provider);
  return provider;
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
      row.model,
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

export function renderOpenRouterBlock(orData) {
  if (!orData) return null;
  const lines = [];
  lines.push(chalk.bold('\nOpenRouter'));

  if (orData.disabled) {
    lines.push(`  ${chalk.grey('disabled (use --openrouter and set config openrouter.enabled=true)')}`);
    return lines.join('\n');
  }

  if (orData.missingApiKey) {
    lines.push(`  ${chalk.yellow(`missing API key env: ${orData.apiKeyEnv || 'OPENROUTER_API_KEY'}`)}`);
    lines.push(`  ${chalk.grey(`hint: export ${orData.apiKeyEnv || 'OPENROUTER_API_KEY'}=...`)}`);
    return lines.join('\n');
  }

  if (orData.key) {
    const d = orData.key?.data || orData.key;
    const limit = d?.limit ?? d?.rate_limit ?? d?.rateLimit;
    const usage = d?.usage ?? d?.used ?? d?.requests;
    const remaining = d?.limit_remaining ?? d?.remaining;
    if (limit != null || usage != null || remaining != null) {
      lines.push(`  key: usage=${usage ?? '-'} limit=${limit ?? '-'} remaining=${remaining ?? '-'}`);
    }
  }
  if (orData.keyError) lines.push(`  key: ${chalk.yellow(orData.keyError)}`);

  if (orData.credits) {
    const d = orData.credits?.data || orData.credits;
    lines.push(`  credits: total=${d?.total_credits ?? '-'} used=${d?.total_usage ?? '-'} left=${d?.total_credits != null && d?.total_usage != null ? (d.total_credits - d.total_usage).toFixed(4) : '-'}`);
  }
  if (orData.creditsError) lines.push(`  credits: ${chalk.yellow(orData.creditsError)}`);

  return lines.join('\n');
}
