import { afterEach, describe, expect, it, vi } from "vitest";
import { webFetch, webSearch } from "./index.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("webSearch", () => {
  it("posts host-controlled search settings and normalizes results", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                id: "https://fallback.example/page",
                title: "",
                author: null,
                highlights: ["", " useful highlight "],
              },
              {
                title: "Ignored by limit",
                url: "https://ignored.example",
              },
            ],
          }),
        ),
    );

    vi.stubGlobal("fetch", fetchMock);
    const abortController = new AbortController();

    const output = await webSearch.execute({ query: "agent tools" }, {
      abortSignal: abortController.signal,
      context: {
        apiKey: "exa-key",
        baseUrl: "https://exa.example",
        searchResultLimit: 1,
      },
    } as never);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];

    expect(url.toString()).toBe("https://exa.example/search");
    expect(init.signal).toBe(abortController.signal);
    expect(init.headers).toMatchObject({
      "content-type": "application/json",
      "x-api-key": "exa-key",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      query: "agent tools",
      numResults: 1,
      type: "auto",
    });
    expect(output).toEqual({
      results: [
        {
          title: "https://fallback.example/page",
          url: "https://fallback.example/page",
          id: "https://fallback.example/page",
          author: undefined,
          publishedDate: undefined,
          highlights: [" useful highlight "],
          image: undefined,
          favicon: undefined,
        },
      ],
    });
  });
});

describe("webFetch", () => {
  it("marks content as truncated when Exa returns the requested maximum", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              results: [
                {
                  title: "Page",
                  url: "https://example.com/page",
                  text: "abcd",
                },
              ],
            }),
          ),
      ),
    );

    await expect(
      webFetch.execute({ url: "https://example.com/page" }, {
        context: {
          apiKey: "exa-key",
          fetchMaxCharacters: 4,
        },
      } as never),
    ).resolves.toMatchObject({
      content: "abcd",
      truncated: true,
    });
  });

  it("passes tool abort signals through to fetch", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                url: "https://example.com/page",
                text: "content",
              },
            ],
          }),
        ),
    );
    const abortController = new AbortController();

    vi.stubGlobal("fetch", fetchMock);

    await webFetch.execute({ url: "https://example.com/page" }, {
      abortSignal: abortController.signal,
      context: {
        apiKey: "exa-key",
      },
    } as never);
    const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];

    expect(init.signal).toBe(abortController.signal);
  });
});
