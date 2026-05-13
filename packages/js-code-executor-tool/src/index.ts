import ivm from "isolated-vm";
import { inspect } from "node:util";
import { tool, type Tool } from "ai";
import { z } from "zod";

const DEFAULT_TIMEOUT_MS = 5_000;
const HARD_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;
const HARD_MAX_OUTPUT_BYTES = 1024 * 1024;
const DEFAULT_MEMORY_LIMIT_MB = 8;
const HARD_MEMORY_LIMIT_MB = 128;

export const jsCodeExecutorInputSchema = z.object({
  code: z
    .string()
    .min(1)
    .describe(
      "JavaScript code to execute in an isolated in-process V8 isolate. Use await, return a value, or print values with console.log/console.error.",
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

  /**
   * Maximum V8 isolate heap size. This is intentionally not model-controlled.
   */
  memoryLimitMb?: number;
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
  readonly memoryLimitMb: number;

  constructor(options: CreateJsCodeExecutorToolOptions = {}) {
    this.context = options.context ?? {};
    this.timeoutMs = clampPositiveInteger(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, HARD_TIMEOUT_MS);
    this.maxOutputBytes = clampPositiveInteger(
      options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES,
      HARD_MAX_OUTPUT_BYTES,
    );
    this.memoryLimitMb = clampPositiveInteger(
      options.memoryLimitMb ?? DEFAULT_MEMORY_LIMIT_MB,
      HARD_MEMORY_LIMIT_MB,
    );
  }

  execute(code: string): Promise<JsCodeExecutionOutput> {
    return executeJavaScriptCode(code, {
      context: this.context,
      timeoutMs: this.timeoutMs,
      maxOutputBytes: this.maxOutputBytes,
      memoryLimitMb: this.memoryLimitMb,
    });
  }
}

export function jsCodeExecutorTool(
  options: CreateJsCodeExecutorToolOptions = {},
): JsCodeExecutorTool {
  const executor = new JsCodeExecutor(options);

  return tool({
    description:
      "Execute JavaScript code in an isolated in-process V8 isolate and return the formatted result, stdout, stderr, error status, timeout status, and truncation status.",
    inputSchema: jsCodeExecutorInputSchema,
    execute: async ({ code }) => executor.execute(code),
  });
}

interface NormalizedExecutionOptions {
  context: Readonly<Record<string, unknown>>;
  timeoutMs: number;
  maxOutputBytes: number;
  memoryLimitMb: number;
}

async function executeJavaScriptCode(
  code: string,
  options: NormalizedExecutionOptions,
): Promise<JsCodeExecutionOutput> {
  const startedAt = Date.now();
  const output = new OutputCapture(options.maxOutputBytes);
  const isolate = new ivm.Isolate({ memoryLimit: options.memoryLimitMb });

  try {
    const isolateContext = await isolate.createContext({ inspector: false });
    await initializeIsolateContext(isolateContext, output, options.context, options.timeoutMs);
    const script = await isolate.compileScript(
      `"use strict";
const __userCode = async () => {
${code}
};
globalThis.__formatExecutionResult(await __userCode());`,
      { filename: "js-code-executor.js" },
    );
    const result = await script.run(isolateContext, {
      promise: true,
      timeout: options.timeoutMs,
    });

    return {
      result: typeof result === "string" ? result : undefined,
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
      timedOut: isTimeoutError(error),
      outputTruncated: output.outputTruncated,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    isolate.dispose();
  }
}

async function initializeIsolateContext(
  context: ivm.Context,
  output: OutputCapture,
  hostContext: Readonly<Record<string, unknown>>,
  timeoutMs: number,
): Promise<void> {
  const jail = context.global;

  await jail.set("globalThis", jail.derefInto());
  await jail.set("__context", new ivm.ExternalCopy(hostContext).copyInto());
  await jail.set("__writeStdout", new ivm.Callback((value: unknown) => {
    output.writeStdout(`${value}`);
  }));
  await jail.set("__writeStderr", new ivm.Callback((value: unknown) => {
    output.writeStderr(`${value}`);
  }));

  await context.eval(
    `"use strict";
const context = Object.freeze(__context);
const formatConsoleLine = (...args) => args.map((value) => {
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return value.toString() + "n";
  if (typeof value === "symbol") return value.toString();
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === "undefined") return "undefined";
  if (typeof value === "function") return value.toString();

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}).join(" ") + "\\n";
const timers = new Map();
const console = Object.freeze({
  assert(condition, ...args) {
    if (!condition) __writeStderr(formatConsoleLine("Assertion failed", ...args));
  },
  clear() {},
  count(label = "default") {
    const count = (timers.get(label) || 0) + 1;
    timers.set(label, count);
    __writeStdout(formatConsoleLine(label + ": " + count));
  },
  countReset(label = "default") {
    timers.delete(label);
  },
  debug(...args) {
    __writeStdout(formatConsoleLine(...args));
  },
  dir(value) {
    __writeStdout(formatConsoleLine(value));
  },
  dirxml(...args) {
    __writeStdout(formatConsoleLine(...args));
  },
  error(...args) {
    __writeStderr(formatConsoleLine(...args));
  },
  group(...args) {
    if (args.length > 0) __writeStdout(formatConsoleLine(...args));
  },
  groupCollapsed(...args) {
    if (args.length > 0) __writeStdout(formatConsoleLine(...args));
  },
  groupEnd() {},
  info(...args) {
    __writeStdout(formatConsoleLine(...args));
  },
  log(...args) {
    __writeStdout(formatConsoleLine(...args));
  },
  table(...args) {
    __writeStdout(formatConsoleLine(...args));
  },
  time(label = "default") {
    timers.set(label, Date.now());
  },
  timeEnd(label = "default") {
    const startedAt = timers.get(label);
    timers.delete(label);
    __writeStdout(formatConsoleLine(label + ": " + (startedAt === undefined ? "timer does not exist" : Date.now() - startedAt + "ms")));
  },
  timeLog(label = "default", ...args) {
    const startedAt = timers.get(label);
    __writeStdout(formatConsoleLine(label + ": " + (startedAt === undefined ? "timer does not exist" : Date.now() - startedAt + "ms"), ...args));
  },
  trace(...args) {
    __writeStderr((new Error(args.join(" ")).stack || formatConsoleLine(...args)) + "\\n");
  },
  warn(...args) {
    __writeStderr(formatConsoleLine(...args));
  },
});
globalThis.context = context;
globalThis.console = console;
globalThis.__formatExecutionResult = (value) => {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : formatConsoleLine(value).trimEnd();
};`,
    { timeout: timeoutMs },
  );
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

class OutputLimitExceededError extends Error {
  constructor(maxOutputBytes: number) {
    super(`JavaScript execution output exceeded ${maxOutputBytes} bytes.`);
    this.name = "OutputLimitExceededError";
  }
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && /Script execution timed out|execution timed out/i.test(error.message);
}

function clampPositiveInteger(value: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), 1), max);
}
