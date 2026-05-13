# Kiwix Tool Example

Interactive terminal UI for asking questions against a local Kiwix/ZIM archive with `@lgrammel/kiwix-tool`.

## Setup

Install workspace dependencies from the repository root:

```bash
bun install
```

Create an example environment file:

```bash
cp examples/kiwix-tool/.env.example examples/kiwix-tool/.env
```

Set `OPENAI_API_KEY` and `WIKIPEDIA_ZIM_PATH` in `examples/kiwix-tool/.env`. `WIKIPEDIA_ZIM_PATH` must point to an absolute path for a local `.zim` archive.

## Run

```bash
bun run --cwd examples/kiwix-tool start
```

The app opens an interactive terminal UI rendered by `@lgrammel/agent-tui`. Ask a question, then the agent searches and reads the local archive before answering.

## Controls

- `Enter`: submit prompt
- `Up` / `Down`: scroll transcript
- `Ctrl+R`: repaint
- `Ctrl+C`: exit
