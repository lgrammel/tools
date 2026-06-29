# @lgrammel/open-meteo-tool

AI SDK 7 tool for resolving place names and fetching current weather reports and forecasts through [Open-Meteo](https://open-meteo.com/). The package calls Open-Meteo with `fetch` directly and does not require an API key.

## Install

```bash
pnpm add @lgrammel/open-meteo-tool ai
```

## Usage

```ts
import { openai } from "@ai-sdk/openai";
import { weather } from "@lgrammel/open-meteo-tool";
import { ToolLoopAgent } from "ai";

const agent = new ToolLoopAgent({
  model: openai("gpt-5.5"),
  instructions:
    "Use the weather tool for current conditions and forecasts. Mention the resolved location and units in the answer.",
  tools: {
    weather,
  },
});

const result = await agent.generate({
  prompt: "Will I need an umbrella in Berlin tomorrow?",
});

console.log(result.text);
```

## Tools

- `weather`: resolves a place name through Open-Meteo geocoding, then fetches current weather, daily forecasts, and near-term hourly forecasts for the best matching location. Input is `{ query }`. Output includes the resolved `location` and `forecast`.

Optional configuration lives in `toolsContext` and is validated by the tool's `contextSchema`, so the model cannot choose forecast horizon, unit preferences, timezone, API hosts, or returned hourly output size.

## Context

- `baseUrl`: Open-Meteo Forecast API base URL. Defaults to `https://api.open-meteo.com`.
- `geocodingBaseUrl`: Open-Meteo Geocoding API base URL. Defaults to `https://geocoding-api.open-meteo.com`.
- `userAgent`: optional `User-Agent` header for Open-Meteo requests.
- `language`: geocoding result language. Defaults to `en`.
- `forecastDays`: number of forecast days to request. Defaults to `7` and is capped at `16`.
- `hourlyForecastHours`: number of hourly forecast entries returned from the start of the forecast. Defaults to `24` and is capped at `384`. Use `0` to omit hourly output.
- `timezone`: timezone used by Open-Meteo for forecast timestamps. Defaults to `auto`.
- `temperatureUnit`: temperature unit used by Open-Meteo. Defaults to `celsius`. Supported values are `celsius` and `fahrenheit`.
- `windSpeedUnit`: wind speed unit used by Open-Meteo. Defaults to `kmh`. Supported values are `kmh`, `ms`, `mph`, and `kn`.
- `precipitationUnit`: precipitation unit used by Open-Meteo. Defaults to `mm`. Supported values are `mm` and `inch`.
