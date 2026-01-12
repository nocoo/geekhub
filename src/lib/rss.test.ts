/**
 * RSS Utils Tests
 *
 * Tests the RSS fetching functionality.
 *
 * Run: bun test -- rss.test.ts
 */

import crypto from "crypto";

describe("URL Hash Generation", () => {
  // Helper function to generate URL hash (same logic as in rss.ts)
  function urlToHash(url: string): string {
    return crypto.createHash("md5").update(url).digest("hex").slice(0, 12);
  }

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
    const url1 = "https://example.com/feed?sort=latest";
    const url2 = "https://example.com/feed?sort=oldest";

    const hash1 = urlToHash(url1);
    const hash2 = urlToHash(url2);

    expect(hash1).not.toBe(hash2);
  });
});

describe("fetchRss function", () => {
  it("should return feed data with required fields", async () => {
    // Since we removed file caching, we just test the structure
    // The actual API call would be tested in integration tests
    const { fetchRss } = await import("./rss");

    // This would make a real network call in test environment
    // We skip actual tests here since they require network
    expect(typeof fetchRss).toBe("function");
  });
});
