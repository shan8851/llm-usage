import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, exampleConfigToml } from './config.js';
import { parseTime } from './utils.js';
import { collectClaudeRows } from './parse-claude.js';
import { collectCodexRows } from './parse-codex.js';
import { aggregateRecords, providerTotals, summarizeRows } from './aggregate.js';
import { formatMetricValue, renderOpenRouterBlock, renderProviderTotalsTable, renderRowsTable, renderSummaryTable } from './render.js';
import { fetchOpenRouterSummary } from './openrouter.js';

const program = new Command();

program
  .name('llm-usage')
  .description('Pretty terminal usage summaries for Claude Code, Codex, and OpenRouter')
  .option('--provider <providers>', 'Filter providers (comma-separated), e.g. claude,codex')
  .option('--model <substring>', 'Filter model substring')
  .option('--from <time>', 'Start time (ISO or relative: 7d, 24h, 30m)', '30d')
  .option('--to <time>', 'End time (ISO or now)', 'now')
  .option('--sort <field>', 'Sort by tokens_out|tokens_in|sessions|turns|cached_tokens|reasoning_tokens|model', 'tokens_out')
  .option('--max-rows <n>', 'Limit output rows', (v) => Number(v), 50)
  .option('--metric <metric>', 'Single metric output: tokens_total|tokens_in|tokens_out|sessions|turns|cached_tokens|reasoning_tokens|models')
  .option('--value-only', 'Print only metric value (best with --metric)')
  .option('--totals-only', 'Show one compact totals table for selected scope')
  .option('--json', 'JSON output')
  .option('--config <path>', 'Path to config TOML')
  .option('--no-openrouter', 'Skip OpenRouter API lookup')
  .option('--include-synthetic', 'Include Claude synthetic zero-usage model rows')
  .option('--print-config-example', 'Print example config and exit');

const opts = program.parse(process.argv).opts();

const validMetrics = new Set([
  'tokens_total',
  'tokens_in',
  'tokens_out',
  'sessions',
  'turns',
  'cached_tokens',
  'reasoning_tokens',
  'models',
]);

if (opts.metric && !validMetrics.has(opts.metric)) {
  throw new Error(`Invalid --metric '${opts.metric}'. Allowed: ${[...validMetrics].join(', ')}`);
}

if (opts.valueOnly && !opts.metric) {
  throw new Error('--value-only requires --metric');
}

if (opts.printConfigExample) {
  console.log(exampleConfigToml());
  process.exit(0);
}

const { config, configPath } = await loadConfig(opts.config);
const from = parseTime(opts.from, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
const to = parseTime(opts.to, new Date());

if (to < from) {
  throw new Error(`--to (${to.toISOString()}) cannot be before --from (${from.toISOString()})`);
}

const [claudeRows, codexRows] = await Promise.all([
  collectClaudeRows(config.paths.claude, from, to),
  collectCodexRows(config.paths.codex, from, to),
]);

const allRecords = [...claudeRows, ...codexRows];
const syntheticCount = allRecords.filter((r) => r.provider === 'claude' && r.model === '<synthetic>').length;
const records = opts.includeSynthetic
  ? allRecords
  : allRecords.filter((r) => !(r.provider === 'claude' && r.model === '<synthetic>'));

const filteredRows = aggregateRecords(records, {
  providerFilter: opts.provider,
  modelFilter: opts.model,
  sortBy: opts.sort,
});

const rows = typeof opts.maxRows === 'number' && opts.maxRows > 0 ? filteredRows.slice(0, opts.maxRows) : filteredRows;
const totals = providerTotals(filteredRows);
const summary = summarizeRows(filteredRows);

const orData = await fetchOpenRouterSummary({
  enabled: Boolean(opts.openrouter && config.openrouter.enabled),
  apiKey: config.openrouter.apiKey,
  apiKeyEnv: config.openrouter.apiKeyEnv,
  baseUrl: config.openrouter.baseUrl,
});

if (opts.json) {
  console.log(
    JSON.stringify(
      {
        meta: {
          from: from.toISOString(),
          to: to.toISOString(),
          configPath,
          recordsParsed: allRecords.length,
          recordsUsed: records.length,
          rowsFiltered: filteredRows.length,
          rowsShown: rows.length,
          syntheticFiltered: opts.includeSynthetic ? 0 : syntheticCount,
        },
        summary,
        rows,
        providerTotals: totals,
        openrouter: orData,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (opts.metric && opts.valueOnly) {
  const raw = Number(summary?.[opts.metric] || 0);
  console.log(String(Math.round(raw)));
  process.exit(0);
}

console.log(chalk.bold(`\nLLM Usage`));
console.log(chalk.grey(`window: ${from.toISOString()} → ${to.toISOString()}`));
console.log(chalk.grey(`config: ${configPath}`));
console.log(chalk.grey(`records parsed: ${allRecords.length}`));
if (!opts.includeSynthetic && syntheticCount > 0) {
  console.log(chalk.grey(`synthetic rows hidden: ${syntheticCount} (use --include-synthetic to show)`));
}

if (opts.metric) {
  console.log(`\n${chalk.bold(opts.metric)}: ${formatMetricValue(opts.metric, summary, true)}`);
}

if (!filteredRows.length) {
  console.log(chalk.yellow('\nNo usage rows found for that filter/window.'));
} else if (opts.totalsOnly) {
  console.log('\n' + renderSummaryTable(summary));
} else {
  console.log('\n' + renderRowsTable(rows));
  console.log('\n' + renderProviderTotalsTable(totals));
}

const orBlock = renderOpenRouterBlock(orData);
if (orBlock) console.log(orBlock);
