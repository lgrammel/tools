# Exa Search Tool Example

Interactive terminal UI for testing `@lgrammel/exa-search-tool` with Exa web search and page fetching.

## Setup

```bash
pnpm install
cp examples/exa-search-tool/.env.example examples/exa-search-tool/.env
```

Set `OPENAI_API_KEY` and `EXA_API_KEY` in `examples/exa-search-tool/.env`.

## Run

```bash
pnpm --dir examples/exa-search-tool start
```

Ask a current-events or web research question. The app renders an interactive terminal UI through `@ai-sdk/tui`; the agent searches Exa, fetches relevant pages, and answers with URL citations.
