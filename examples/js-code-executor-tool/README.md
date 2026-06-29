# JavaScript Code Executor Tool Example

Interactive terminal UI for testing `@lgrammel/js-code-executor-tool` with an OpenAI model.

## Setup

```bash
pnpm install
cp examples/js-code-executor-tool/.env.example examples/js-code-executor-tool/.env
```

Set `OPENAI_API_KEY` in `examples/js-code-executor-tool/.env`.

## Run

```bash
pnpm --dir examples/js-code-executor-tool start
```

Ask for a calculation or small data transformation. The app renders an interactive terminal UI through `@lgrammel/agent-tui` and lets the agent run trusted JavaScript snippets.
