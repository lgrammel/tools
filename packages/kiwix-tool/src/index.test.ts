import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  searchResults: [] as Array<{ title: string; path: string; snippet: string }>,
  entries: new Map<
    string,
    {
      title: string;
      path: string;
      mimetype: string;
      data: Buffer;
    }
  >(),
}));

vi.mock("@openzim/libzim", () => {
  class OpenConfig {
    preloadXapianDb() {}
    preloadDirentRanges() {}
  }

  class Archive {
    getEntryByPath(path: string) {
      const entry = mocks.entries.get(path);

      if (!entry) {
        throw new Error(`Missing test entry: ${path}`);
      }

      return {
        title: entry.title,
        path: entry.path,
        getItem() {
          return {
            mimetype: entry.mimetype,
            size: entry.data.byteLength,
            getData(offset: number, length: number) {
              return {
                data: entry.data.subarray(offset, offset + length),
              };
            },
          };
        },
      };
    }
  }

  class Searcher {
    search() {
      return {
        getResults(_offset: number, limit: number) {
          return mocks.searchResults.slice(0, limit);
        },
      };
    }
  }

  return {
    Archive,
    OpenConfig,
    Searcher,
  };
});

import { kiwixReadPage, kiwixSearch } from "./index.js";

beforeEach(() => {
  mocks.searchResults = [];
  mocks.entries.clear();
});

describe("kiwixSearch", () => {
  it("cleans snippets and reranks exact title matches before raw order", async () => {
    mocks.searchResults = [
      {
        title: "Other result",
        path: "A/Other_result.html",
        snippet: "<b>Other</b> result",
      },
      {
        title: "Kiwix",
        path: "A/Kiwix.html",
        snippet: "<b>Kiwix</b> offline reader",
      },
    ];

    const output = await kiwixSearch.execute({ query: "Kiwix" }, {
      context: {
        zimPath: "test-search.zim",
        searchResultLimit: 1,
        searchCandidateLimit: 2,
      },
    } as never);

    expect(output).toEqual({
      results: [
        {
          title: "Kiwix",
          path: "A/Kiwix.html",
          snippet: "Kiwix offline reader",
        },
      ],
    });
  });
});

describe("kiwixReadPage", () => {
  it("converts HTML to text and reports byte truncation explicitly", async () => {
    const html = Buffer.from(
      "<main><h1>Kiwix</h1><p>Offline encyclopedia</p><p>😀 trailing</p></main>",
    );

    mocks.entries.set("A/Kiwix.html", {
      title: "Kiwix",
      path: "A/Kiwix.html",
      mimetype: "text/html",
      data: html,
    });

    const output = await kiwixReadPage.execute({ path: "A/Kiwix.html" }, {
      context: {
        zimPath: "test-read.zim",
        readMaxBytes: html.indexOf(" trailing"),
      },
    } as never);

    expect(output.title).toBe("Kiwix");
    expect(output.path).toBe("A/Kiwix.html");
    expect(output.truncated).toBe(true);
    expect(output.content).toContain("KIWIX");
    expect(output.content).toContain("Offline encyclopedia");
    expect(output.content).toContain(`[Content truncated after ${html.indexOf(" trailing")} of`);
    expect(output.content).not.toContain("\uFFFD");
  });
});
