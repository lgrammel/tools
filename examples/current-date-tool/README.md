# Current Date Tool Example

Interactive terminal UI for testing `@lgrammel/current-date-tool` with an OpenAI model.

## Setup

```bash
pnpm install
cp examples/current-date-tool/.env.example examples/current-date-tool/.env
```

Set `OPENAI_API_KEY` in `examples/current-date-tool/.env`.

## Run

```bash
pnpm --dir examples/current-date-tool start
```

The app uses the `currentDate` tool with the `Europe/Berlin` timezone and renders an interactive terminal UI through `@ai-sdk/tui`.
