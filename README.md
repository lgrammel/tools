# AI SDK Tools

Tools for building local agents with the [AI SDK](https://ai-sdk.dev/). The packages in this repository are designed for agents that need access to local resources, local data, or developer-machine workflows.

## Tools

- [`@lgrammel/exa-search-tool`](./packages/exa-search-tool): AI SDK tools for Exa web search and page content retrieval.
- [`@lgrammel/kiwix-tool`](./packages/kiwix-tool): AI SDK tools for searching and reading local Kiwix/ZIM archives from Node.js.
- [`@lgrammel/js-code-executor-tool`](./packages/js-code-executor-tool): AI SDK tool for executing JavaScript code in an in-process Node.js `vm` context.
- [`@lgrammel/open-meteo-tool`](./packages/open-meteo-tool): AI SDK tools for weather location lookup, current reports, and forecasts through Open-Meteo.

## Examples

- [`examples/exa-search-tool`](./examples/exa-search-tool): terminal UI example that uses `@lgrammel/exa-search-tool` for web search and page fetching.
- [`examples/kiwix-tool`](./examples/kiwix-tool): terminal UI example that uses `@lgrammel/kiwix-tool` with a local Wikipedia ZIM archive.
- [`examples/js-code-executor-tool`](./examples/js-code-executor-tool): terminal UI example that uses `@lgrammel/js-code-executor-tool` for calculations and small JavaScript snippets.
- [`examples/open-meteo-tool`](./examples/open-meteo-tool): terminal UI example that uses `@lgrammel/open-meteo-tool` for weather reports and forecasts.

## Development

Install dependencies and build all workspaces with Bun:

```bash
bun install
bun run build
```

Run the Kiwix tool example with an OpenAI API key and a local ZIM file:

```bash
cp examples/kiwix-tool/.env.example examples/kiwix-tool/.env
bun run --cwd examples/kiwix-tool start
```

The example expects `OPENAI_API_KEY` and `WIKIPEDIA_ZIM_PATH` in `examples/kiwix-tool/.env`. It launches an interactive terminal UI rendered by `@lgrammel/agent-tui`.

Run the Open-Meteo tool example with an OpenAI API key:

```bash
cp examples/open-meteo-tool/.env.example examples/open-meteo-tool/.env
bun run --cwd examples/open-meteo-tool start
```

Open-Meteo does not require an API key. The example expects `OPENAI_API_KEY` in `examples/open-meteo-tool/.env`.
