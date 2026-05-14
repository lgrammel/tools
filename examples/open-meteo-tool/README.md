# Open-Meteo Tool Example

Interactive terminal UI for testing `@lgrammel/open-meteo-tool` with an OpenAI model. Open-Meteo does not require an API key.

## Setup

```bash
bun install
cp examples/open-meteo-tool/.env.example examples/open-meteo-tool/.env
```

Set `OPENAI_API_KEY` in `examples/open-meteo-tool/.env`.

## Run

```bash
bun run --cwd examples/open-meteo-tool start
```

Ask about current weather or forecasts. The app renders an interactive terminal UI through `@lgrammel/agent-tui` and uses metric units by default.
