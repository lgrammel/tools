import { format, inspect, type InspectOptions } from "node:util";
import { tool, type Tool } from "ai";
import { z } from "zod";

const DEFAULT_TIMEOUT_MS = 5_000;
const HARD_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;
const HARD_MAX_OUTPUT_BYTES = 1024 * 1024;

const AsyncFunction = async function () {}.constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<unknown>;

export const jsCodeExecutorInputSchema = z.object({
  code: z
    .string()
    .min(1)
    .describe(
      "JavaScript code to execute in the current runtime as an async function body. Use await, return a value, or print values with console.log/console.error.",
    ),
});

export type JsCodeExecutorInput = z.input<typeof jsCodeExecutorInputSchema>;
export type ParsedJsCodeExecutorInput = z.output<typeof jsCodeExecutorInputSchema>;

export interface CreateJsCodeExecutorToolOptions {
  /**
   * Values exposed to executed code as the `context` object.
   */
  context?: Readonly<Record<string, unknown>>;

  /**
   * Maximum time to wait for async code to settle. This cannot interrupt synchronous code that is
   * already running on the event loop.
   */
  timeoutMs?: number;

  /**
   * Maximum combined stdout and stderr bytes retained. Console calls that exceed this limit throw.
   * This is intentionally not model-controlled.
   */
  maxOutputBytes?: number;
}

export interface JsCodeExecutionError {
  name: string;
  message: string;
  stack?: string;
}

export interface JsCodeExecutionOutput {
  result?: string;
  stdout: string;
  stderr: string;
  error?: JsCodeExecutionError;
  timedOut: boolean;
  outputTruncated: boolean;
  durationMs: number;
}

export type JsCodeExecutorTool = Tool<ParsedJsCodeExecutorInput, JsCodeExecutionOutput>;

export class JsCodeExecutor {
  readonly context: Readonly<Record<string, unknown>>;
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;

  constructor(options: CreateJsCodeExecutorToolOptions = {}) {
    this.context = options.context ?? {};
    this.timeoutMs = clampPositiveInteger(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, HARD_TIMEOUT_MS);
    this.maxOutputBytes = clampPositiveInteger(
      options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES,
      HARD_MAX_OUTPUT_BYTES,
    );
  }

  execute(code: string): Promise<JsCodeExecutionOutput> {
    return executeJavaScriptCode(code, {
      context: this.context,
      timeoutMs: this.timeoutMs,
      maxOutputBytes: this.maxOutputBytes,
    });
  }
}

export function jsCodeExecutorTool(
  options: CreateJsCodeExecutorToolOptions = {},
): JsCodeExecutorTool {
  const executor = new JsCodeExecutor(options);

  return tool({
    description:
      "Execute JavaScript code in the current runtime and return the formatted result, stdout, stderr, error status, timeout status, and truncation status.",
    inputSchema: jsCodeExecutorInputSchema,
    execute: async ({ code }) => executor.execute(code),
  });
}

interface NormalizedExecutionOptions {
  context: Readonly<Record<string, unknown>>;
  timeoutMs: number;
  maxOutputBytes: number;
}

async function executeJavaScriptCode(
  code: string,
  options: NormalizedExecutionOptions,
): Promise<JsCodeExecutionOutput> {
  const startedAt = Date.now();
  const output = new OutputCapture(options.maxOutputBytes);

  try {
    const execute = new AsyncFunction("console", "context", `"use strict";\n${code}`);
    const result = await withTimeout(
      execute(createCapturedConsole(output), options.context),
      options.timeoutMs,
    );

    return {
      result: formatExecutionResult(result),
      stdout: output.stdout,
      stderr: output.stderr,
      timedOut: false,
      outputTruncated: output.outputTruncated,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      stdout: output.stdout,
      stderr: output.stderr,
      error: normalizeExecutionError(error),
      timedOut: error instanceof ExecutionTimeoutError,
      outputTruncated: output.outputTruncated,
      durationMs: Date.now() - startedAt,
    };
  }
}

class OutputCapture {
  outputTruncated = false;

  readonly #maxOutputBytes: number;
  #capturedBytes = 0;
  readonly #stdoutChunks: Buffer[] = [];
  readonly #stderrChunks: Buffer[] = [];

  constructor(maxOutputBytes: number) {
    this.#maxOutputBytes = maxOutputBytes;
  }

  get stdout(): string {
    return Buffer.concat(this.#stdoutChunks).toString("utf8");
  }

  get stderr(): string {
    return Buffer.concat(this.#stderrChunks).toString("utf8");
  }

  writeStdout(value: string): void {
    this.#write(value, this.#stdoutChunks);
  }

  writeStderr(value: string): void {
    this.#write(value, this.#stderrChunks);
  }

  #write(value: string, chunks: Buffer[]): void {
    if (this.outputTruncated) {
      throw new OutputLimitExceededError(this.#maxOutputBytes);
    }

    const buffer = Buffer.from(value);
    const remainingBytes = this.#maxOutputBytes - this.#capturedBytes;

    if (buffer.byteLength > remainingBytes) {
      if (remainingBytes > 0) {
        chunks.push(buffer.subarray(0, remainingBytes));
      }

      this.#capturedBytes = this.#maxOutputBytes;
      this.outputTruncated = true;
      throw new OutputLimitExceededError(this.#maxOutputBytes);
    }

    chunks.push(buffer);
    this.#capturedBytes += buffer.byteLength;
  }
}

function createCapturedConsole(output: OutputCapture): Console {
  const timers = new Map<string, number>();

  return {
    assert(condition?: boolean, ...args: unknown[]) {
      if (!condition) {
        output.writeStderr(formatConsoleLine("Assertion failed", ...args));
      }
    },
    clear() {},
    count(label = "default") {
      const count = (timers.get(label) ?? 0) + 1;
      timers.set(label, count);
      output.writeStdout(formatConsoleLine(`${label}: ${count}`));
    },
    countReset(label = "default") {
      timers.delete(label);
    },
    debug(...args: unknown[]) {
      output.writeStdout(formatConsoleLine(...args));
    },
    dir(value: unknown, options?: InspectOptions) {
      output.writeStdout(`${inspect(value, options)}\n`);
    },
    dirxml(...args: unknown[]) {
      output.writeStdout(formatConsoleLine(...args));
    },
    error(...args: unknown[]) {
      output.writeStderr(formatConsoleLine(...args));
    },
    group(...args: unknown[]) {
      if (args.length > 0) {
        output.writeStdout(formatConsoleLine(...args));
      }
    },
    groupCollapsed(...args: unknown[]) {
      if (args.length > 0) {
        output.writeStdout(formatConsoleLine(...args));
      }
    },
    groupEnd() {},
    info(...args: unknown[]) {
      output.writeStdout(formatConsoleLine(...args));
    },
    log(...args: unknown[]) {
      output.writeStdout(formatConsoleLine(...args));
    },
    table(...args: unknown[]) {
      output.writeStdout(formatConsoleLine(...args));
    },
    time(label = "default") {
      timers.set(label, Date.now());
    },
    timeEnd(label = "default") {
      const startedAt = timers.get(label);
      timers.delete(label);
      output.writeStdout(formatConsoleLine(`${label}: ${formatElapsedMs(startedAt)}`));
    },
    timeLog(label = "default", ...args: unknown[]) {
      const startedAt = timers.get(label);
      output.writeStdout(formatConsoleLine(`${label}: ${formatElapsedMs(startedAt)}`, ...args));
    },
    trace(...args: unknown[]) {
      const stack = new Error(format(...args)).stack ?? format(...args);
      output.writeStderr(`${stack}\n`);
    },
    warn(...args: unknown[]) {
      output.writeStderr(formatConsoleLine(...args));
    },
  } as Console;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new ExecutionTimeoutError(timeoutMs)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  });
}

function formatConsoleLine(...args: unknown[]): string {
  return `${format(...args)}\n`;
}

function formatElapsedMs(startedAt: number | undefined): string {
  if (startedAt === undefined) {
    return "timer does not exist";
  }

  return `${Date.now() - startedAt}ms`;
}

function formatExecutionResult(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === "string"
    ? value
    : inspect(value, {
        breakLength: 100,
        depth: 6,
        maxArrayLength: 100,
      });
}

function normalizeExecutionError(error: unknown): JsCodeExecutionError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: "NonErrorThrown",
    message: formatExecutionResult(error) ?? "",
  };
}

class ExecutionTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`JavaScript execution did not complete within ${timeoutMs}ms.`);
    this.name = "ExecutionTimeoutError";
  }
}

class OutputLimitExceededError extends Error {
  constructor(maxOutputBytes: number) {
    super(`JavaScript execution output exceeded ${maxOutputBytes} bytes.`);
    this.name = "OutputLimitExceededError";
  }
}

function clampPositiveInteger(value: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), 1), max);
}
