import { describe, expect, it } from "vitest";
import { JsCodeExecutor } from "./index.js";

describe("JsCodeExecutor", () => {
  it("captures return values and console output", async () => {
    const executor = new JsCodeExecutor({
      context: {
        userId: "user_123",
      },
    });

    await expect(
      executor.execute("console.log(context.userId); return { ok: true, rows: [1, 2] };"),
    ).resolves.toMatchObject({
      result: "{ ok: true, rows: [ 1, 2 ] }",
      stdout: "user_123\n",
      stderr: "",
      timedOut: false,
      outputTruncated: false,
    });
  });

  it("reports CPU timeouts", async () => {
    const executor = new JsCodeExecutor({
      timeoutMs: 5,
    });

    const output = await executor.execute("while (true) {}");

    expect(output.timedOut).toBe(true);
    expect(output.error?.message).toMatch(/timed out/i);
  });

  it("caps captured output", async () => {
    const executor = new JsCodeExecutor({
      maxOutputBytes: 4,
    });

    const output = await executor.execute('console.log("abcdef"); return 1;');

    expect(output.stdout).toBe("abcd");
    expect(output.outputTruncated).toBe(true);
    expect(output.error?.name).toBe("OutputLimitExceededError");
  });
});
