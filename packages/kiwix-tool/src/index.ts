import type { Tool, ToolExecutionOptions } from "ai";
import type { Archive, Item, Searcher, SearchIterator } from "@openzim/libzim";
import { convert as htmlToText } from "html-to-text";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { z } from "zod";

const DEFAULT_SEARCH_RESULT_LIMIT = 5;
const MAX_SEARCH_RESULT_LIMIT = 10;
const DEFAULT_READ_MAX_BYTES = 80 * 1024;
const HARD_READ_MAX_BYTES = 512 * 1024;
const MAX_SNIPPET_LENGTH = 600;

type LibzimModule = typeof import("@openzim/libzim");

const kiwixSearchInputSchema = z.object({
  query: z.string().min(1).describe("Full-text search query for the Kiwix archive."),
});

const kiwixReadInputSchema = z.object({
  path: z.string().min(1).describe("Exact ZIM page path returned by the search tool."),
});

const kiwixArchiveContextSchema = z.object({
  zimPath: z
    .string()
    .min(1)
    .describe(
      "Path to the `.zim` file. A leading `~/` is expanded to the current user's home directory.",
    ),
  preloadXapianDb: z
    .boolean()
    .optional()
    .describe("Preload the full-text index when opening the archive. Defaults to true."),
  preloadDirentRanges: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Number of directory entry ranges to preload when opening the archive."),
});

const kiwixSearchContextSchema = kiwixArchiveContextSchema.extend({
  searchResultLimit: z
    .number()
    .int()
    .positive()
    .max(MAX_SEARCH_RESULT_LIMIT)
    .optional()
    .describe(
      "Fixed number of search results returned to the agent. Defaults to 5 and is capped at 10.",
    ),
});

const kiwixReadPageContextSchema = kiwixArchiveContextSchema.extend({
  readMaxBytes: z
    .number()
    .int()
    .positive()
    .max(HARD_READ_MAX_BYTES)
    .optional()
    .describe("Fixed maximum page bytes read before HTML-to-text conversion. Defaults to 81920."),
});

type ParsedKiwixSearchInput = z.output<typeof kiwixSearchInputSchema>;
type ParsedKiwixReadInput = z.output<typeof kiwixReadInputSchema>;
type KiwixArchiveContext = z.output<typeof kiwixArchiveContextSchema>;
type KiwixSearchContext = z.output<typeof kiwixSearchContextSchema>;
type KiwixReadPageContext = z.output<typeof kiwixReadPageContextSchema>;

interface KiwixSearchResult {
  title: string;
  path: string;
  snippet?: string;
}

interface KiwixSearchOutput {
  results: KiwixSearchResult[];
}

interface KiwixReadOutput {
  title: string;
  path: string;
  content: string;
  truncated: boolean;
}

class KiwixArchive {
  readonly zimPath: string;

  #archive?: Promise<Archive>;
  #libzim?: Promise<LibzimModule>;
  readonly #context: KiwixArchiveContext;

  constructor(context: KiwixArchiveContext) {
    this.zimPath = resolveHomePath(context.zimPath);
    this.#context = context;
  }

  get(): Promise<Archive> {
    this.#archive ??= this.#openArchive();
    return this.#archive;
  }

  loadLibzim(): Promise<LibzimModule> {
    this.#libzim ??= import("@openzim/libzim");
    return this.#libzim;
  }

  async #openArchive(): Promise<Archive> {
    const { Archive, OpenConfig } = await this.loadLibzim();
    const config = new OpenConfig();

    config.preloadXapianDb(this.#context.preloadXapianDb ?? true);

    if (this.#context.preloadDirentRanges !== undefined) {
      config.preloadDirentRanges(this.#context.preloadDirentRanges);
    }

    return new Archive(this.zimPath, config);
  }
}

class KiwixSearchTool {
  readonly description =
    "Search the local Kiwix archive. Returns page paths, titles, and short snippets. Use the read tool with a returned path to read a page.";
  readonly inputSchema = kiwixSearchInputSchema;
  readonly contextSchema = kiwixSearchContextSchema;

  #searcher?: Searcher;
  #archive?: KiwixArchive;
  #archiveCacheKey?: string;

  execute = async (
    { query }: ParsedKiwixSearchInput,
    { context }: ToolExecutionOptions<KiwixSearchContext>,
  ): Promise<KiwixSearchOutput> => {
    const archive = this.#getArchive(context);
    const { Searcher } = await archive.loadLibzim();
    this.#searcher ??= new Searcher(await archive.get());
    const search = this.#searcher.search(query);
    const searchResultLimit = clampSearchResultLimit(
      context.searchResultLimit ?? DEFAULT_SEARCH_RESULT_LIMIT,
    );
    const results = Array.from(
      search.getResults(0, searchResultLimit) as Iterable<SearchIterator>,
    ).map((result) => ({
      title: result.title,
      path: result.path,
      snippet: cleanSnippet(result.snippet),
    }));

    return { results };
  };

  #getArchive(context: KiwixSearchContext): KiwixArchive {
    const archiveCacheKey = getArchiveCacheKey(context);

    if (archiveCacheKey !== this.#archiveCacheKey) {
      this.#archive = new KiwixArchive(context);
      this.#archiveCacheKey = archiveCacheKey;
      this.#searcher = undefined;
    }

    if (!this.#archive) {
      throw new Error("Kiwix archive was not initialized.");
    }

    return this.#archive;
  }
}

class KiwixReadPageTool {
  readonly description =
    "Read one page from the local Kiwix archive by exact path from the search tool.";
  readonly inputSchema = kiwixReadInputSchema;
  readonly contextSchema = kiwixReadPageContextSchema;

  #archive?: KiwixArchive;
  #archiveCacheKey?: string;

  execute = async (
    { path }: ParsedKiwixReadInput,
    { context }: ToolExecutionOptions<KiwixReadPageContext>,
  ): Promise<KiwixReadOutput> => {
    const entry = (await this.#getArchive(context).get()).getEntryByPath(path);
    const item = entry.getItem(true);
    const size = toSafeNumber(item.size);
    const readMaxBytes = clampReadMaxBytes(context.readMaxBytes ?? DEFAULT_READ_MAX_BYTES);
    const data = item.getData(0, Math.min(readMaxBytes, size)).data;

    return {
      title: entry.title,
      path: entry.path,
      content: formatPageContent(item, data),
      truncated: data.byteLength < size,
    };
  };

  #getArchive(context: KiwixReadPageContext): KiwixArchive {
    const archiveCacheKey = getArchiveCacheKey(context);

    if (archiveCacheKey !== this.#archiveCacheKey) {
      this.#archive = new KiwixArchive(context);
      this.#archiveCacheKey = archiveCacheKey;
    }

    if (!this.#archive) {
      throw new Error("Kiwix archive was not initialized.");
    }

    return this.#archive;
  }
}

export const kiwixSearch = new KiwixSearchTool() satisfies Tool<
  ParsedKiwixSearchInput,
  KiwixSearchOutput,
  KiwixSearchContext
>;

export const kiwixReadPage = new KiwixReadPageTool() satisfies Tool<
  ParsedKiwixReadInput,
  KiwixReadOutput,
  KiwixReadPageContext
>;

function getArchiveCacheKey(context: KiwixArchiveContext): string {
  return JSON.stringify({
    zimPath: resolveHomePath(context.zimPath),
    preloadXapianDb: context.preloadXapianDb,
    preloadDirentRanges: context.preloadDirentRanges,
  });
}

function formatPageContent(item: Item, data: Buffer): string {
  if (!isTextMimeType(item.mimetype)) {
    return `[${item.mimetype} content omitted: this Kiwix entry is not a text page.]`;
  }

  const text = data.toString("utf8");

  if (!isHtmlMimeType(item.mimetype)) {
    return text;
  }

  return htmlToText(text, {
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
      { selector: "script", format: "skip" },
      { selector: "style", format: "skip" },
    ],
    wordwrap: false,
  });
}

function cleanSnippet(snippet: string): string | undefined {
  const text = htmlToText(snippet, { wordwrap: false }).replace(/\s+/g, " ").trim();

  if (!text) {
    return undefined;
  }

  return text.length > MAX_SNIPPET_LENGTH ? `${text.slice(0, MAX_SNIPPET_LENGTH).trim()}...` : text;
}

function isTextMimeType(mimeType: string): boolean {
  return (
    mimeType.startsWith("text/") ||
    isHtmlMimeType(mimeType) ||
    mimeType === "application/json" ||
    mimeType === "application/xml" ||
    mimeType === "application/xhtml+xml" ||
    mimeType.endsWith("+json") ||
    mimeType.endsWith("+xml")
  );
}

function isHtmlMimeType(mimeType: string): boolean {
  return mimeType === "text/html" || mimeType === "application/xhtml+xml";
}

function resolveHomePath(path: string): string {
  if (path === "~") {
    return homedir();
  }

  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }

  return isAbsolute(path) ? path : join(process.cwd(), path);
}

function clampSearchResultLimit(limit: number): number {
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_SEARCH_RESULT_LIMIT);
}

function clampReadMaxBytes(maxBytes: number): number {
  return Math.min(Math.max(Math.trunc(maxBytes), 1), HARD_READ_MAX_BYTES);
}

function toSafeNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}
