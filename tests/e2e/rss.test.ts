import { describe, test, expect } from "vitest";
import { apiGet, expectJson } from "./helpers";
import { MOCK_URL } from "./setup";

/**
 * RSS proxy E2E tests.
 *
 * Tests the /api/rss route which fetches and parses RSS feeds
 * from a given URL, returning structured JSON.
 */

describe("RSS Proxy API", () => {
  test("GET /api/rss?url=<mock-rss> returns 200 with parsed feed", async () => {
    const res = await apiGet(
      `/api/rss?url=${encodeURIComponent(`${MOCK_URL}/mock-rss`)}`,
    );
    const body = await expectJson<{
      success: boolean;
      cached: boolean;
      fetchedAt: string;
      feed: {
        title: string;
        items: unknown[];
      };
    }>(res, 200);

    expect(body.success).toBe(true);
    expect(typeof body.cached).toBe("boolean");
    expect(typeof body.fetchedAt).toBe("string");
    expect(body.feed).toBeDefined();
    expect(typeof body.feed.title).toBe("string");
    expect(Array.isArray(body.feed.items)).toBe(true);
  });

  test("GET /api/rss?url=<mock-rss>&skipCache=true bypasses cache", async () => {
    const res = await apiGet(
      `/api/rss?url=${encodeURIComponent(`${MOCK_URL}/mock-rss`)}&skipCache=true`,
    );
    const body = await expectJson<{
      success: boolean;
      cached: boolean;
    }>(res, 200);

    expect(body.success).toBe(true);
    expect(body.cached).toBe(false);
  });

  test("GET /api/rss without url returns 400", async () => {
    const res = await apiGet("/api/rss");

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("url");
  });

  test("GET /api/rss with invalid url returns 400", async () => {
    const res = await apiGet("/api/rss?url=not-a-valid-url");

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("Invalid URL");
  });
});
