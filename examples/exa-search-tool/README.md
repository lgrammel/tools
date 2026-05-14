# Exa Search Tool Example

Interactive terminal UI for testing `@lgrammel/exa-search-tool` with Exa web search and page fetching.

## Setup

Install workspace dependencies from the repository root:

```bash
bun install
```

Create an example environment file:

```bash
cp examples/exa-search-tool/.env.example examples/exa-search-tool/.env
```

Set `OPENAI_API_KEY` and `EXA_API_KEY` in `examples/exa-search-tool/.env`.

## Run

```bash
bun run --cwd examples/exa-search-tool start
```

The app opens an interactive terminal UI rendered by `@lgrammel/agent-tui`. Ask a current-events or web research question, then the agent searches Exa, fetches relevant pages, and answers with URL citations.

## Controls

- `Enter`: submit prompt
- `Up` / `Down`: scroll transcript
- `Ctrl+R`: repaint
- `Ctrl+C`: exit
