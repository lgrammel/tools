import { tool, type Tool } from "ai";
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

export const kiwixSearchInputSchema = z.object({
  query: z.string().min(1).describe("Full-text search query for the Kiwix archive."),
});

export const kiwixReadInputSchema = z.object({
  path: z.string().min(1).describe("Exact ZIM page path returned by the search tool."),
});

export type KiwixSearchInput = z.input<typeof kiwixSearchInputSchema>;
export type ParsedKiwixSearchInput = z.output<typeof kiwixSearchInputSchema>;
export type KiwixReadInput = z.input<typeof kiwixReadInputSchema>;
export type ParsedKiwixReadInput = z.output<typeof kiwixReadInputSchema>;

export interface CreateKiwixToolOptions {
  /**
   * Path to the `.zim` file. A leading `~/` is expanded to the current user's home directory.
   */
  zimPath: string;
  /**
   * Fixed number of search results returned to the agent. This is intentionally not model-controlled.
   */
  searchResultLimit?: number;
  /**
   * Fixed maximum page bytes read before HTML-to-text conversion. This is intentionally not model-controlled.
   */
  readMaxBytes?: number;
  /**
   * Preload the full-text index when opening the archive.
   */
  preloadXapianDb?: boolean;
  /**
   * Number of directory entry ranges to preload when opening the archive.
   */
  preloadDirentRanges?: number;
}

export interface KiwixSearchResult {
  title: string;
  path: string;
  snippet?: string;
}

export interface KiwixSearchOutput {
  results: KiwixSearchResult[];
}

export interface KiwixReadOutput {
  title: string;
  path: string;
  content: string;
  truncated: boolean;
}

export type KiwixSearchTool = Tool<ParsedKiwixSearchInput, KiwixSearchOutput>;
export type KiwixReadTool = Tool<ParsedKiwixReadInput, KiwixReadOutput>;

export class KiwixReader {
  readonly zimPath: string;
  readonly searchResultLimit: number;
  readonly readMaxBytes: number;

  #archive?: Promise<Archive>;
  #libzim?: Promise<LibzimModule>;
  #searcher?: Searcher;
  readonly #options: CreateKiwixToolOptions;

  constructor(options: CreateKiwixToolOptions) {
    this.zimPath = resolveHomePath(options.zimPath);
    this.searchResultLimit = clampSearchResultLimit(
      options.searchResultLimit ?? DEFAULT_SEARCH_RESULT_LIMIT,
    );
    this.readMaxBytes = clampReadMaxBytes(options.readMaxBytes ?? DEFAULT_READ_MAX_BYTES);
    this.#options = options;
  }

  async search(query: string): Promise<KiwixSearchOutput> {
    const { Searcher } = await this.#loadLibzim();
    this.#searcher ??= new Searcher(await this.#getArchive());
    const search = this.#searcher.search(query);
    const results = Array.from(
      search.getResults(0, this.searchResultLimit) as Iterable<SearchIterator>,
    ).map((result) => ({
      title: result.title,
      path: result.path,
      snippet: cleanSnippet(result.snippet),
    }));

    return { results };
  }

  async readPath(path: string): Promise<KiwixReadOutput> {
    const entry = (await this.#getArchive()).getEntryByPath(path);
    const item = entry.getItem(true);
    const size = toSafeNumber(item.size);
    const data = item.getData(0, Math.min(this.readMaxBytes, size)).data;

    return {
      title: entry.title,
      path: entry.path,
      content: formatPageContent(item, data),
      truncated: data.byteLength < size,
    };
  }

  #getArchive(): Promise<Archive> {
    this.#archive ??= this.#openArchive();
    return this.#archive;
  }

  async #openArchive(): Promise<Archive> {
    const { Archive, OpenConfig } = await this.#loadLibzim();
    const config = new OpenConfig();

    if (this.#options.preloadXapianDb !== undefined) {
      config.preloadXapianDb(this.#options.preloadXapianDb);
    }

    if (this.#options.preloadDirentRanges !== undefined) {
      config.preloadDirentRanges(this.#options.preloadDirentRanges);
    }

    return new Archive(this.zimPath, config);
  }

  #loadLibzim(): Promise<LibzimModule> {
    this.#libzim ??= import("@openzim/libzim");
    return this.#libzim;
  }
}

export class KiwixTools {
  readonly reader: KiwixReader;

  #searchTool?: KiwixSearchTool;
  #readTool?: KiwixReadTool;

  constructor(options: CreateKiwixToolOptions) {
    this.reader = new KiwixReader(options);
  }

  get searchTool(): KiwixSearchTool {
    this.#searchTool ??= kiwixSearchTool(this.reader);
    return this.#searchTool;
  }

  get readTool(): KiwixReadTool {
    this.#readTool ??= kiwixReadTool(this.reader);
    return this.#readTool;
  }
}

export function createKiwixSearchTool(options: CreateKiwixToolOptions): KiwixSearchTool {
  const reader = new KiwixReader(options);
  return kiwixSearchTool(reader);
}

export function createKiwixReadTool(options: CreateKiwixToolOptions): KiwixReadTool {
  const reader = new KiwixReader(options);
  return kiwixReadTool(reader);
}

export function kiwixSearchTool(reader: KiwixReader): KiwixSearchTool {
  return tool({
    description:
      "Search the local Kiwix archive. Returns page paths, titles, and short snippets. Use the read tool with a returned path to read a page.",
    inputSchema: kiwixSearchInputSchema,
    execute: async ({ query }) => reader.search(query),
  });
}

export function kiwixReadTool(reader: KiwixReader): KiwixReadTool {
  return tool({
    description: "Read one page from the local Kiwix archive by exact path from the search tool.",
    inputSchema: kiwixReadInputSchema,
    execute: async ({ path }) => reader.readPath(path),
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
