# @lgrammel/open-meteo-tool

AI SDK 7 tool package for weather location lookup, current weather reports, and forecasts through [Open-Meteo](https://open-meteo.com/).

Use it when an agent needs weather data from live coordinates or a human place name. The package calls Open-Meteo with `fetch` directly and does not require an API key.

## Installation

```bash
bun add @lgrammel/open-meteo-tool
```

## Usage

```ts
import { openai } from "@ai-sdk/openai";
import { weatherForecast, weatherLocationSearch } from "@lgrammel/open-meteo-tool";
import { ToolLoopAgent } from "ai";

const agent = new ToolLoopAgent({
  model: openai("gpt-5.5"),
  instructions:
    "Use weather search to resolve place names to coordinates, then use weather forecast for current conditions and forecasts. Mention the location and units in the answer.",
  tools: {
    weatherLocationSearch,
    weatherForecast,
  },
});

const result = await agent.generate({
  prompt: "Will I need an umbrella in Berlin tomorrow?",
});

console.log(result.text);
```

## Tools

- `weatherLocationSearch`: searches Open-Meteo geocoding. Input is `{ query }`. Output is `results` with `name`, coordinates, country, administrative regions, timezone, population, and optional metadata.
- `weatherForecast`: fetches current weather, daily forecasts, and near-term hourly forecasts. Input is `{ latitude, longitude }`. Output includes location metadata, units, `current`, `daily`, and `hourly`.

The model cannot choose result count, forecast horizon, units, timezone, API hosts, or returned hourly output size. These are configured through each tool's `toolsContext` entry, validated by that tool's `contextSchema`, so tool outputs stay predictable for agents.

## API

Use the exported tools directly and pass tool-specific configuration through `toolsContext`:

```ts
import { weatherForecast, weatherLocationSearch } from "@lgrammel/open-meteo-tool";

const tools = {
  weatherLocationSearch,
  weatherForecast,
};

const toolsContext = {
  weatherLocationSearch: {
    locationResultLimit: 5,
    language: "en",
  },
  weatherForecast: {
    forecastDays: 7,
    hourlyForecastHours: 24,
    timezone: "auto",
    temperatureUnit: "celsius",
    windSpeedUnit: "kmh",
    precipitationUnit: "mm",
  },
};
```

## Shared Open-Meteo Context

- `baseUrl`: Open-Meteo Forecast API base URL. Defaults to `https://api.open-meteo.com`.
- `geocodingBaseUrl`: Open-Meteo Geocoding API base URL. Defaults to `https://geocoding-api.open-meteo.com`.
- `userAgent`: optional `User-Agent` header for Open-Meteo requests.

## Location Search Context

- `locationResultLimit`: fixed number of location candidates returned to the agent. Defaults to `5` and is capped at `10`.
- `language`: geocoding result language. Defaults to `en`.

## Forecast Context

- `forecastDays`: number of forecast days to request. Defaults to `7` and is capped at `16`.
- `hourlyForecastHours`: number of hourly forecast entries returned from the start of the forecast. Defaults to `24` and is capped at `384`. Use `0` to omit hourly output.
- `timezone`: timezone used by Open-Meteo for forecast timestamps. Defaults to `auto`.
- `temperatureUnit`: temperature unit. Defaults to `celsius`.
- `windSpeedUnit`: wind speed unit. Defaults to `kmh`.
- `precipitationUnit`: precipitation unit. Defaults to `mm`.
