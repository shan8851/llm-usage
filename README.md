# llm-usage

Pretty terminal usage summaries for Claude Code, Codex, and OpenRouter.

Default output is a clean table with:

- provider
- model
- sessions
- turns/messages
- tokens in
- tokens out
- cached tokens
- reasoning tokens (where available)
- last seen

---

## Features (v0)

- Parses **Claude Code local logs** (`~/.claude/projects` and `~/.config/claude/projects`)
- Parses **Codex local logs** (`~/.codex/sessions`)
- Optional **OpenRouter** balance/key snapshot (`/key` + `/credits`)
- Pretty table by default
- JSON output with `--json`
- Time filtering (`--from 7d`, `--from 24h`, ISO timestamps)
- Provider/model filtering

---

## Install

### Global (npm)

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
git clone https://github.com/<you>/llm-usage.git
cd llm-usage
npm install
npm run dev -- --from 7d
```

### Local link (test global command from source)

```bash
npm link
llm-usage --from 30d
```

---

## Usage

```bash
llm-usage
llm-usage --from 7d
llm-usage --provider claude
llm-usage --provider codex --model gpt-5
llm-usage --sort sessions --max-rows 20
llm-usage --json
```

### Flags

- `--provider <providers>` comma-separated (e.g. `claude,codex`)
- `--model <substring>` filter model name
- `--from <time>` `7d`, `24h`, `30m`, or ISO date/time
- `--to <time>` `now` or ISO date/time
- `--sort <field>` `tokens_out|tokens_in|sessions|turns|cached_tokens|reasoning_tokens|model`
- `--max-rows <n>` max output rows (default `50`)
- `--json` machine-friendly output
- `--config <path>` custom config file path
- `--no-openrouter` skip OpenRouter lookup
- `--print-config-example` print sample config and exit

---

## Config

By default, config is loaded from:

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

Set API key for OpenRouter:

```bash
export OPENROUTER_API_KEY="..."
```

---

## Data notes

### Claude

Reads message usage fields from local JSONL logs:

- `input_tokens`
- `output_tokens`
- `cache_creation_input_tokens`
- `cache_read_input_tokens`

### Codex

Reads cumulative `token_count` events and computes per-event deltas for:

- `input_tokens`
- `cached_input_tokens`
- `output_tokens`
- `reasoning_output_tokens`

---

## Roadmap

- v0.2: sparkline/mini charts
- v0.3: richer subcommands (`models`, `providers`, `sessions`)
- v0.4: optional interactive TUI mode

---

## License

MIT
