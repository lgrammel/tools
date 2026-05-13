# AI SDK Tools

Tools for building local agents with the [AI SDK](https://ai-sdk.dev/). The packages in this repository are designed for agents that need access to local resources, local data, or developer-machine workflows.

## Tools

- [`@lgrammel/kiwix-tool`](./packages/kiwix-tool): AI SDK tools for searching and reading local Kiwix/ZIM archives from Node.js.

## Examples

- [`examples/terminal`](./examples/terminal): terminal agent example that uses `@lgrammel/kiwix-tool` with a local Wikipedia ZIM archive.

## Development

Install dependencies and build all workspaces with Bun:

```bash
bun install
bun run build
```

Run the terminal example with an OpenAI API key and a local ZIM file:

```bash
cp examples/terminal/.env.example examples/terminal/.env
bun run --cwd examples/terminal start
```

The example expects `OPENAI_API_KEY` and `WIKIPEDIA_ZIM_PATH` in `examples/terminal/.env`.
