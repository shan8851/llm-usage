# llm-usage

[![npm version](https://img.shields.io/npm/v/llm-usage.svg)](https://www.npmjs.com/package/llm-usage)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![node](https://img.shields.io/node/v/llm-usage.svg)](https://nodejs.org)

> See where your tokens actually go. One command, all providers.

`llm-usage` is a small CLI that reads local usage logs from Claude Code and Codex, then prints a clean terminal summary by model and provider.

If you have `OPENROUTER_API_KEY` set, it can also show a small OpenRouter account snapshot on the main command. That part is just `/key` + `/credits`, not per-model usage.

## What You Get

- model-level usage across Claude Code and Codex
- provider totals
- daily breakdowns
- JSON output for scripting
- a few useful filters

By default the main command shows:

- provider
- model
- sessions
- turns/messages
- tokens in
- tokens out
- cached tokens
- reasoning tokens where available
- last seen

Claude `<synthetic>` rows are ignored.

## Install

### Global

```bash
npm install -g llm-usage
llm-usage --help
```

### Run without installing

```bash
npx llm-usage --from 7d
```

### Local development

```bash
git clone https://github.com/shan8851/llm-usage.git
cd llm-usage
npm install
npm run dev -- --from 7d
```

## Quick Start

```bash
# Last 7 days, normal summary
llm-usage --from 7d

# Daily buckets
llm-usage daily --from 7d

# Model-focused view, sorted a different way
llm-usage models --from 30d --sort sessions

# Pipe-friendly single metric
llm-usage --from 7d --metric tokens_total --value-only
```

## Commands

| Command | What it does |
|---|---|
| `llm-usage` or `lu` | Main summary: models, provider totals, and optional OpenRouter snapshot |
| `llm-usage daily` | Usage grouped by local calendar day |
| `llm-usage models` | Model table only |
| `llm-usage providers` | Provider totals only |

## Flags

Common flags:

- `--from <time>` start time, like `7d`, `24h`, `30m`, or an ISO timestamp
- `--to <time>` end time, `now` or an ISO timestamp
- `--provider <providers>` comma-separated provider filter, for example `claude,codex`
- `--model <substring>` filter model names by substring
- `--json` machine-friendly output
- `--config <path>` custom config path

Main command and `models`:

- `--sort <field>` one of `tokens_out|tokens_in|sessions|turns|cached_tokens|reasoning_tokens|model`

Main command only:

- `--metric <metric>` one of `tokens_total|tokens_in|tokens_out|sessions|turns|cached_tokens|reasoning_tokens|models`
- `--value-only` print only the metric value
- `--print-config-example` print a sample config and exit

Use `llm-usage --help` for the full CLI help text.

## More Examples

```bash
llm-usage --provider claude --model opus
llm-usage providers --from 30d
llm-usage models --provider codex --sort tokens_in
llm-usage daily --from 14d --provider codex
llm-usage --from 7d --json
```

## Config

Default config path:

`~/.config/llm-usage/config.toml`

Print an example:

```bash
llm-usage --print-config-example
```

Example:

```toml
[paths]
claude = ["~/.claude/projects", "~/.config/claude/projects"]
codex = ["~/.codex/sessions"]

[openrouter]
enabled = true
baseUrl = "https://openrouter.ai/api/v1"
apiKeyEnv = "OPENROUTER_API_KEY"
```

Set the OpenRouter key if you want the snapshot block:

```bash
export OPENROUTER_API_KEY="..."
```

If OpenRouter is disabled in config or the API key is missing, the CLI just skips that block.

## Data Notes

### Claude

Reads local JSONL logs and pulls usage from:

- `input_tokens`
- `output_tokens`
- `cache_creation_input_tokens`
- `cache_read_input_tokens`

### Codex

Reads cumulative `token_count` events and turns them into per-event deltas for:

- `input_tokens`
- `cached_input_tokens`
- `output_tokens`
- `reasoning_output_tokens`

## Limits And Caveats

- This is local-log based. If a provider does not write usable local logs, it is invisible here.
- `tokens_total` means `tokens_in + tokens_out`. Cached and reasoning tokens are shown separately and are not included in that total.
- Daily output uses your local calendar date, not UTC bucket boundaries.
- OpenRouter support is account-level only right now. Public `/key` and `/credits` endpoints do not give model-by-model token breakdowns.

## Contributing

PRs welcome. No formal process. Open an issue or PR and we can figure it out.

If you want to add another provider, the existing Claude and Codex parsers are the pattern: return normalized record objects and let the aggregation/rendering do the rest.

## License

MIT
