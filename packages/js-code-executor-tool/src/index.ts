import { spawn } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { tool, type Tool } from "ai";
import { z } from "zod";

const DEFAULT_TIMEOUT_MS = 5_000;
const HARD_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;
const HARD_MAX_OUTPUT_BYTES = 1024 * 1024;
const TERMINATION_GRACE_MS = 1_000;

export const jsCodeExecutorInputSchema = z.object({
  code: z
    .string()
    .min(1)
    .describe(
      "JavaScript module code to execute in a local Node.js subprocess. Print values with console.log or console.error.",
    ),
});

export type JsCodeExecutorInput = z.input<typeof jsCodeExecutorInputSchema>;
export type ParsedJsCodeExecutorInput = z.output<typeof jsCodeExecutorInputSchema>;

export interface CreateJsCodeExecutorToolOptions {
  /**
   * Working directory for the subprocess. Defaults to the current process working directory.
   */
  cwd?: string;

  /**
   * Environment variables exposed to the subprocess. Defaults to an empty environment.
   */
  env?: NodeJS.ProcessEnv;

  /**
   * Inherit the parent process environment before applying `env`. Defaults to false to avoid
   * exposing credentials accidentally.
   */
  inheritEnv?: boolean;

  /**
   * Node.js executable used for execution. Defaults to the current Node.js executable.
   */
  nodePath?: string;

  /**
   * Additional arguments passed to Node.js before the code is provided on stdin.
   */
  nodeArgs?: readonly string[];

  /**
   * Maximum runtime before the subprocess is terminated. This is intentionally not model-controlled.
   */
  timeoutMs?: number;

  /**
   * Maximum combined stdout and stderr bytes retained before the subprocess is terminated.
   * This is intentionally not model-controlled.
   */
  maxOutputBytes?: number;
}

export interface JsCodeExecutionOutput {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  outputTruncated: boolean;
  durationMs: number;
}

export type JsCodeExecutorTool = Tool<ParsedJsCodeExecutorInput, JsCodeExecutionOutput>;

export class JsCodeExecutor {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly nodePath: string;
  readonly nodeArgs: readonly string[];
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;

  constructor(options: CreateJsCodeExecutorToolOptions = {}) {
    this.cwd = resolveCwd(options.cwd);
    this.env = options.inheritEnv ? { ...process.env, ...options.env } : { ...options.env };
    this.nodePath = options.nodePath ?? process.execPath;
    this.nodeArgs = options.nodeArgs ?? [];
    this.timeoutMs = clampPositiveInteger(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, HARD_TIMEOUT_MS);
    this.maxOutputBytes = clampPositiveInteger(
      options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES,
      HARD_MAX_OUTPUT_BYTES,
    );
  }

  execute(code: string): Promise<JsCodeExecutionOutput> {
    return executeJavaScriptCode(code, {
      cwd: this.cwd,
      env: this.env,
      nodePath: this.nodePath,
      nodeArgs: this.nodeArgs,
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
      "Execute JavaScript code in a local Node.js subprocess and return stdout, stderr, exit status, timeout status, and truncation status.",
    inputSchema: jsCodeExecutorInputSchema,
    execute: async ({ code }) => executor.execute(code),
  });
}

interface NormalizedExecutionOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
  nodePath: string;
  nodeArgs: readonly string[];
  timeoutMs: number;
  maxOutputBytes: number;
}

function executeJavaScriptCode(
  code: string,
  options: NormalizedExecutionOptions,
): Promise<JsCodeExecutionOutput> {
  const startedAt = Date.now();
  const child = spawn(options.nodePath, ["--input-type=module", ...options.nodeArgs], {
    cwd: options.cwd,
    env: options.env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let timedOut = false;
  let outputTruncated = false;
  let capturedBytes = 0;
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  const timeout = setTimeout(() => {
    timedOut = true;
    terminate(child);
  }, options.timeoutMs);

  child.stdout.on("data", (chunk: Buffer) => {
    captureOutput(chunk, stdoutChunks);
  });

  child.stderr.on("data", (chunk: Buffer) => {
    captureOutput(chunk, stderrChunks);
  });

  child.stdin.end(code);

  return new Promise((resolve, reject) => {
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.once("close", (exitCode, signal) => {
      clearTimeout(timeout);
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        exitCode,
        signal,
        timedOut,
        outputTruncated,
        durationMs: Date.now() - startedAt,
      });
    });
  });

  function captureOutput(chunk: Buffer, chunks: Buffer[]): void {
    if (capturedBytes >= options.maxOutputBytes) {
      outputTruncated = true;
      terminate(child);
      return;
    }

    const remainingBytes = options.maxOutputBytes - capturedBytes;

    if (chunk.byteLength > remainingBytes) {
      chunks.push(chunk.subarray(0, remainingBytes));
      capturedBytes = options.maxOutputBytes;
      outputTruncated = true;
      terminate(child);
      return;
    }

    chunks.push(chunk);
    capturedBytes += chunk.byteLength;
  }
}

function terminate(child: ReturnType<typeof spawn>): void {
  if (child.killed) {
    return;
  }

  child.kill("SIGTERM");

  setTimeout(() => {
    if (!child.killed) {
      child.kill("SIGKILL");
    }
  }, TERMINATION_GRACE_MS).unref();
}

function resolveCwd(cwd: string | undefined): string {
  if (cwd === undefined) {
    return process.cwd();
  }

  return isAbsolute(cwd) ? cwd : join(process.cwd(), cwd);
}

function clampPositiveInteger(value: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), 1), max);
}
