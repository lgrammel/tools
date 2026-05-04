# kiwix-tool

Bun monorepo for `@lgrammel/kiwix-tool`, an AI SDK 7 tool package for reading Kiwix/ZIM files from Node.js.

## Packages

- `packages/kiwix-tool`: publishable package `@lgrammel/kiwix-tool`
- `examples/terminal`: private terminal example that reads the Wikipedia ZIM path from `.env`

## Setup

```bash
bun install
bun run build
```

Run the terminal example with an OpenAI API key:

```bash
cp examples/terminal/.env.example examples/terminal/.env
bun run --cwd examples/terminal start
```

The example expects `OPENAI_API_KEY` and `WIKIPEDIA_ZIM_PATH` in `examples/terminal/.env`.
