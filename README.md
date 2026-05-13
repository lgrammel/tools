# AI SDK Tools

Tools for building local agents with the [AI SDK](https://ai-sdk.dev/). The packages in this repository are designed for agents that need access to local resources, local data, or developer-machine workflows.

## Tools

- [`@lgrammel/kiwix-tool`](./packages/kiwix-tool): AI SDK tools for searching and reading local Kiwix/ZIM archives from Node.js.

## Examples

- [`examples/kiwix-tool`](./examples/kiwix-tool): terminal UI example that uses `@lgrammel/kiwix-tool` with a local Wikipedia ZIM archive.

## Development

Install dependencies and build all workspaces with Bun:

```bash
bun install
bun run build
```

Run the Kiwix tool example with an OpenAI API key and a local ZIM file:

```bash
cp examples/kiwix-tool/.env.example examples/kiwix-tool/.env
bun run --cwd examples/kiwix-tool start
```

The example expects `OPENAI_API_KEY` and `WIKIPEDIA_ZIM_PATH` in `examples/kiwix-tool/.env`. It launches an interactive terminal UI rendered by `@lgrammel/agent-tui`.
