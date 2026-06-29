# AI SDK Tools

AI SDK tool packages and runnable terminal examples for agents that need local resources, live data, or developer-machine workflows.

## Packages

- [`@lgrammel/current-date-tool`](./packages/current-date-tool): returns the current date and time in a configured IANA timezone.
- [`@lgrammel/exa-search-tool`](./packages/exa-search-tool): searches the web and fetches page content through Exa.
- [`@lgrammel/js-code-executor-tool`](./packages/js-code-executor-tool): executes trusted JavaScript snippets in an in-process Node.js `vm` context.
- [`@lgrammel/kiwix-tool`](./packages/kiwix-tool): searches and reads local Kiwix/ZIM archives through Node.js libzim bindings.
- [`@lgrammel/open-meteo-tool`](./packages/open-meteo-tool): resolves place names and fetches weather reports and forecasts through Open-Meteo.

## Examples

- [`examples/current-date-tool`](./examples/current-date-tool): terminal UI for date, time, and relative-date questions.
- [`examples/exa-search-tool`](./examples/exa-search-tool): terminal UI for web search and page fetching.
- [`examples/js-code-executor-tool`](./examples/js-code-executor-tool): terminal UI for calculations and small JavaScript snippets.
- [`examples/kiwix-tool`](./examples/kiwix-tool): terminal UI for questions against a local Wikipedia ZIM archive.
- [`examples/open-meteo-tool`](./examples/open-meteo-tool): terminal UI for current weather and forecasts.

## Development

Install dependencies and build all workspaces with pnpm:

```bash
pnpm install
pnpm build
```

Run an example by copying its `.env.example` file and starting that workspace:

```bash
cp examples/open-meteo-tool/.env.example examples/open-meteo-tool/.env
pnpm --dir examples/open-meteo-tool start
```

All examples use `@ai-sdk/tui` and require `OPENAI_API_KEY`. The Exa example also requires `EXA_API_KEY`, and the Kiwix example requires `WIKIPEDIA_ZIM_PATH` pointing to a local `.zim` file.
