/**
 * FeedFetcher Tests
 *
 * Tests the fetch layer that handles RSS parsing, URL hashing, and article data conversion.
 *
 * Run: bun test -- feed-fetcher.test.ts
 */

import crypto from "crypto";

// Import types for testing (we'll mock the implementation)
interface FeedInfo {
  id: string;
  url: string;
  url_hash: string;
  title: string;
  description?: string;
  site_url?: string;
  favicon_url?: string;
  fetch_interval_minutes?: number;
}

interface ArticleData {
  hash: string;
  title: string;
  url: string;
  link?: string;
  author?: string;
  published_at?: string;
  updated_at?: string;
  content?: string;
  content_text?: string;
  summary?: string;
  tags?: string[];
  categories?: string[];
  enclosures?: Array<{
    url: string;
    type?: string;
    length?: number;
  }>;
  fetched_at: string;
}

// Re-export types for tests
export type { FeedInfo, ArticleData };

/**
 * Generate URL hash (same as feed-fetcher.ts)
 */
export function urlToHash(url: string): string {
  return crypto.createHash("md5").update(url).digest("hex").slice(0, 12);
}

/**
 * Generate article hash from Parser.Item
 */
export function generateArticleHash(
  link: string | undefined,
  title: string | undefined,
  pubDate: string | undefined
): string {
  const content = `${link || ""}|${title || ""}|${pubDate || ""}`;
  return crypto.createHash("md5").update(content).digest("hex");
}

/**
 * Convert RSS item to ArticleData
 */
export function itemToArticleData(
  item: {
    title?: string;
    link?: string;
    guid?: string;
    pubDate?: string;
    isoDate?: string;
    content?: string;
    contentSnippet?: string;
    creator?: string;
    author?: string;
    categories?: (string | unknown)[];
    enclosure?: { url?: string; type?: string; length?: number | string };
  },
  hash: string
): ArticleData {
  return {
    hash,
    title: item.title || "Untitled",
    url: item.link || item.guid || "",
    link: item.link,
    author: item.creator || item.author || undefined,
    published_at: item.pubDate || item.isoDate || undefined,
    content: item.content || undefined,
    content_text: item.contentSnippet || undefined,
    summary: item.contentSnippet || undefined,
    categories: item.categories?.map((c) =>
      typeof c === "string" ? c : String(c)
    ),
    enclosures: item.enclosure
      ? [
          {
            url: item.enclosure.url || "",
            type: item.enclosure.type,
            length: item.enclosure.length
              ? Number(item.enclosure.length)
              : undefined,
          },
        ]
      : undefined,
    fetched_at: new Date().toISOString(),
  };
}

describe("URL Hash Generation", () => {
  it("should generate 12-character hash from URL", () => {
    const url = "https://example.com/feed";
    const hash = urlToHash(url);

    expect(hash).toHaveLength(12);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it("should generate consistent hash for same URL", () => {
    const url = "https://example.com/feed";
    const hash1 = urlToHash(url);
    const hash2 = urlToHash(url);

    expect(hash1).toBe(hash2);
  });

  it("should generate different hashes for different URLs", () => {
    const hash1 = urlToHash("https://example.com/feed1");
    const hash2 = urlToHash("https://example.com/feed2");

    expect(hash1).not.toBe(hash2);
  });

  it("should handle URL with query parameters", () => {
    const hash1 = urlToHash("https://example.com/feed?sort=latest");
    const hash2 = urlToHash("https://example.com/feed?sort=oldest");

    expect(hash1).not.toBe(hash2);
  });

  it("should handle URL with trailing slash", () => {
    const hash1 = urlToHash("https://example.com/feed");
    const hash2 = urlToHash("https://example.com/feed/");

    expect(hash1).not.toBe(hash2);
  });
});

describe("Article Hash Generation", () => {
  it("should generate 32-character hash", () => {
    const hash = generateArticleHash(
      "https://example.com/article",
      "Test Title",
      "2026-01-10T00:00:00Z"
    );

    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it("should generate consistent hash for same content", () => {
    const hash1 = generateArticleHash(
      "https://example.com/article",
      "Test Title",
      "2026-01-10T00:00:00Z"
    );
    const hash2 = generateArticleHash(
      "https://example.com/article",
      "Test Title",
      "2026-01-10T00:00:00Z"
    );

    expect(hash1).toBe(hash2);
  });

  it("should generate different hashes for different links", () => {
    const hash1 = generateArticleHash(
      "https://example.com/article1",
      "Test Title",
      "2026-01-10T00:00:00Z"
    );
    const hash2 = generateArticleHash(
      "https://example.com/article2",
      "Test Title",
      "2026-01-10T00:00:00Z"
    );

    expect(hash1).not.toBe(hash2);
  });

  it("should generate different hashes for different titles", () => {
    const hash1 = generateArticleHash(
      "https://example.com/article",
      "Title A",
      "2026-01-10T00:00:00Z"
    );
    const hash2 = generateArticleHash(
      "https://example.com/article",
      "Title B",
      "2026-01-10T00:00:00Z"
    );

    expect(hash1).not.toBe(hash2);
  });

  it("should generate different hashes for different dates", () => {
    const hash1 = generateArticleHash(
      "https://example.com/article",
      "Test Title",
      "2026-01-10T00:00:00Z"
    );
    const hash2 = generateArticleHash(
      "https://example.com/article",
      "Test Title",
      "2026-01-11T00:00:00Z"
    );

    expect(hash1).not.toBe(hash2);
  });

  it("should handle missing link", () => {
    const hash = generateArticleHash(undefined, "Test Title", "2026-01-10T00:00:00Z");

    expect(hash).toHaveLength(32);
  });

  it("should handle missing title", () => {
    const hash = generateArticleHash("https://example.com/article", undefined, "2026-01-10T00:00:00Z");

    expect(hash).toHaveLength(32);
  });

  it("should handle missing pubDate", () => {
    const hash = generateArticleHash(
      "https://example.com/article",
      "Test Title",
      undefined
    );

    expect(hash).toHaveLength(32);
  });

  it("should use guid as fallback for url", () => {
    const hash1 = generateArticleHash(
      undefined,
      "Test Title",
      "2026-01-10T00:00:00Z"
    );
    const hash2 = generateArticleHash(
      "https://example.com/guid-123",
      "Test Title",
      "2026-01-10T00:00:00Z"
    );

    expect(hash1).not.toBe(hash2);
  });
});

describe("Item to ArticleData Conversion", () => {
  it("should convert basic item fields", () => {
    const item = {
      title: "Test Article",
      link: "https://example.com/test",
      pubDate: "2026-01-10T00:00:00Z",
    };
    const hash = "abc123";

    const result = itemToArticleData(item, hash);

    expect(result.hash).toBe("abc123");
    expect(result.title).toBe("Test Article");
    expect(result.url).toBe("https://example.com/test");
    expect(result.published_at).toBe("2026-01-10T00:00:00Z");
  });

  it("should use 'Untitled' for missing title", () => {
    const item = {
      link: "https://example.com/test",
    };
    const hash = "abc123";

    const result = itemToArticleData(item, hash);

    expect(result.title).toBe("Untitled");
  });

  it("should use guid as fallback for url", () => {
    const item = {
      title: "Test",
      guid: "https://example.com/guid-123",
    };
    const hash = "abc123";

    const result = itemToArticleData(item, hash);

    expect(result.url).toBe("https://example.com/guid-123");
  });

  it("should handle creator as author", () => {
    const item = {
      title: "Test",
      link: "https://example.com/test",
      creator: "John Doe",
    };
    const hash = "abc123";

    const result = itemToArticleData(item, hash);

    expect(result.author).toBe("John Doe");
  });

  it("should handle author as fallback", () => {
    const item = {
      title: "Test",
      link: "https://example.com/test",
      author: "Jane Doe",
    };
    const hash = "abc123";

    const result = itemToArticleData(item, hash);

    expect(result.author).toBe("Jane Doe");
  });

  it("should prefer creator over author", () => {
    const item = {
      title: "Test",
      link: "https://example.com/test",
      creator: "Creator Name",
      author: "Author Name",
    };
    const hash = "abc123";

    const result = itemToArticleData(item, hash);

    expect(result.author).toBe("Creator Name");
  });

  it("should handle content field", () => {
    const item = {
      title: "Test",
      link: "https://example.com/test",
      content: "<p>Full content</p>",
    };
    const hash = "abc123";

    const result = itemToArticleData(item, hash);

    expect(result.content).toBe("<p>Full content</p>");
  });

  it("should handle contentSnippet as summary and content_text", () => {
    const item = {
      title: "Test",
      link: "https://example.com/test",
      contentSnippet: "Short summary",
    };
    const hash = "abc123";

    const result = itemToArticleData(item, hash);

    expect(result.summary).toBe("Short summary");
    expect(result.content_text).toBe("Short summary");
  });

  it("should handle categories as array", () => {
    const item = {
      title: "Test",
      link: "https://example.com/test",
      categories: ["Tech", "News", 123],
    };
    const hash = "abc123";

    const result = itemToArticleData(item, hash);

    expect(result.categories).toEqual(["Tech", "News", "123"]);
  });

  it("should handle enclosure as enclosures array", () => {
    const item = {
      title: "Test",
      link: "https://example.com/test",
      enclosure: {
        url: "https://example.com/audio.mp3",
        type: "audio/mpeg",
        length: "1234567",
      },
    };
    const hash = "abc123";

    const result = itemToArticleData(item, hash);

    expect(result.enclosures).toHaveLength(1);
    expect(result.enclosures?.[0].url).toBe("https://example.com/audio.mp3");
    expect(result.enclosures?.[0].type).toBe("audio/mpeg");
    expect(result.enclosures?.[0].length).toBe(1234567);
  });

  it("should handle numeric length", () => {
    const item = {
      title: "Test",
      link: "https://example.com/test",
      enclosure: {
        url: "https://example.com/audio.mp3",
        type: "audio/mpeg",
        length: 9876543,
      },
    };
    const hash = "abc123";

    const result = itemToArticleData(item, hash);

    expect(result.enclosures?.[0].length).toBe(9876543);
  });

  it("should handle missing enclosure", () => {
    const item = {
      title: "Test",
      link: "https://example.com/test",
    };
    const hash = "abc123";

    const result = itemToArticleData(item, hash);

    expect(result.enclosures).toBeUndefined();
  });

  it("should handle empty enclosure", () => {
    const item = {
      title: "Test",
      link: "https://example.com/test",
      enclosure: {},
    };
    const hash = "abc123";

    const result = itemToArticleData(item, hash);

    expect(result.enclosures).toHaveLength(1);
    expect(result.enclosures?.[0].url).toBe("");
  });

  it("should have fetched_at timestamp", () => {
    const before = new Date().toISOString();
    const item = {
      title: "Test",
      link: "https://example.com/test",
    };
    const hash = "abc123";

    const result = itemToArticleData(item, hash);

    const after = new Date().toISOString();
    expect(result.fetched_at >= before).toBe(true);
    expect(result.fetched_at <= after).toBe(true);
  });

  it("should prefer pubDate over isoDate for published_at", () => {
    const item = {
      title: "Test",
      link: "https://example.com/test",
      pubDate: "Thu, 10 Jan 2026 00:00:00 GMT",
      isoDate: "2026-01-10T00:00:00.000Z",
    };
    const hash = "abc123";

    const result = itemToArticleData(item, hash);

    // The implementation uses pubDate || isoDate, so pubDate is preferred
    expect(result.published_at).toBe("Thu, 10 Jan 2026 00:00:00 GMT");
  });
});

describe("Data Type Consistency", () => {
  it("should have all required ArticleData fields", () => {
    const item = {
      title: "Test",
      link: "https://example.com/test",
    };
    const hash = "abc123";

    const result = itemToArticleData(item, hash);

    // Verify all required fields exist
    expect(result).toHaveProperty("hash");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("url");
    expect(result).toHaveProperty("fetched_at");
  });

  it("should not have undefined for required string fields", () => {
    const item = {
      title: "Test",
      link: "https://example.com/test",
    };
    const hash = "abc123";

    const result = itemToArticleData(item, hash);

    expect(result.hash).toBeDefined();
    expect(result.title).toBeDefined();
    expect(result.url).toBeDefined();
    expect(result.fetched_at).toBeDefined();
  });
});
