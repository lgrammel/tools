# kiwix-tool

Bun monorepo for `@lgrammel/kiwix-tool`, an AI SDK 7 tool package for reading Kiwix/ZIM files from Node.js.

## Packages

- `packages/kiwix-tool`: publishable package `@lgrammel/kiwix-tool`
- `examples/terminal`: private terminal example that uses `/Users/lgrammel/opt/zim/wikipedia_en_all_maxi_2026-02.zim`

## Setup

```bash
bun install
bun run build
```

Run the terminal example with an OpenAI API key:

```bash
OPENAI_API_KEY=... bun run --cwd examples/terminal start
```

The example has the Wikipedia ZIM path hardcoded in `examples/terminal/src/index.ts`.
