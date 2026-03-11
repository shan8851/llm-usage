import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, exampleConfigToml } from './config.js';
import { parseTime, formatCompact, formatNumber } from './utils.js';
import { collectClaudeRows } from './parse-claude.js';
import { collectCodexRows } from './parse-codex.js';
import { aggregateRecords, metricValue, providerTotals, summarizeRows, supportedMetrics } from './aggregate.js';
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
const validMetrics = new Set(supportedMetrics);

if (opts.metric && !validMetrics.has(opts.metric)) {
  throw new Error(`Invalid --metric '${opts.metric}'. Allowed: ${[...validMetrics].join(', ')}`);
}

if (opts.valueOnly && !opts.metric) {
  throw new Error('--value-only requires --metric');
}

if (opts.metric && opts.totalsOnly) {
  throw new Error('--metric cannot be combined with --totals-only');
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
const totals = providerTotals(rows);
const scopeProviderTotals = providerTotals(filteredRows);
const summary = summarizeRows(filteredRows);

const printStyledHeader = () => {
  const separator = chalk.grey('─'.repeat(60));
  console.log(chalk.bold.whiteBright('\n⚡ llm-usage'));
  console.log(separator);
  console.log(chalk.dim(`window: ${from.toISOString()} → ${to.toISOString()}`));
  console.log(chalk.dim(`config: ${configPath}`));
  console.log(chalk.dim(`records parsed: ${allRecords.length}`));
  if (!opts.includeSynthetic && syntheticCount > 0) {
    console.log(chalk.dim(`synthetic rows hidden: ${syntheticCount} (use --include-synthetic to show)`));
  }
  const headlineStat = `${formatCompact(summary.tokens_total)} tokens across ${formatNumber(summary.sessions)} sessions (${summary.models} models)`;
  console.log('\n' + chalk.bold(headlineStat));
};

const compactTextMode = !opts.json && (Boolean(opts.metric) || opts.totalsOnly);
const selectedMetricValue = opts.metric ? metricValue(summary, opts.metric) : null;

const orData = compactTextMode
  ? null
  : await fetchOpenRouterSummary({
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
        scopeProviderTotals,
        metric: opts.metric ? { name: opts.metric, value: selectedMetricValue } : null,
        openrouter: orData,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (opts.metric) {
  if (opts.valueOnly) {
    console.log(String(Math.round(selectedMetricValue ?? 0)));
  } else {
    console.log(`${opts.metric}: ${formatMetricValue(opts.metric, summary, true)}`);
  }
  process.exit(0);
}

if (opts.totalsOnly) {
  printStyledHeader();
  console.log('\n' + renderSummaryTable(summary));
  process.exit(0);
}

printStyledHeader();

if (!filteredRows.length) {
  console.log(chalk.yellow('\nNo usage rows found for that filter/window.'));
} else {
  console.log('\n' + chalk.bold('📊 Models'));
  console.log(renderRowsTable(rows));
  console.log('\n' + chalk.bold('📦 Providers'));
  console.log(renderProviderTotalsTable(totals));
}

const orBlock = renderOpenRouterBlock(orData);
if (orBlock) console.log(orBlock);
