# @lgrammel/open-meteo-tool

AI SDK 7 tool package for resolving place names and fetching current weather reports and forecasts through [Open-Meteo](https://open-meteo.com/).

Use it when an agent needs weather data from live coordinates or a human place name. The package calls Open-Meteo with `fetch` directly and does not require an API key.

## Installation

```bash
bun add @lgrammel/open-meteo-tool
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
  toolsContext: {
    weather: {
      units: "metric",
    },
  },
});

const result = await agent.generate({
  prompt: "Will I need an umbrella in Berlin tomorrow?",
});

console.log(result.text);
```

## Tools

- `weather`: resolves a place name through Open-Meteo geocoding, then fetches current weather, daily forecasts, and near-term hourly forecasts for the best matching location. Input is `{ query }`. Output includes the resolved `location` and `forecast`.

The model cannot choose result count, forecast horizon, units, timezone, API hosts, or returned hourly output size. These are configured through each tool's `toolsContext` entry, validated by that tool's `contextSchema`, so tool outputs stay predictable for agents. The combined `weather` tool uses one geocoding result internally.

## API

Use the combined tool directly and pass configuration through `toolsContext`:

```ts
import { weather } from "@lgrammel/open-meteo-tool";

const tools = {
  weather,
};

const toolsContext = {
  weather: {
    language: "en",
    forecastDays: 7,
    hourlyForecastHours: 24,
    timezone: "auto",
    units: "metric",
  },
};
```

## Shared Open-Meteo Context

- `baseUrl`: Open-Meteo Forecast API base URL. Defaults to `https://api.open-meteo.com`.
- `geocodingBaseUrl`: Open-Meteo Geocoding API base URL. Defaults to `https://geocoding-api.open-meteo.com`.
- `userAgent`: optional `User-Agent` header for Open-Meteo requests.

## Weather Context

- `language`: geocoding result language. Defaults to `en`.
- `forecastDays`: number of forecast days to request. Defaults to `7` and is capped at `16`.
- `hourlyForecastHours`: number of hourly forecast entries returned from the start of the forecast. Defaults to `24` and is capped at `384`. Use `0` to omit hourly output.
- `timezone`: timezone used by Open-Meteo for forecast timestamps. Defaults to `auto`.
- `units`: unit system. `metric` uses celsius, millimeters, and km/h; `imperial` uses fahrenheit, inches, and mph.
