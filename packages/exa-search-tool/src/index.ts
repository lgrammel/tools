import type { Tool, ToolExecutionOptions } from "ai";
import { z } from "zod";

const EXA_API_BASE_URL = "https://api.exa.ai";
const DEFAULT_SEARCH_RESULT_LIMIT = 5;
const MAX_SEARCH_RESULT_LIMIT = 10;
const DEFAULT_HIGHLIGHT_MAX_CHARACTERS = 1_000;
const HARD_HIGHLIGHT_MAX_CHARACTERS = 4_000;
const DEFAULT_FETCH_MAX_CHARACTERS = 80 * 1024;
const HARD_FETCH_MAX_CHARACTERS = 512 * 1024;
const MAX_ERROR_BODY_LENGTH = 1_000;

const searchTypeSchema = z.enum([
  "auto",
  "neural",
  "fast",
  "deep-lite",
  "deep",
  "deep-reasoning",
  "instant",
]);

const textVerbositySchema = z.enum(["compact", "standard", "full"]);

const contentSectionSchema = z.enum([
  "header",
  "navigation",
  "banner",
  "body",
  "sidebar",
  "footer",
  "metadata",
]);

const webSearchInputSchema = z.object({
  query: z.string().min(1).describe("Web search query to run with Exa."),
});

const webFetchInputSchema = z.object({
  url: z.string().url().describe("Exact URL to fetch, usually one returned by webSearch."),
});

const exaContextSchema = z.object({
  apiKey: z.string().min(1).describe("Exa API key used as the x-api-key request header."),
  baseUrl: z
    .string()
    .url()
    .optional()
    .describe("Exa API base URL. Defaults to https://api.exa.ai."),
  maxAgeHours: z
    .number()
    .int()
    .min(-1)
    .optional()
    .describe(
      "Maximum accepted age of cached Exa content in hours. Use 0 to always live crawl and -1 to always use cache.",
    ),
});

const webSearchContextSchema = exaContextSchema.extend({
  searchResultLimit: z
    .number()
    .int()
    .positive()
    .max(MAX_SEARCH_RESULT_LIMIT)
    .optional()
    .describe(
      "Fixed number of search results returned to the agent. Defaults to 5 and is capped at 10.",
    ),
  searchType: searchTypeSchema.optional().describe("Exa search type. Defaults to auto."),
  highlightMaxCharacters: z
    .number()
    .int()
    .positive()
    .max(HARD_HIGHLIGHT_MAX_CHARACTERS)
    .optional()
    .describe("Maximum highlight characters per result. Defaults to 1000 and is capped at 4000."),
  includeDomains: z
    .array(z.string().min(1))
    .max(1_200)
    .optional()
    .describe("Domains to restrict search results to."),
  excludeDomains: z
    .array(z.string().min(1))
    .max(1_200)
    .optional()
    .describe("Domains to exclude from search results."),
});

const webFetchContextSchema = exaContextSchema.extend({
  fetchMaxCharacters: z
    .number()
    .int()
    .positive()
    .max(HARD_FETCH_MAX_CHARACTERS)
    .optional()
    .describe("Maximum page text characters returned. Defaults to 81920 and is capped at 524288."),
  textVerbosity: textVerbositySchema
    .optional()
    .describe("Exa text verbosity. Defaults to compact."),
  includeHtmlTags: z
    .boolean()
    .optional()
    .describe("Include HTML tags in returned page text. Defaults to false."),
  includeSections: z
    .array(contentSectionSchema)
    .optional()
    .describe("Semantic page sections to include when Exa live crawls the page."),
  excludeSections: z
    .array(contentSectionSchema)
    .optional()
    .describe("Semantic page sections to exclude when Exa live crawls the page."),
});

const exaResultSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    url: z.string().optional(),
    publishedDate: z.string().nullable().optional(),
    author: z.string().nullable().optional(),
    image: z.string().optional(),
    favicon: z.string().optional(),
    text: z.string().optional(),
    highlights: z.array(z.string()).optional(),
  })
  .passthrough();

const exaSearchResponseSchema = z
  .object({
    requestId: z.string().optional(),
    results: z.array(exaResultSchema).optional(),
    searchType: z.string().optional(),
  })
  .passthrough();

const exaContentStatusSchema = z
  .object({
    id: z.string().optional(),
    status: z.string().optional(),
    error: z.unknown().optional(),
  })
  .passthrough();

const exaContentsResponseSchema = z
  .object({
    requestId: z.string().optional(),
    results: z.array(exaResultSchema).optional(),
    statuses: z.array(exaContentStatusSchema).optional(),
  })
  .passthrough();

type ParsedWebSearchInput = z.output<typeof webSearchInputSchema>;
type ParsedWebFetchInput = z.output<typeof webFetchInputSchema>;
type ExaContext = z.output<typeof exaContextSchema>;
type ExaRawResult = z.output<typeof exaResultSchema>;

export type WebSearchContext = z.output<typeof webSearchContextSchema>;
export type WebFetchContext = z.output<typeof webFetchContextSchema>;

export interface WebSearchResult {
  title: string;
  url: string;
  id?: string;
  publishedDate?: string;
  author?: string;
  highlights?: string[];
  image?: string;
  favicon?: string;
}

export interface WebSearchOutput {
  results: WebSearchResult[];
}

export interface WebFetchOutput {
  title: string;
  url: string;
  id?: string;
  publishedDate?: string;
  author?: string;
  content: string;
  truncated: boolean;
}

class WebSearchTool {
  readonly description =
    "Search the web with Exa. Returns URLs, titles, and relevant highlights. Use webFetch with a returned URL to read a page.";
  readonly inputSchema = webSearchInputSchema;
  readonly contextSchema = webSearchContextSchema;

  execute = async (
    { query }: ParsedWebSearchInput,
    { abortSignal, context }: ToolExecutionOptions<WebSearchContext>,
  ): Promise<WebSearchOutput> => {
    const searchResultLimit = clampPositiveInteger(
      context.searchResultLimit ?? DEFAULT_SEARCH_RESULT_LIMIT,
      MAX_SEARCH_RESULT_LIMIT,
    );
    const highlightMaxCharacters = clampPositiveInteger(
      context.highlightMaxCharacters ?? DEFAULT_HIGHLIGHT_MAX_CHARACTERS,
      HARD_HIGHLIGHT_MAX_CHARACTERS,
    );
    const response = exaSearchResponseSchema.parse(
      await postExa("/search", context, abortSignal, {
        query,
        type: context.searchType ?? "auto",
        numResults: searchResultLimit,
        includeDomains: context.includeDomains,
        excludeDomains: context.excludeDomains,
        contents: {
          highlights: {
            maxCharacters: highlightMaxCharacters,
          },
          maxAgeHours: context.maxAgeHours,
        },
      }),
    );

    return {
      results: (response.results ?? [])
        .map(normalizeSearchResult)
        .filter(isDefined)
        .slice(0, searchResultLimit),
    };
  };
}

class WebFetchTool {
  readonly description = "Fetch clean, LLM-ready page text for a URL using Exa.";
  readonly inputSchema = webFetchInputSchema;
  readonly contextSchema = webFetchContextSchema;

  execute = async (
    { url }: ParsedWebFetchInput,
    { abortSignal, context }: ToolExecutionOptions<WebFetchContext>,
  ): Promise<WebFetchOutput> => {
    const fetchMaxCharacters = clampPositiveInteger(
      context.fetchMaxCharacters ?? DEFAULT_FETCH_MAX_CHARACTERS,
      HARD_FETCH_MAX_CHARACTERS,
    );
    const response = exaContentsResponseSchema.parse(
      await postExa("/contents", context, abortSignal, {
        urls: [url],
        text: {
          maxCharacters: fetchMaxCharacters,
          includeHtmlTags: context.includeHtmlTags ?? false,
          verbosity: context.textVerbosity ?? "compact",
          includeSections: context.includeSections,
          excludeSections: context.excludeSections,
        },
        maxAgeHours: context.maxAgeHours,
      }),
    );
    const result = response.results?.[0];

    if (!result) {
      throw new Error(formatMissingContentError(url, response.statuses ?? []));
    }

    const normalizedResult = normalizeFetchResult(result, fetchMaxCharacters);

    if (!normalizedResult) {
      throw new Error(`Exa did not return page content for ${url}.`);
    }

    return normalizedResult;
  };
}

export const webSearch = new WebSearchTool() satisfies Tool<
  ParsedWebSearchInput,
  WebSearchOutput,
  WebSearchContext
>;

export const webFetch = new WebFetchTool() satisfies Tool<
  ParsedWebFetchInput,
  WebFetchOutput,
  WebFetchContext
>;

async function postExa(
  path: "/search" | "/contents",
  context: ExaContext,
  abortSignal: AbortSignal | undefined,
  body: unknown,
): Promise<unknown> {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("The Exa tools require a runtime with global fetch support.");
  }

  const response = await globalThis.fetch(new URL(path, context.baseUrl ?? EXA_API_BASE_URL), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": context.apiKey,
    },
    body: JSON.stringify(removeUndefinedDeep(body)),
    signal: abortSignal,
  });
  const responseBody = await response.text();

  if (!response.ok) {
    throw new Error(formatExaHttpError(response, responseBody));
  }

  if (!responseBody) {
    return {};
  }

  try {
    return JSON.parse(responseBody) as unknown;
  } catch {
    throw new Error(`Exa returned invalid JSON from ${path}.`);
  }
}

function normalizeSearchResult(result: ExaRawResult): WebSearchResult | undefined {
  const url = getResultUrl(result);

  if (!url) {
    return undefined;
  }

  return {
    title: result.title?.trim() || url,
    url,
    id: result.id,
    publishedDate: result.publishedDate ?? undefined,
    author: result.author ?? undefined,
    highlights: result.highlights?.filter((highlight) => highlight.trim().length > 0),
    image: result.image,
    favicon: result.favicon,
  };
}

function normalizeFetchResult(
  result: ExaRawResult,
  fetchMaxCharacters: number,
): WebFetchOutput | undefined {
  const url = getResultUrl(result);

  if (!url) {
    return undefined;
  }

  const content = result.text ?? "";

  return {
    title: result.title?.trim() || url,
    url,
    id: result.id,
    publishedDate: result.publishedDate ?? undefined,
    author: result.author ?? undefined,
    content,
    truncated: content.length >= fetchMaxCharacters,
  };
}

function getResultUrl(result: ExaRawResult): string | undefined {
  return result.url ?? (isHttpUrl(result.id) ? result.id : undefined);
}

function formatMissingContentError(
  url: string,
  statuses: z.output<typeof exaContentStatusSchema>[],
): string {
  const matchingStatus = statuses.find((status) => status.id === url) ?? statuses[0];

  if (!matchingStatus) {
    return `Exa did not return content for ${url}.`;
  }

  return `Exa did not return content for ${url}: ${safeJsonStringify(matchingStatus)}`;
}

function formatExaHttpError(response: Response, body: string): string {
  const message = body ? `: ${truncate(body, MAX_ERROR_BODY_LENGTH)}` : "";

  return `Exa API request failed with ${response.status} ${response.statusText}${message}`;
}

function clampPositiveInteger(value: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), 1), max);
}

function removeUndefinedDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedDeep);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, property]) => property !== undefined)
      .map(([key, property]) => [key, removeUndefinedDeep(property)]),
  );
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isHttpUrl(value: string | undefined): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
