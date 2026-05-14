# Kiwix Tool Example

Interactive terminal UI for asking questions against a local Kiwix/ZIM archive with `@lgrammel/kiwix-tool`.

## Setup

```bash
bun install
cp examples/kiwix-tool/.env.example examples/kiwix-tool/.env
```

Set `OPENAI_API_KEY` and `WIKIPEDIA_ZIM_PATH` in `examples/kiwix-tool/.env`. `WIKIPEDIA_ZIM_PATH` must point to a local `.zim` archive.

## Run

```bash
bun run --cwd examples/kiwix-tool start
```

Ask a question about the archive. The app renders an interactive terminal UI through `@lgrammel/agent-tui`; the agent searches and reads local pages before answering.
