# Open-Meteo Tool Example

Interactive terminal UI for testing `@lgrammel/open-meteo-tool` with an OpenAI model. Open-Meteo does not require an API key.

## Setup

```bash
pnpm install
cp examples/open-meteo-tool/.env.example examples/open-meteo-tool/.env
```

Set `OPENAI_API_KEY` in `examples/open-meteo-tool/.env`.

## Run

```bash
pnpm --dir examples/open-meteo-tool start
```

Ask about current weather or forecasts. The app renders an interactive terminal UI through `@ai-sdk/tui` and uses metric units by default.
