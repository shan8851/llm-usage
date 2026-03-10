import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, exampleConfigToml } from './config.js';
import { parseTime } from './utils.js';
import { collectClaudeRows } from './parse-claude.js';
import { collectCodexRows } from './parse-codex.js';
import { aggregateRecords, providerTotals } from './aggregate.js';
import { renderOpenRouterBlock, renderProviderTotalsTable, renderRowsTable } from './render.js';
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
  .option('--json', 'JSON output')
  .option('--config <path>', 'Path to config TOML')
  .option('--no-openrouter', 'Skip OpenRouter API lookup')
  .option('--print-config-example', 'Print example config and exit');

const opts = program.parse(process.argv).opts();

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

const records = [...claudeRows, ...codexRows];
const rows = aggregateRecords(records, {
  providerFilter: opts.provider,
  modelFilter: opts.model,
  sortBy: opts.sort,
  maxRows: opts.maxRows,
});

const totals = providerTotals(rows);

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
          records: records.length,
          rows: rows.length,
        },
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

console.log(chalk.bold(`\nLLM Usage`));
console.log(chalk.grey(`window: ${from.toISOString()} → ${to.toISOString()}`));
console.log(chalk.grey(`config: ${configPath}`));
console.log(chalk.grey(`records parsed: ${records.length}`));

if (!rows.length) {
  console.log(chalk.yellow('\nNo usage rows found for that filter/window.'));
} else {
  console.log('\n' + renderRowsTable(rows));
  console.log('\n' + renderProviderTotalsTable(totals));
}

const orBlock = renderOpenRouterBlock(orData);
if (orBlock) console.log(orBlock);
