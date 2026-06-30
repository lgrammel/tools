import { afterEach, describe, expect, it, vi } from "vitest";
import { weather, type WeatherOutput } from "./index.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("weather", () => {
  it("resolves a location, fetches weather, and passes abort signals to requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                id: 2950159,
                name: "Berlin",
                latitude: 52.52,
                longitude: 13.41,
                country: "Germany",
                country_code: "DE",
                timezone: "Europe/Berlin",
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            latitude: 52.52,
            longitude: 13.41,
            timezone: "Europe/Berlin",
            timezone_abbreviation: "GMT+1",
            current_units: {
              temperature_2m: "°C",
            },
            current: {
              time: "2026-06-30T10:00",
              temperature_2m: 21,
              weather_code: 1,
              is_day: 1,
            },
            daily: {
              time: ["2026-06-30"],
              weather_code: [1],
              temperature_2m_max: [24],
              temperature_2m_min: [15],
            },
            hourly: {
              time: ["2026-06-30T10:00", "2026-06-30T11:00"],
              temperature_2m: [21, 22],
              weather_code: [1, 2],
            },
          }),
        ),
      );

    vi.stubGlobal("fetch", fetchMock);
    const abortController = new AbortController();

    if (!weather.execute) {
      throw new Error("weather must be executable.");
    }

    const output = (await weather.execute({ query: "Berlin" }, {
      abortSignal: abortController.signal,
      context: {
        forecastDays: 1,
        hourlyForecastHours: 1,
        userAgent: "test-agent",
      },
    } as never)) as WeatherOutput;

    const [searchUrl, searchInit] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    const [forecastUrl, forecastInit] = fetchMock.mock.calls[1] as unknown as [URL, RequestInit];

    expect(searchUrl.pathname).toBe("/v1/search");
    expect(searchUrl.searchParams.get("name")).toBe("Berlin");
    expect(searchInit.signal).toBe(abortController.signal);
    expect(searchInit.headers).toMatchObject({
      accept: "application/json",
      "user-agent": "test-agent",
    });
    expect(forecastUrl.pathname).toBe("/v1/forecast");
    expect(forecastUrl.searchParams.get("forecast_days")).toBe("1");
    expect(forecastInit.signal).toBe(abortController.signal);
    expect(output).toMatchObject({
      location: {
        name: "Berlin",
        country: "Germany",
      },
      forecast: {
        current: {
          temperature2m: 21,
          weatherDescription: "Mainly clear",
          isDay: true,
        },
        daily: [
          {
            date: "2026-06-30",
            temperature2mMax: 24,
          },
        ],
        hourly: [
          {
            time: "2026-06-30T10:00",
            temperature2m: 21,
          },
        ],
      },
    });
  });
});
