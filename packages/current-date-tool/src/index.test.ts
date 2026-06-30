import { describe, expect, it } from "vitest";
import { currentDate, type CurrentDateOutput } from "./index.js";

describe("currentDate", () => {
  it("returns the documented date fields for the configured timezone", async () => {
    if (!currentDate.execute) {
      throw new Error("currentDate must be executable.");
    }

    const before = Date.now();
    const output = (await currentDate.execute({}, {
      context: {
        timezone: "UTC",
      },
    } as never)) as CurrentDateOutput;
    const after = Date.now();

    expect(output.iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(output.timezone).toBe("UTC");
    expect(output.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(output.time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(output.datetime).toBe(`${output.date}T${output.time}`);
    expect(output.utcOffset).toBe("+00:00");
    expect(output.timezoneName).toBe("UTC");
    expect(output.timestamp).toBeGreaterThanOrEqual(before);
    expect(output.timestamp).toBeLessThanOrEqual(after);
  });
});
