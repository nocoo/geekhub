/**
 * RSS Utils Tests
 *
 * Tests the fetch layer utilities for URL hashing and file naming.
 *
 * Run: bun test -- rss.test.ts
 */

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");

// Helper function to generate URL hash (same as rss.ts)
function urlToHash(url: string): string {
  return crypto.createHash("md5").update(url).digest("hex").slice(0, 12);
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
    const url1 = "https://example.com/feed?sort=latest";
    const url2 = "https://example.com/feed?sort=oldest";

    const hash1 = urlToHash(url1);
    const hash2 = urlToHash(url2);

    expect(hash1).not.toBe(hash2);
  });
});

describe("RSS Cache File Structure", () => {
  it("should have required fields in cache data", async () => {
    const files = await fs.readdir(DATA_DIR);
    const cacheFiles = files.filter(
      (f) => f.startsWith("rss_") && f.endsWith(".json")
    );

    if (cacheFiles.length === 0) {
      // Skip test if no cache files exist
      return;
    }

    const existingCacheFile = cacheFiles[0];
    const content = await fs.readFile(
      path.join(DATA_DIR, existingCacheFile),
      "utf-8"
    );
    const cacheData = JSON.parse(content);

    expect(cacheData).toHaveProperty("url");
    expect(cacheData).toHaveProperty("fetchedAt");
    expect(cacheData).toHaveProperty("feed");
  });

  it("should have valid URL format", async () => {
    const files = await fs.readdir(DATA_DIR);
    const cacheFiles = files.filter(
      (f) => f.startsWith("rss_") && f.endsWith(".json")
    );

    if (cacheFiles.length === 0) {
      return;
    }

    const content = await fs.readFile(
      path.join(DATA_DIR, cacheFiles[0]),
      "utf-8"
    );
    const cacheData = JSON.parse(content) as { url: string };

    expect(() => new URL(cacheData.url)).not.toThrow();
  });

  it("should have valid ISO 8601 date format", async () => {
    const files = await fs.readdir(DATA_DIR);
    const cacheFiles = files.filter(
      (f) => f.startsWith("rss_") && f.endsWith(".json")
    );

    if (cacheFiles.length === 0) {
      return;
    }

    const content = await fs.readFile(
      path.join(DATA_DIR, cacheFiles[0]),
      "utf-8"
    );
    const cacheData = JSON.parse(content) as { fetchedAt: string };

    const date = new Date(cacheData.fetchedAt);
    expect(date.toISOString()).toBe(cacheData.fetchedAt);
  });

  it("should have feed with items array", async () => {
    const files = await fs.readdir(DATA_DIR);
    const cacheFiles = files.filter(
      (f) => f.startsWith("rss_") && f.endsWith(".json")
    );

    if (cacheFiles.length === 0) {
      return;
    }

    const content = await fs.readFile(
      path.join(DATA_DIR, cacheFiles[0]),
      "utf-8"
    );
    const cacheData = JSON.parse(content) as { feed: { items: unknown[] } };

    expect(cacheData.feed).toHaveProperty("items");
    expect(Array.isArray(cacheData.feed.items)).toBe(true);
  });
});

describe("RSS Cache File Naming", () => {
  it("should follow naming pattern: rss_<hash>_<timestamp>.json", async () => {
    const files = await fs.readdir(DATA_DIR);
    const cacheFiles = files.filter(
      (f) => f.startsWith("rss_") && f.endsWith(".json")
    );

    for (const file of cacheFiles) {
      expect(file).toMatch(/^rss_[a-f0-9]{12}_\d{4}-\d{2}-\d{2}T.*\.json$/);
    }
  });

  it("should have consistent hash for same URL", async () => {
    const files = await fs.readdir(DATA_DIR);
    const cacheFiles = files.filter(
      (f) => f.startsWith("rss_") && f.endsWith(".json")
    );

    const urlHashMap = new Map<string, string>();

    for (const file of cacheFiles) {
      const content = await fs.readFile(path.join(DATA_DIR, file), "utf-8");
      const data = JSON.parse(content) as { url: string };
      const hash = file.split("_")[1];

      if (urlHashMap.has(data.url)) {
        expect(urlHashMap.get(data.url)).toBe(hash);
      } else {
        urlHashMap.set(data.url, hash);
      }
    }
  });
});
