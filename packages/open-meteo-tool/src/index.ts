import type { Tool, ToolExecutionOptions } from "ai";
import { z } from "zod";

const OPEN_METEO_API_BASE_URL = "https://api.open-meteo.com";
const OPEN_METEO_GEOCODING_BASE_URL = "https://geocoding-api.open-meteo.com";
const DEFAULT_FORECAST_DAYS = 7;
const MAX_FORECAST_DAYS = 16;
const DEFAULT_HOURLY_FORECAST_HOURS = 24;
const HARD_HOURLY_FORECAST_HOURS = 16 * 24;
const MAX_ERROR_BODY_LENGTH = 1_000;

const unitSystemSchema = z.enum(["metric", "imperial"]);

const weatherInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Place name, city, airport, or region to resolve before fetching weather."),
});

const openMeteoContextSchema = z.object({
  baseUrl: z
    .string()
    .url()
    .optional()
    .describe("Open-Meteo Forecast API base URL. Defaults to https://api.open-meteo.com."),
  geocodingBaseUrl: z
    .string()
    .url()
    .optional()
    .describe(
      "Open-Meteo Geocoding API base URL. Defaults to https://geocoding-api.open-meteo.com.",
    ),
  userAgent: z
    .string()
    .min(1)
    .optional()
    .describe("Optional User-Agent header for Open-Meteo requests."),
});

const weatherContextSchema = openMeteoContextSchema.extend({
  language: z.string().min(1).optional().describe("Geocoding result language. Defaults to en."),
  forecastDays: z
    .number()
    .int()
    .positive()
    .max(MAX_FORECAST_DAYS)
    .optional()
    .describe("Number of forecast days to request. Defaults to 7 and is capped at 16."),
  hourlyForecastHours: z
    .number()
    .int()
    .nonnegative()
    .max(HARD_HOURLY_FORECAST_HOURS)
    .optional()
    .describe(
      "Number of hourly forecast entries returned from the start of the forecast. Defaults to 24 and is capped at 384. Use 0 to omit hourly output.",
    ),
  timezone: z
    .string()
    .min(1)
    .optional()
    .describe("Timezone used by Open-Meteo for forecast timestamps. Defaults to auto."),
  units: unitSystemSchema
    .default("metric")
    .describe(
      "Unit system. Metric uses celsius, millimeters, and km/h; imperial uses fahrenheit, inches, and mph.",
    ),
});

const openMeteoLocationResultSchema = z
  .object({
    id: z.number().optional(),
    name: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    elevation: z.number().optional(),
    feature_code: z.string().optional(),
    country_code: z.string().optional(),
    admin1: z.string().optional(),
    admin2: z.string().optional(),
    admin3: z.string().optional(),
    admin4: z.string().optional(),
    timezone: z.string().optional(),
    population: z.number().optional(),
    postcodes: z.array(z.string()).optional(),
    country: z.string().optional(),
  })
  .passthrough();

const openMeteoGeocodingResponseSchema = z
  .object({
    results: z.array(openMeteoLocationResultSchema).optional(),
    generationtime_ms: z.number().optional(),
  })
  .passthrough();

const forecastUnitsSchema = z.record(z.string(), z.string());
const nullableNumberArraySchema = z.array(z.number().nullable());
const nullableStringArraySchema = z.array(z.string().nullable());

const openMeteoCurrentSchema = z
  .object({
    time: z.string().optional(),
    interval: z.number().optional(),
    temperature_2m: z.number().nullable().optional(),
    relative_humidity_2m: z.number().nullable().optional(),
    apparent_temperature: z.number().nullable().optional(),
    is_day: z.number().nullable().optional(),
    precipitation: z.number().nullable().optional(),
    rain: z.number().nullable().optional(),
    showers: z.number().nullable().optional(),
    snowfall: z.number().nullable().optional(),
    weather_code: z.number().nullable().optional(),
    cloud_cover: z.number().nullable().optional(),
    pressure_msl: z.number().nullable().optional(),
    surface_pressure: z.number().nullable().optional(),
    wind_speed_10m: z.number().nullable().optional(),
    wind_direction_10m: z.number().nullable().optional(),
    wind_gusts_10m: z.number().nullable().optional(),
  })
  .passthrough();

const openMeteoHourlySchema = z
  .object({
    time: z.array(z.string()).optional(),
    temperature_2m: nullableNumberArraySchema.optional(),
    apparent_temperature: nullableNumberArraySchema.optional(),
    precipitation_probability: nullableNumberArraySchema.optional(),
    precipitation: nullableNumberArraySchema.optional(),
    weather_code: nullableNumberArraySchema.optional(),
    cloud_cover: nullableNumberArraySchema.optional(),
    wind_speed_10m: nullableNumberArraySchema.optional(),
    wind_direction_10m: nullableNumberArraySchema.optional(),
  })
  .passthrough();

const openMeteoDailySchema = z
  .object({
    time: z.array(z.string()).optional(),
    weather_code: nullableNumberArraySchema.optional(),
    temperature_2m_max: nullableNumberArraySchema.optional(),
    temperature_2m_min: nullableNumberArraySchema.optional(),
    apparent_temperature_max: nullableNumberArraySchema.optional(),
    apparent_temperature_min: nullableNumberArraySchema.optional(),
    sunrise: nullableStringArraySchema.optional(),
    sunset: nullableStringArraySchema.optional(),
    uv_index_max: nullableNumberArraySchema.optional(),
    precipitation_sum: nullableNumberArraySchema.optional(),
    rain_sum: nullableNumberArraySchema.optional(),
    showers_sum: nullableNumberArraySchema.optional(),
    snowfall_sum: nullableNumberArraySchema.optional(),
    precipitation_probability_max: nullableNumberArraySchema.optional(),
    wind_speed_10m_max: nullableNumberArraySchema.optional(),
    wind_gusts_10m_max: nullableNumberArraySchema.optional(),
    wind_direction_10m_dominant: nullableNumberArraySchema.optional(),
  })
  .passthrough();

const openMeteoForecastResponseSchema = z
  .object({
    latitude: z.number(),
    longitude: z.number(),
    generationtime_ms: z.number().optional(),
    utc_offset_seconds: z.number().optional(),
    timezone: z.string().optional(),
    timezone_abbreviation: z.string().optional(),
    elevation: z.number().optional(),
    current_units: forecastUnitsSchema.optional(),
    current: openMeteoCurrentSchema.optional(),
    hourly_units: forecastUnitsSchema.optional(),
    hourly: openMeteoHourlySchema.optional(),
    daily_units: forecastUnitsSchema.optional(),
    daily: openMeteoDailySchema.optional(),
  })
  .passthrough();

type ParsedWeatherInput = z.output<typeof weatherInputSchema>;
type OpenMeteoContext = z.output<typeof openMeteoContextSchema>;
type OpenMeteoRawLocation = z.output<typeof openMeteoLocationResultSchema>;
type OpenMeteoRawForecastResponse = z.output<typeof openMeteoForecastResponseSchema>;
type OpenMeteoRawCurrent = z.output<typeof openMeteoCurrentSchema>;
type OpenMeteoRawHourly = z.output<typeof openMeteoHourlySchema>;
type OpenMeteoRawDaily = z.output<typeof openMeteoDailySchema>;

export type WeatherContext = z.output<typeof weatherContextSchema>;

export interface WeatherLocation {
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  country?: string;
  countryCode?: string;
  admin1?: string;
  admin2?: string;
  admin3?: string;
  admin4?: string;
  timezone?: string;
  population?: number;
  postcodes?: string[];
}

export interface WeatherCurrentReport {
  time: string;
  intervalSeconds?: number;
  temperature2m?: number;
  relativeHumidity2m?: number;
  apparentTemperature?: number;
  isDay?: boolean;
  precipitation?: number;
  rain?: number;
  showers?: number;
  snowfall?: number;
  weatherDescription?: string;
  cloudCover?: number;
  pressureMsl?: number;
  surfacePressure?: number;
  windSpeed10m?: number;
  windDirection10m?: number;
  windGusts10m?: number;
}

export interface WeatherDailyForecast {
  date: string;
  weatherDescription?: string;
  temperature2mMax?: number;
  temperature2mMin?: number;
  apparentTemperatureMax?: number;
  apparentTemperatureMin?: number;
  sunrise?: string;
  sunset?: string;
  uvIndexMax?: number;
  precipitationSum?: number;
  rainSum?: number;
  showersSum?: number;
  snowfallSum?: number;
  precipitationProbabilityMax?: number;
  windSpeed10mMax?: number;
  windGusts10mMax?: number;
  windDirection10mDominant?: number;
}

export interface WeatherHourlyForecast {
  time: string;
  temperature2m?: number;
  apparentTemperature?: number;
  precipitationProbability?: number;
  precipitation?: number;
  weatherDescription?: string;
  cloudCover?: number;
  windSpeed10m?: number;
  windDirection10m?: number;
}

export interface WeatherForecastUnits {
  current: Record<string, string>;
  hourly: Record<string, string>;
  daily: Record<string, string>;
}

export interface WeatherForecastOutput {
  latitude: number;
  longitude: number;
  timezone?: string;
  timezoneAbbreviation?: string;
  utcOffsetSeconds?: number;
  elevation?: number;
  generationtimeMs?: number;
  units: WeatherForecastUnits;
  current?: WeatherCurrentReport;
  daily: WeatherDailyForecast[];
  hourly: WeatherHourlyForecast[];
}

export interface WeatherOutput {
  location: WeatherLocation;
  forecast: WeatherForecastOutput;
}

class WeatherTool {
  readonly description =
    "Resolve a place name through Open-Meteo geocoding, then fetch current weather, daily forecasts, and near-term hourly forecasts for the best matching location.";
  readonly inputSchema = weatherInputSchema;
  readonly contextSchema = weatherContextSchema;

  execute = async (
    { query }: ParsedWeatherInput,
    { context }: ToolExecutionOptions<WeatherContext>,
  ): Promise<WeatherOutput> => {
    const location = await resolveWeatherLocation(query, context);

    if (!location) {
      throw new Error(`Open-Meteo could not resolve a weather location for "${query}".`);
    }

    return {
      location,
      forecast: await fetchWeatherForecast(location.latitude, location.longitude, context),
    };
  };
}

export const weather: Tool<ParsedWeatherInput, WeatherOutput, WeatherContext> = new WeatherTool();

async function resolveWeatherLocation(
  query: string,
  context: WeatherContext,
): Promise<WeatherLocation | undefined> {
  const response = openMeteoGeocodingResponseSchema.parse(
    await getOpenMeteo(
      "/v1/search",
      context.geocodingBaseUrl ?? OPEN_METEO_GEOCODING_BASE_URL,
      {
        name: query,
        count: "1",
        language: context.language ?? "en",
        format: "json",
      },
      context,
    ),
  );

  return (response.results ?? []).map(normalizeLocation).find(isDefined);
}

async function fetchWeatherForecast(
  latitude: number,
  longitude: number,
  context: WeatherContext,
): Promise<WeatherForecastOutput> {
  const forecastDays = clampPositiveInteger(
    context.forecastDays ?? DEFAULT_FORECAST_DAYS,
    MAX_FORECAST_DAYS,
  );
  const hourlyForecastHours = clampNonnegativeInteger(
    context.hourlyForecastHours ?? DEFAULT_HOURLY_FORECAST_HOURS,
    HARD_HOURLY_FORECAST_HOURS,
  );
  const units = getOpenMeteoUnits(context.units);
  const response = openMeteoForecastResponseSchema.parse(
    await getOpenMeteo(
      "/v1/forecast",
      context.baseUrl ?? OPEN_METEO_API_BASE_URL,
      {
        latitude: String(latitude),
        longitude: String(longitude),
        timezone: context.timezone ?? "auto",
        forecast_days: String(forecastDays),
        temperature_unit: units.temperatureUnit,
        wind_speed_unit: units.windSpeedUnit,
        precipitation_unit: units.precipitationUnit,
        current: [
          "temperature_2m",
          "relative_humidity_2m",
          "apparent_temperature",
          "is_day",
          "precipitation",
          "rain",
          "showers",
          "snowfall",
          "weather_code",
          "cloud_cover",
          "pressure_msl",
          "surface_pressure",
          "wind_speed_10m",
          "wind_direction_10m",
          "wind_gusts_10m",
        ].join(","),
        hourly:
          hourlyForecastHours > 0
            ? [
                "temperature_2m",
                "apparent_temperature",
                "precipitation_probability",
                "precipitation",
                "weather_code",
                "cloud_cover",
                "wind_speed_10m",
                "wind_direction_10m",
              ].join(",")
            : undefined,
        daily: [
          "weather_code",
          "temperature_2m_max",
          "temperature_2m_min",
          "apparent_temperature_max",
          "apparent_temperature_min",
          "sunrise",
          "sunset",
          "uv_index_max",
          "precipitation_sum",
          "rain_sum",
          "showers_sum",
          "snowfall_sum",
          "precipitation_probability_max",
          "wind_speed_10m_max",
          "wind_gusts_10m_max",
          "wind_direction_10m_dominant",
        ].join(","),
      },
      context,
    ),
  );

  return normalizeForecast(response, hourlyForecastHours);
}

function getOpenMeteoUnits(units: WeatherContext["units"]): {
  temperatureUnit: "celsius" | "fahrenheit";
  windSpeedUnit: "kmh" | "mph";
  precipitationUnit: "mm" | "inch";
} {
  if (units === "imperial") {
    return {
      temperatureUnit: "fahrenheit",
      windSpeedUnit: "mph",
      precipitationUnit: "inch",
    };
  }

  return {
    temperatureUnit: "celsius",
    windSpeedUnit: "kmh",
    precipitationUnit: "mm",
  };
}

async function getOpenMeteo(
  path: "/v1/search" | "/v1/forecast",
  baseUrl: string,
  params: Record<string, string | undefined>,
  context: OpenMeteoContext,
): Promise<unknown> {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("The Open-Meteo tools require a runtime with global fetch support.");
  }

  const url = new URL(path, baseUrl);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }

  const response = await globalThis.fetch(url, {
    headers: {
      accept: "application/json",
      ...(context.userAgent ? { "user-agent": context.userAgent } : {}),
    },
  });
  const responseBody = await response.text();

  if (!response.ok) {
    throw new Error(formatOpenMeteoHttpError(response, responseBody));
  }

  if (!responseBody) {
    return {};
  }

  try {
    return JSON.parse(responseBody) as unknown;
  } catch {
    throw new Error(`Open-Meteo returned invalid JSON from ${path}.`);
  }
}

function normalizeLocation(result: OpenMeteoRawLocation): WeatherLocation | undefined {
  if (!result.name || result.latitude === undefined || result.longitude === undefined) {
    return undefined;
  }

  return {
    id: result.id,
    name: result.name,
    latitude: result.latitude,
    longitude: result.longitude,
    elevation: result.elevation,
    country: result.country,
    countryCode: result.country_code,
    admin1: result.admin1,
    admin2: result.admin2,
    admin3: result.admin3,
    admin4: result.admin4,
    timezone: result.timezone,
    population: result.population,
    postcodes: result.postcodes,
  };
}

function normalizeForecast(
  response: OpenMeteoRawForecastResponse,
  hourlyForecastHours: number,
): WeatherForecastOutput {
  return {
    latitude: response.latitude,
    longitude: response.longitude,
    timezone: response.timezone,
    timezoneAbbreviation: response.timezone_abbreviation,
    utcOffsetSeconds: response.utc_offset_seconds,
    elevation: response.elevation,
    generationtimeMs: response.generationtime_ms,
    units: {
      current: response.current_units ?? {},
      hourly: response.hourly_units ?? {},
      daily: response.daily_units ?? {},
    },
    current: normalizeCurrentReport(response.current),
    daily: normalizeDailyForecasts(response.daily),
    hourly: normalizeHourlyForecasts(response.hourly, hourlyForecastHours),
  };
}

function normalizeCurrentReport(
  current: OpenMeteoRawCurrent | undefined,
): WeatherCurrentReport | undefined {
  if (!current?.time) {
    return undefined;
  }

  return {
    time: current.time,
    intervalSeconds: current.interval,
    temperature2m: toNumber(current.temperature_2m),
    relativeHumidity2m: toNumber(current.relative_humidity_2m),
    apparentTemperature: toNumber(current.apparent_temperature),
    isDay: toDayBoolean(current.is_day),
    precipitation: toNumber(current.precipitation),
    rain: toNumber(current.rain),
    showers: toNumber(current.showers),
    snowfall: toNumber(current.snowfall),
    weatherDescription: describeWeatherCode(current.weather_code),
    cloudCover: toNumber(current.cloud_cover),
    pressureMsl: toNumber(current.pressure_msl),
    surfacePressure: toNumber(current.surface_pressure),
    windSpeed10m: toNumber(current.wind_speed_10m),
    windDirection10m: toNumber(current.wind_direction_10m),
    windGusts10m: toNumber(current.wind_gusts_10m),
  };
}

function normalizeDailyForecasts(daily: OpenMeteoRawDaily | undefined): WeatherDailyForecast[] {
  const times = daily?.time ?? [];
  const forecasts: WeatherDailyForecast[] = [];

  for (let index = 0; index < times.length; index++) {
    const date = times[index];

    if (!date) {
      continue;
    }

    forecasts.push({
      date,
      weatherDescription: describeWeatherCode(getNumberValue(daily?.weather_code, index)),
      temperature2mMax: getNumberValue(daily?.temperature_2m_max, index),
      temperature2mMin: getNumberValue(daily?.temperature_2m_min, index),
      apparentTemperatureMax: getNumberValue(daily?.apparent_temperature_max, index),
      apparentTemperatureMin: getNumberValue(daily?.apparent_temperature_min, index),
      sunrise: getStringValue(daily?.sunrise, index),
      sunset: getStringValue(daily?.sunset, index),
      uvIndexMax: getNumberValue(daily?.uv_index_max, index),
      precipitationSum: getNumberValue(daily?.precipitation_sum, index),
      rainSum: getNumberValue(daily?.rain_sum, index),
      showersSum: getNumberValue(daily?.showers_sum, index),
      snowfallSum: getNumberValue(daily?.snowfall_sum, index),
      precipitationProbabilityMax: getNumberValue(daily?.precipitation_probability_max, index),
      windSpeed10mMax: getNumberValue(daily?.wind_speed_10m_max, index),
      windGusts10mMax: getNumberValue(daily?.wind_gusts_10m_max, index),
      windDirection10mDominant: getNumberValue(daily?.wind_direction_10m_dominant, index),
    });
  }

  return forecasts;
}

function normalizeHourlyForecasts(
  hourly: OpenMeteoRawHourly | undefined,
  hourlyForecastHours: number,
): WeatherHourlyForecast[] {
  if (hourlyForecastHours === 0) {
    return [];
  }

  const times = hourly?.time?.slice(0, hourlyForecastHours) ?? [];
  const forecasts: WeatherHourlyForecast[] = [];

  for (let index = 0; index < times.length; index++) {
    const time = times[index];

    if (!time) {
      continue;
    }

    forecasts.push({
      time,
      temperature2m: getNumberValue(hourly?.temperature_2m, index),
      apparentTemperature: getNumberValue(hourly?.apparent_temperature, index),
      precipitationProbability: getNumberValue(hourly?.precipitation_probability, index),
      precipitation: getNumberValue(hourly?.precipitation, index),
      weatherDescription: describeWeatherCode(getNumberValue(hourly?.weather_code, index)),
      cloudCover: getNumberValue(hourly?.cloud_cover, index),
      windSpeed10m: getNumberValue(hourly?.wind_speed_10m, index),
      windDirection10m: getNumberValue(hourly?.wind_direction_10m, index),
    });
  }

  return forecasts;
}

function getNumberValue(
  values: readonly (number | null)[] | undefined,
  index: number,
): number | undefined {
  return toNumber(values?.[index]);
}

function getStringValue(
  values: readonly (string | null)[] | undefined,
  index: number,
): string | undefined {
  const value = values?.[index];

  return typeof value === "string" ? value : undefined;
}

function toNumber(value: number | null | undefined): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function toDayBoolean(value: number | null | undefined): boolean | undefined {
  return typeof value === "number" ? value === 1 : undefined;
}

function describeWeatherCode(code: number | null | undefined): string | undefined {
  switch (typeof code === "number" ? Math.trunc(code) : undefined) {
    case 0:
      return "Clear sky";
    case 1:
      return "Mainly clear";
    case 2:
      return "Partly cloudy";
    case 3:
      return "Overcast";
    case 45:
      return "Fog";
    case 48:
      return "Depositing rime fog";
    case 51:
      return "Light drizzle";
    case 53:
      return "Moderate drizzle";
    case 55:
      return "Dense drizzle";
    case 56:
      return "Light freezing drizzle";
    case 57:
      return "Dense freezing drizzle";
    case 61:
      return "Slight rain";
    case 63:
      return "Moderate rain";
    case 65:
      return "Heavy rain";
    case 66:
      return "Light freezing rain";
    case 67:
      return "Heavy freezing rain";
    case 71:
      return "Slight snow fall";
    case 73:
      return "Moderate snow fall";
    case 75:
      return "Heavy snow fall";
    case 77:
      return "Snow grains";
    case 80:
      return "Slight rain showers";
    case 81:
      return "Moderate rain showers";
    case 82:
      return "Violent rain showers";
    case 85:
      return "Slight snow showers";
    case 86:
      return "Heavy snow showers";
    case 95:
      return "Thunderstorm";
    case 96:
      return "Thunderstorm with slight hail";
    case 99:
      return "Thunderstorm with heavy hail";
    default:
      return undefined;
  }
}

function formatOpenMeteoHttpError(response: Response, body: string): string {
  const message = body ? `: ${truncate(body, MAX_ERROR_BODY_LENGTH)}` : "";

  return `Open-Meteo API request failed with ${response.status} ${response.statusText}${message}`;
}

function clampPositiveInteger(value: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), 1), max);
}

function clampNonnegativeInteger(value: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), 0), max);
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
