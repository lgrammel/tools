import { expectTypeOf } from "vitest";
import { ToolLoopAgent } from "ai";
import { weather, type WeatherContext } from "./index.js";

expectTypeOf(
  new ToolLoopAgent({
    model: "openai/gpt-5.5",
    tools: {
      weather,
    },
  }),
).toBeObject();

expectTypeOf<WeatherContext>().toMatchTypeOf<
  | {
      temperatureUnit?: "celsius" | "fahrenheit";
      windSpeedUnit?: "kmh" | "ms" | "mph" | "kn";
      precipitationUnit?: "mm" | "inch";
    }
  | undefined
>();

expectTypeOf<{ units: "imperial" }>().not.toMatchTypeOf<WeatherContext>();

expectTypeOf(
  new ToolLoopAgent({
    model: "openai/gpt-5.5",
    tools: {
      weather,
    },
  }),
).toBeObject();
