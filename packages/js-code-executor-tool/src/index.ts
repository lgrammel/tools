import { inspect } from "node:util";
import vm from "node:vm";
import { tool, type Tool } from "ai";
import { z } from "zod";

const DEFAULT_TIMEOUT_MS = 5_000;
const HARD_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;
const HARD_MAX_OUTPUT_BYTES = 1024 * 1024;

export const jsCodeExecutorInputSchema = z.object({
  code: z
    .string()
    .min(1)
    .describe(
      "JavaScript code to execute in an in-process Node.js vm context. Use await, return a value, or print values with console.log/console.error.",
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
   * Maximum execution time. This is intentionally not model-controlled.
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
      "Execute JavaScript code in an in-process Node.js vm context and return the formatted result, stdout, stderr, error status, timeout status, and truncation status.",
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
    const script = new vm.Script(
      `globalThis.__executionSettled = false;
globalThis.__executionResult = undefined;
globalThis.__executionError = undefined;
(async () => {
"use strict";
${code}
})()
  .then((value) => {
    globalThis.__executionSettled = true;
    globalThis.__executionResult = __formatExecutionResult(value);
  })
  .catch((error) => {
    globalThis.__executionSettled = true;
    globalThis.__executionError = __formatExecutionError(error);
  });`,
      { filename: "js-code-executor.js" },
    );
    const vmContext = vm.createContext(createSandbox(output, options.context), {
      microtaskMode: "afterEvaluate",
    });
    script.runInContext(vmContext, { timeout: options.timeoutMs });
    const executionError = vmContext.__executionSettled
      ? vmContext.__executionError
      : normalizeExecutionError(new ExecutionTimeoutError(options.timeoutMs));

    return {
      result:
        typeof vmContext.__executionResult === "string" ? vmContext.__executionResult : undefined,
      stdout: output.stdout,
      stderr: output.stderr,
      error: executionError,
      timedOut: !vmContext.__executionSettled,
      outputTruncated: output.outputTruncated,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      stdout: output.stdout,
      stderr: output.stderr,
      error: normalizeExecutionError(error),
      timedOut: isTimeoutError(error),
      outputTruncated: output.outputTruncated,
      durationMs: Date.now() - startedAt,
    };
  }
}

interface SandboxGlobal {
  console: Console;
  context: Readonly<Record<string, unknown>>;
  __executionError?: JsCodeExecutionError;
  __executionResult?: string;
  __executionSettled?: boolean;
  __formatExecutionError: (error: unknown) => JsCodeExecutionError;
  __formatExecutionResult: (value: unknown) => string | undefined;
}

function createSandbox(
  output: OutputCapture,
  context: Readonly<Record<string, unknown>>,
): SandboxGlobal {
  return {
    console: createCapturedConsole(output),
    context: deepFreeze(structuredClone(context)),
    __formatExecutionError: normalizeExecutionError,
    __formatExecutionResult: formatExecutionResult,
  };
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
    dir(value: unknown) {
      output.writeStdout(`${formatExecutionResult(value) ?? "undefined"}\n`);
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
      const stack = new Error(formatConsoleLine(...args).trimEnd()).stack;
      output.writeStderr(`${stack ?? formatConsoleLine(...args)}`);
    },
    warn(...args: unknown[]) {
      output.writeStderr(formatConsoleLine(...args));
    },
  } as Console;
}

function formatConsoleLine(...args: unknown[]): string {
  return `${args.map((value) => formatExecutionResult(value) ?? "undefined").join(" ")}\n`;
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
  if (isErrorLike(error)) {
    return {
      name: typeof error.name === "string" ? error.name : "Error",
      message: typeof error.message === "string" ? error.message : "",
      stack: typeof error.stack === "string" ? error.stack : undefined,
    };
  }

  return {
    name: "NonErrorThrown",
    message: formatExecutionResult(error) ?? "",
  };
}

class OutputLimitExceededError extends Error {
  constructor(maxOutputBytes: number) {
    super(`JavaScript execution output exceeded ${maxOutputBytes} bytes.`);
    this.name = "OutputLimitExceededError";
  }
}

class ExecutionTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`JavaScript execution did not complete within ${timeoutMs}ms.`);
    this.name = "ExecutionTimeoutError";
  }
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof ExecutionTimeoutError ||
    (isErrorLike(error) &&
      typeof error.message === "string" &&
      /Script execution timed out/i.test(error.message))
  );
}

function clampPositiveInteger(value: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), 1), max);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }

  for (const property of Object.values(value)) {
    deepFreeze(property);
  }

  return Object.freeze(value);
}

function isErrorLike(
  error: unknown,
): error is { message?: unknown; name?: unknown; stack?: unknown } {
  return typeof error === "object" && error !== null && "message" in error;
}
