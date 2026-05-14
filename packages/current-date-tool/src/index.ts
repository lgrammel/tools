import type { Tool, ToolExecutionOptions } from "ai";
import { z } from "zod";

const currentDateInputSchema = z.object({});

const currentDateContextSchema = z.object({
  timezone: z
    .string()
    .min(1)
    .describe("IANA timezone used to format the current date and time, for example Europe/Berlin."),
});

type ParsedCurrentDateInput = z.output<typeof currentDateInputSchema>;

export type CurrentDateContext = z.output<typeof currentDateContextSchema>;

export interface CurrentDateOutput {
  /**
   * The current instant in UTC.
   */
  iso: string;

  /**
   * Timezone abbreviation for the current instant.
   */
  timezoneName: string;

  /**
   * Localized date and time in YYYY-MM-DDTHH:mm:ss format.
   */
  datetime: string;
}

class CurrentDateTool {
  readonly description =
    "Return the current date and time in the configured timezone. Use this when the current date, current time, today, or now is needed.";
  readonly inputSchema = currentDateInputSchema;
  readonly contextSchema = currentDateContextSchema;

  execute = async (
    _input: ParsedCurrentDateInput,
    { context }: ToolExecutionOptions<CurrentDateContext>,
  ): Promise<CurrentDateOutput> => {
    const now = new Date();

    return formatCurrentDate(now, context.timezone);
  };
}

export const currentDate: Tool<ParsedCurrentDateInput, CurrentDateOutput, CurrentDateContext> =
  new CurrentDateTool();

function formatCurrentDate(now: Date, timezone: string): CurrentDateOutput {
  const parts = getDateTimeParts(now, timezone);
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}:${parts.second}`;
  const timezoneName = getTimezoneName(now, timezone);

  return {
    iso: now.toISOString(),
    timezoneName,
    datetime: `${date}T${time}`,
  };
}

function getDateTimeParts(
  date: Date,
  timezone: string,
): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return {
    year: getRequiredPart(parts, "year", timezone),
    month: getRequiredPart(parts, "month", timezone),
    day: getRequiredPart(parts, "day", timezone),
    hour: getRequiredPart(parts, "hour", timezone),
    minute: getRequiredPart(parts, "minute", timezone),
    second: getRequiredPart(parts, "second", timezone),
  };
}

function getTimezoneName(date: Date, timezone: string): string {
  const value = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    timeZoneName: "short",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  if (!value) {
    throw new Error(`Unable to format timezone name for timezone ${timezone}.`);
  }

  return value;
}

function getRequiredPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
  timezone: string,
): string {
  const value = parts.find((part) => part.type === type)?.value;

  if (!value) {
    throw new Error(`Unable to format current date for timezone ${timezone}.`);
  }

  return value;
}
