import { InvalidArgumentError, Command } from 'commander';
import chalk from 'chalk';
import {
  aggregateRecords,
  dailyBuckets,
  metricValue,
  providerTotals,
  summarizeRows,
  supportedMetrics,
} from './aggregate.js';
import { loadConfig, exampleConfigToml } from './config.js';
import { fetchOpenRouterSummary } from './openrouter.js';
import { collectClaudeRows } from './parse-claude.js';
import { collectCodexRows } from './parse-codex.js';
import {
  formatMetricValue,
  renderDailyTable,
  renderOpenRouterBlock,
  renderProviderTotalsTable,
  renderRowsTable,
} from './render.js';
import { formatCompact, formatNumber, parseTime, supportedSortFields } from './utils.js';

const defaultLookbackWindowMs = 30 * 24 * 60 * 60 * 1000;
const syntheticModelName = '<synthetic>';

const parseSortField = (value) => {
  if (!supportedSortFields.includes(value)) {
    throw new InvalidArgumentError(`must be one of: ${supportedSortFields.join(', ')}`);
  }

  return value;
};

const parseMetricName = (value) => {
  if (!supportedMetrics.includes(value)) {
    throw new InvalidArgumentError(`must be one of: ${supportedMetrics.join(', ')}`);
  }

  return value;
};

const addCommonOptions = (cmd) =>
  cmd
    .option('--from <time>', 'Start time (ISO or relative: 7d, 24h, 30m)', '30d')
    .option('--to <time>', 'End time (ISO or now)', 'now')
    .option('--provider <providers>', 'Filter providers (comma-separated), e.g. claude,codex')
    .option('--model <substring>', 'Filter model substring')
    .option('--json', 'JSON output')
    .option('--config <path>', 'Path to config TOML');

const addSortOption = (cmd) =>
  cmd.option(
    '--sort <field>',
    `Sort models by ${supportedSortFields.join('|')}`,
    parseSortField,
    'tokens_out',
  );

const filterSyntheticRows = (records) =>
  records.filter((record) => !(record.provider === 'claude' && record.model === syntheticModelName));

const loadUsageContext = async (opts) => {
  const { config, configPath } = await loadConfig(opts.config);
  const from = parseTime(opts.from, new Date(Date.now() - defaultLookbackWindowMs));
  const to = parseTime(opts.to, new Date());

  if (to < from) {
    throw new Error(`--to (${to.toISOString()}) cannot be before --from (${from.toISOString()})`);
  }

  const [claudeRows, codexRows] = await Promise.all([
    collectClaudeRows(config.paths.claude, from, to),
    collectCodexRows(config.paths.codex, from, to),
  ]);

  const allRecords = [...claudeRows, ...codexRows];
  const records = filterSyntheticRows(allRecords);

  return {
    config,
    configPath,
    from,
    to,
    allRecords,
    records,
    syntheticRowsHidden: allRecords.length - records.length,
  };
};

const buildFilteredRows = (records, opts, sortBy = 'tokens_out') =>
  aggregateRecords(records, {
    providerFilter: opts.provider,
    modelFilter: opts.model,
    sortBy,
  });

const printHeader = ({ from, to, configPath, allRecords, summary }) => {
  const separator = chalk.grey('─'.repeat(60));
  const headlineStat = `${formatCompact(summary.tokens_total)} tokens across ${formatNumber(summary.sessions)} sessions (${formatNumber(summary.models)} models)`;

  console.log(chalk.bold.whiteBright('\n⚡ llm-usage'));
  console.log(separator);
  console.log(chalk.dim(`window: ${from.toISOString()} -> ${to.toISOString()}`));
  console.log(chalk.dim(`config: ${configPath}`));
  console.log(chalk.dim(`records parsed: ${allRecords.length}`));
  console.log(`\n${chalk.bold(headlineStat)}`);
};

const renderMetricOutput = (metric, summary, valueOnly) => {
  const selectedMetricValue = metricValue(summary, metric);

  if (valueOnly) {
    console.log(String(Math.round(selectedMetricValue)));
    return;
  }

  console.log(`${metric}: ${formatMetricValue(metric, summary, true)}`);
};

const renderJson = (payload) => {
  console.log(JSON.stringify(payload, null, 2));
};

const loadOpenRouterSummary = async (config) =>
  fetchOpenRouterSummary({
    enabled: config.openrouter.enabled,
    apiKey: config.openrouter.apiKey,
    baseUrl: config.openrouter.baseUrl,
  });

const renderRootCommand = async (opts) => {
  if (opts.printConfigExample) {
    console.log(exampleConfigToml());
    return;
  }

  if (opts.valueOnly && !opts.metric) {
    throw new Error('--value-only requires --metric');
  }

  const context = await loadUsageContext(opts);
  const rows = buildFilteredRows(context.records, opts, opts.sort);
  const summary = summarizeRows(rows);
  const totals = providerTotals(rows);

  if (opts.json) {
    const openrouter = await loadOpenRouterSummary(context.config);

    renderJson({
      meta: {
        from: context.from.toISOString(),
        to: context.to.toISOString(),
        configPath: context.configPath,
        recordsParsed: context.allRecords.length,
        recordsUsed: context.records.length,
        rowsFiltered: rows.length,
        syntheticRowsHidden: context.syntheticRowsHidden,
      },
      summary,
      rows,
      providerTotals: totals,
      metric: opts.metric ? { name: opts.metric, value: metricValue(summary, opts.metric) } : null,
      openrouter,
    });
    return;
  }

  if (opts.metric) {
    renderMetricOutput(opts.metric, summary, opts.valueOnly);
    return;
  }

  const openrouter = await loadOpenRouterSummary(context.config);

  printHeader({ ...context, summary });

  if (!rows.length) {
    console.log(chalk.yellow('\nNo usage rows found for that filter/window.'));
  } else {
    console.log(`\n${chalk.bold('Models')}`);
    console.log(renderRowsTable(rows));
    console.log(`\n${chalk.bold('Providers')}`);
    console.log(renderProviderTotalsTable(totals));
  }

  const openRouterBlock = renderOpenRouterBlock(openrouter);
  if (openRouterBlock) {
    console.log(openRouterBlock);
  }
};

const renderDailyCommand = async (opts) => {
  const context = await loadUsageContext(opts);
  const filteredRows = buildFilteredRows(context.records, opts);
  const summary = summarizeRows(filteredRows);
  const buckets = dailyBuckets(context.records, {
    providerFilter: opts.provider,
    modelFilter: opts.model,
  });

  if (opts.json) {
    renderJson(buckets);
    return;
  }

  printHeader({ ...context, summary });

  if (!buckets.length) {
    console.log(chalk.yellow('\nNo usage data found for that filter/window.'));
    return;
  }

  console.log(`\n${chalk.bold('Daily')}`);
  console.log(renderDailyTable(buckets));
};

const renderModelsCommand = async (opts) => {
  const context = await loadUsageContext(opts);
  const rows = buildFilteredRows(context.records, opts, opts.sort);
  const summary = summarizeRows(rows);

  if (opts.json) {
    renderJson(rows);
    return;
  }

  printHeader({ ...context, summary });

  if (!rows.length) {
    console.log(chalk.yellow('\nNo usage rows found for that filter/window.'));
    return;
  }

  console.log(`\n${chalk.bold('Models')}`);
  console.log(renderRowsTable(rows));
};

const renderProvidersCommand = async (opts) => {
  const context = await loadUsageContext(opts);
  const filteredRows = buildFilteredRows(context.records, opts);
  const summary = summarizeRows(filteredRows);
  const totals = providerTotals(filteredRows);

  if (opts.json) {
    renderJson(totals);
    return;
  }

  printHeader({ ...context, summary });

  if (!totals.length) {
    console.log(chalk.yellow('\nNo usage data found for that filter/window.'));
    return;
  }

  console.log(`\n${chalk.bold('Providers')}`);
  console.log(renderProviderTotalsTable(totals));
};

const program = new Command();

program
  .name('llm-usage')
  .description('Pretty terminal usage summaries for Claude Code, Codex, and OpenRouter')
  .showHelpAfterError()
  .enablePositionalOptions();

addSortOption(
  addCommonOptions(program)
    .option(
      '--metric <metric>',
      `Single metric output: ${supportedMetrics.join('|')}`,
      parseMetricName,
    )
    .option('--value-only', 'Print only the metric value')
    .option('--print-config-example', 'Print example config and exit'),
).action(renderRootCommand);

const dailyCommand = addCommonOptions(new Command('daily').description('Show usage per calendar day')).action(
  renderDailyCommand,
);

const modelsCommand = addSortOption(addCommonOptions(new Command('models').description('Show usage grouped by model'))).action(
  renderModelsCommand,
);

const providersCommand = addCommonOptions(new Command('providers').description('Show usage grouped by provider')).action(
  renderProvidersCommand,
);

program.addCommand(dailyCommand);
program.addCommand(modelsCommand);
program.addCommand(providersCommand);

try {
  await program.parseAsync(process.argv);
} catch (error) {
  console.error(chalk.red(error.message));
  process.exit(1);
}
