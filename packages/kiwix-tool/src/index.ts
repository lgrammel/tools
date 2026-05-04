import { tool, type Tool } from "ai";
import type {
  Archive,
  Entry,
  Item,
  Searcher,
  SearchIterator,
  SuggestionIterator,
  SuggestionSearcher
} from "@openzim/libzim";
import { convert as htmlToText } from "html-to-text";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { z } from "zod";

const DEFAULT_RESULT_LIMIT = 5;
const MAX_RESULT_LIMIT = 20;
const DEFAULT_MAX_BYTES = 64 * 1024;
const HARD_MAX_BYTES = 1024 * 1024;

type LibzimModule = typeof import("@openzim/libzim");

const boundedLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_RESULT_LIMIT)
  .default(DEFAULT_RESULT_LIMIT);

const offsetSchema = z.number().int().min(0).default(0);

const maxBytesSchema = z
  .number()
  .int()
  .min(1)
  .max(HARD_MAX_BYTES)
  .default(DEFAULT_MAX_BYTES);

export const kiwixToolInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("metadata").describe("Return metadata about the ZIM archive.")
  }),
  z.object({
    action: z.literal("search").describe("Run a full-text search against the archive."),
    query: z.string().min(1).describe("The search query."),
    limit: boundedLimitSchema.describe("Maximum number of search results to return."),
    offset: offsetSchema.describe("Zero-based result offset.")
  }),
  z.object({
    action: z.literal("suggest").describe("Find title suggestions in the archive."),
    query: z.string().min(1).describe("The title prefix or phrase to suggest."),
    limit: boundedLimitSchema.describe("Maximum number of suggestions to return."),
    offset: offsetSchema.describe("Zero-based result offset.")
  }),
  z.object({
    action: z.literal("readPath").describe("Read an entry by its ZIM path."),
    path: z.string().min(1).describe("The exact ZIM entry path to read."),
    followRedirect: z.boolean().default(true).describe("Whether redirects should be followed."),
    maxBytes: maxBytesSchema.describe("Maximum bytes to read from the entry.")
  }),
  z.object({
    action: z.literal("readTitle").describe("Read an entry by its exact title."),
    title: z.string().min(1).describe("The exact ZIM entry title to read."),
    followRedirect: z.boolean().default(true).describe("Whether redirects should be followed."),
    maxBytes: maxBytesSchema.describe("Maximum bytes to read from the entry.")
  }),
  z.object({
    action: z.literal("readMain").describe("Read the archive's main entry."),
    followRedirect: z.boolean().default(true).describe("Whether redirects should be followed."),
    maxBytes: maxBytesSchema.describe("Maximum bytes to read from the entry.")
  }),
  z.object({
    action: z.literal("readRandom").describe("Read a random archive entry."),
    followRedirect: z.boolean().default(true).describe("Whether redirects should be followed."),
    maxBytes: maxBytesSchema.describe("Maximum bytes to read from the entry.")
  })
]);

export type KiwixToolInput = z.input<typeof kiwixToolInputSchema>;
export type ParsedKiwixToolInput = z.output<typeof kiwixToolInputSchema>;

export interface CreateKiwixToolOptions {
  /**
   * Path to the `.zim` file. A leading `~/` is expanded to the current user's home directory.
   */
  zimPath: string;
  /**
   * Override the model-facing tool description.
   */
  description?: string;
  /**
   * Default maximum bytes to read for entry content.
   */
  defaultMaxBytes?: number;
  /**
   * Preload the full-text index when opening the archive.
   */
  preloadXapianDb?: boolean;
  /**
   * Number of directory entry ranges to preload when opening the archive.
   */
  preloadDirentRanges?: number;
}

export interface KiwixArchiveMetadata {
  type: "metadata";
  zimPath: string;
  filename: string;
  uuid: string;
  filesize: number;
  allEntryCount: number;
  entryCount: number;
  articleCount: number;
  mediaCount: number;
  hasFulltextIndex: boolean;
  hasTitleIndex: boolean;
  hasMainEntry: boolean;
  metadata: Record<string, string>;
  mainEntry?: KiwixEntrySummary;
}

export interface KiwixEntrySummary {
  title: string;
  path: string;
  index: number;
  isRedirect: boolean;
}

export interface KiwixSearchResult extends KiwixEntrySummary {
  score: number;
  snippet?: string;
  wordCount?: number;
}

export interface KiwixSuggestionResult extends KiwixEntrySummary {
  snippet?: string;
}

export interface KiwixSearchResponse {
  type: "search";
  query: string;
  estimatedMatches: number;
  offset: number;
  limit: number;
  results: KiwixSearchResult[];
}

export interface KiwixSuggestionResponse {
  type: "suggest";
  query: string;
  estimatedMatches: number;
  offset: number;
  limit: number;
  results: KiwixSuggestionResult[];
}

export interface KiwixEntryResponse extends KiwixEntrySummary {
  type: "entry";
  mimeType: string;
  size: number;
  bytesRead: number;
  truncated: boolean;
  contentEncoding: "utf8" | "base64";
  content: string;
}

export type KiwixToolOutput =
  | KiwixArchiveMetadata
  | KiwixSearchResponse
  | KiwixSuggestionResponse
  | KiwixEntryResponse;

export type KiwixTool = Tool<ParsedKiwixToolInput, KiwixToolOutput>;

export class KiwixReader {
  readonly zimPath: string;
  readonly defaultMaxBytes: number;

  #libzim?: Promise<LibzimModule>;
  #archive?: Promise<Archive>;
  #searcher?: Searcher;
  #suggestionSearcher?: SuggestionSearcher;
  readonly #options: CreateKiwixToolOptions;

  constructor(options: CreateKiwixToolOptions) {
    this.zimPath = resolveHomePath(options.zimPath);
    this.defaultMaxBytes = clampMaxBytes(options.defaultMaxBytes ?? DEFAULT_MAX_BYTES);
    this.#options = options;
  }

  getArchive(): Promise<Archive> {
    this.#archive ??= this.#openArchive();
    return this.#archive;
  }

  async metadata(): Promise<KiwixArchiveMetadata> {
    const archive = await this.getArchive();
    const metadata = Object.fromEntries(
      archive.metadataKeys.flatMap((key) => {
        try {
          return [[key, archive.getMetadata(key)]];
        } catch {
          return [];
        }
      })
    );

    return {
      type: "metadata",
      zimPath: this.zimPath,
      filename: archive.filename,
      uuid: archive.uuid,
      filesize: toSafeNumber(archive.filesize),
      allEntryCount: archive.allEntryCount,
      entryCount: archive.entryCount,
      articleCount: archive.articleCount,
      mediaCount: archive.mediaCount,
      hasFulltextIndex: archive.hasFulltextIndex(),
      hasTitleIndex: archive.hasTitleIndex(),
      hasMainEntry: archive.hasMainEntry(),
      metadata,
      mainEntry: archive.hasMainEntry() ? summarizeEntry(archive.mainEntry) : undefined
    };
  }

  async search(
    query: string,
    limit = DEFAULT_RESULT_LIMIT,
    offset = 0
  ): Promise<KiwixSearchResponse> {
    const { Searcher } = await this.#loadLibzim();
    this.#searcher ??= new Searcher(await this.getArchive());
    const search = this.#searcher.search(query);
    const results = Array.from(search.getResults(offset, limit) as Iterable<SearchIterator>).map(
      (result) => ({
        ...summarizeEntry(result.entry),
        score: result.score,
        snippet: optionalString(result.snippet),
        wordCount: optionalNumber(result.wordCount)
      })
    );

    return {
      type: "search",
      query,
      estimatedMatches: search.estimatedMatches,
      offset,
      limit,
      results
    };
  }

  async suggest(
    query: string,
    limit = DEFAULT_RESULT_LIMIT,
    offset = 0
  ): Promise<KiwixSuggestionResponse> {
    const { SuggestionSearcher } = await this.#loadLibzim();
    this.#suggestionSearcher ??= new SuggestionSearcher(await this.getArchive());
    const suggestion = this.#suggestionSearcher.suggest(query);
    const results = Array.from(
      suggestion.getResults(offset, limit) as Iterable<SuggestionIterator>
    ).map((result) => ({
      ...summarizeEntry(result.entry),
      snippet: result.hasSnippet ? optionalString(result.snippet) : undefined
    }));

    return {
      type: "suggest",
      query,
      estimatedMatches: suggestion.estimatedMatches,
      offset,
      limit,
      results
    };
  }

  async readPath(path: string, options: ReadEntryOptions = {}): Promise<KiwixEntryResponse> {
    return this.#readEntry((await this.getArchive()).getEntryByPath(path), options);
  }

  async readTitle(title: string, options: ReadEntryOptions = {}): Promise<KiwixEntryResponse> {
    return this.#readEntry((await this.getArchive()).getEntryByTitle(title), options);
  }

  async readMain(options: ReadEntryOptions = {}): Promise<KiwixEntryResponse> {
    return this.#readEntry((await this.getArchive()).mainEntry, options);
  }

  async readRandom(options: ReadEntryOptions = {}): Promise<KiwixEntryResponse> {
    return this.#readEntry((await this.getArchive()).randomEntry, options);
  }

  async execute(input: ParsedKiwixToolInput): Promise<KiwixToolOutput> {
    switch (input.action) {
      case "metadata":
        return this.metadata();
      case "search":
        return this.search(input.query, input.limit, input.offset);
      case "suggest":
        return this.suggest(input.query, input.limit, input.offset);
      case "readPath":
        return this.readPath(input.path, input);
      case "readTitle":
        return this.readTitle(input.title, input);
      case "readMain":
        return this.readMain(input);
      case "readRandom":
        return this.readRandom(input);
    }
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

  #readEntry(entry: Entry, options: ReadEntryOptions): KiwixEntryResponse {
    const maxBytes = clampMaxBytes(options.maxBytes ?? this.defaultMaxBytes);
    const item = entry.getItem(options.followRedirect ?? true);
    const size = toSafeNumber(item.size);
    const bytesToRead = Math.min(maxBytes, size);
    const data = item.getData(0, bytesToRead).data;
    const content = formatContent(item, data);

    return {
      type: "entry",
      ...summarizeEntry(entry),
      mimeType: item.mimetype,
      size,
      bytesRead: data.byteLength,
      truncated: data.byteLength < size,
      contentEncoding: content.encoding,
      content: content.value
    };
  }
}

interface ReadEntryOptions {
  followRedirect?: boolean;
  maxBytes?: number;
}

export function createKiwixTool(options: CreateKiwixToolOptions): KiwixTool {
  const reader = new KiwixReader(options);

  return tool({
    description:
      options.description ??
      "Read and search a local Kiwix/ZIM archive. Use search or suggest first, then readPath or readTitle for the relevant entries.",
    inputSchema: kiwixToolInputSchema,
    execute: async (input): Promise<KiwixToolOutput> => reader.execute(input)
  });
}

export function createKiwixTools(options: CreateKiwixToolOptions): { kiwix: KiwixTool } {
  return {
    kiwix: createKiwixTool(options)
  };
}

function summarizeEntry(entry: Entry): KiwixEntrySummary {
  return {
    title: entry.title,
    path: entry.path,
    index: entry.index,
    isRedirect: entry.isRedirect
  };
}

function formatContent(item: Item, data: Buffer): { encoding: "utf8" | "base64"; value: string } {
  if (!isTextMimeType(item.mimetype)) {
    return {
      encoding: "base64",
      value: data.toString("base64")
    };
  }

  const text = data.toString("utf8");

  if (isHtmlMimeType(item.mimetype)) {
    return {
      encoding: "utf8",
      value: htmlToText(text, {
        baseElements: { selectors: ["body"] },
        selectors: [
          { selector: "a", options: { ignoreHref: true } },
          { selector: "img", format: "skip" },
          { selector: "script", format: "skip" },
          { selector: "style", format: "skip" }
        ],
        wordwrap: false
      })
    };
  }

  return {
    encoding: "utf8",
    value: text
  };
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

function clampMaxBytes(maxBytes: number): number {
  return Math.min(Math.max(Math.trunc(maxBytes), 1), HARD_MAX_BYTES);
}

function toSafeNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

function optionalString(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

function optionalNumber(value: number): number | undefined {
  return Number.isFinite(value) ? value : undefined;
}
