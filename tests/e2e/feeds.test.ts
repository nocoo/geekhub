import { describe, test, expect } from "bun:test";
import { apiGet, apiPost, apiPut, apiDelete, expectJson } from "./helpers";
import { MOCK_URL } from "./setup";
import { DB_AVAILABLE } from "./db-available";

const describeDb = DB_AVAILABLE ? describe : describe.skip;

/**
 * Feeds CRUD E2E tests.
 *
 * Tests run sequentially against a real Next.js dev server + local Supabase.
 * A feed is created mid-run and its id is shared across subsequent tests.
 */

let feedId: string;

describeDb("Feeds API", () => {
  // ── List feeds (empty state) ──────────────────────────────────────

  test("GET /api/feeds returns 200 with feeds array", async () => {
    const res = await apiGet("/api/feeds");
    const body = await expectJson<{ feeds: unknown[] }>(res, 200);

    expect(Array.isArray(body.feeds)).toBe(true);
  });

  test("GET /api/feeds/list returns 200 with feeds array", async () => {
    const res = await apiGet("/api/feeds/list");
    const body = await expectJson<{ feeds: unknown[] }>(res, 200);

    expect(Array.isArray(body.feeds)).toBe(true);
  });

  // ── Create feed ───────────────────────────────────────────────────

  test("POST /api/feeds with validate_only returns feed metadata without persisting", async () => {
    const res = await apiPost("/api/feeds", {
      url: `${MOCK_URL}/mock-rss`,
      validate_only: true,
    });
    const body = await expectJson<{
      feed: {
        title: string;
        description: string;
        itemCount: number;
        latestItemDate: string | null;
      };
    }>(res, 200);

    expect(body.feed).toBeDefined();
    expect(typeof body.feed.title).toBe("string");
    expect(typeof body.feed.description).toBe("string");
    expect(typeof body.feed.itemCount).toBe("number");
  });

  test("POST /api/feeds creates a feed and returns 201", async () => {
    const res = await apiPost("/api/feeds", {
      url: `${MOCK_URL}/mock-rss`,
    });
    const body = await expectJson<{
      feed: {
        id: string;
        title: string;
        url: string;
        url_hash: string;
        is_active: boolean;
        category: unknown;
      };
    }>(res, 201);

    expect(body.feed).toBeDefined();
    expect(typeof body.feed.id).toBe("string");
    expect(body.feed.url).toBe(`${MOCK_URL}/mock-rss`);
    expect(body.feed.is_active).toBe(true);

    // Store for subsequent tests
    feedId = body.feed.id;
  });

  test("POST /api/feeds with duplicate URL returns 409", async () => {
    const res = await apiPost("/api/feeds", {
      url: `${MOCK_URL}/mock-rss`,
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("GET /api/feeds now includes the created feed", async () => {
    const res = await apiGet("/api/feeds");
    const body = await expectJson<{
      feeds: Array<{ id: string; url: string }>;
    }>(res, 200);

    const match = body.feeds.find((f) => f.id === feedId);
    expect(match).toBeDefined();
    expect(match!.url).toBe(`${MOCK_URL}/mock-rss`);
  });

  // ── Update feed ───────────────────────────────────────────────────

  test("PUT /api/feeds/[id] updates the feed title", async () => {
    const res = await apiPut(`/api/feeds/${feedId}`, { title: "Updated" });
    const body = await expectJson<{
      feed: { id: string; title: string };
    }>(res, 200);

    expect(body.feed.id).toBe(feedId);
    expect(body.feed.title).toBe("Updated");
  });

  // ── Feed sub-resources ────────────────────────────────────────────

  test("GET /api/feeds/[id]/articles returns 200 with articles", async () => {
    const res = await apiGet(`/api/feeds/${feedId}/articles`);
    const body = await expectJson<{
      feed: { id: string; title: string };
      articles: unknown[];
      total: number;
    }>(res, 200);

    expect(body.feed).toBeDefined();
    expect(Array.isArray(body.articles)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  test("GET /api/feeds/[id]/logs returns 200 with logs", async () => {
    const res = await apiGet(`/api/feeds/${feedId}/logs`);
    const body = await expectJson<{
      feed: { id: string; title: string; url: string; url_hash: string };
      logs: string[];
      articles: unknown[];
      stats: { totalArticles: number; totalSize: number };
    }>(res, 200);

    expect(body.feed).toBeDefined();
    expect(body.feed.id).toBe(feedId);
    expect(Array.isArray(body.logs)).toBe(true);
    expect(Array.isArray(body.articles)).toBe(true);
    expect(typeof body.stats.totalArticles).toBe("number");
  });

  test("POST /api/feeds/[id]/mark-all-read returns 200", async () => {
    const res = await apiPost(`/api/feeds/${feedId}/mark-all-read`, {});
    const body = await expectJson<{
      success: boolean;
      marked: number;
      alreadyRead: number;
    }>(res, 200);

    expect(body.success).toBe(true);
    expect(typeof body.marked).toBe("number");
    expect(typeof body.alreadyRead).toBe("number");
  });

  test("PUT /api/feeds/[id]/auto-translate toggles auto_translate", async () => {
    const res = await apiPut(`/api/feeds/${feedId}/auto-translate`, {
      auto_translate: true,
    });
    const body = await expectJson<{
      feed: { id: string; auto_translate: boolean };
    }>(res, 200);

    expect(body.feed.id).toBe(feedId);
    expect(body.feed.auto_translate).toBe(true);
  });

  // ── Virtual feeds ─────────────────────────────────────────────────

  test("GET /api/feeds/starred/articles returns 200 with articles array", async () => {
    const res = await apiGet("/api/feeds/starred/articles");
    const body = await expectJson<{
      feed: { id: string; title: string };
      articles: unknown[];
      total: number;
    }>(res, 200);

    expect(body.feed.id).toBe("starred");
    expect(Array.isArray(body.articles)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  test("GET /api/feeds/later/articles returns 200 with articles array", async () => {
    const res = await apiGet("/api/feeds/later/articles");
    const body = await expectJson<{
      feed: { id: string; title: string };
      articles: unknown[];
      total: number;
    }>(res, 200);

    expect(body.feed.id).toBe("later");
    expect(Array.isArray(body.articles)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  // ── Delete feed ───────────────────────────────────────────────────

  test("DELETE /api/feeds/[id] removes the feed", async () => {
    const res = await apiDelete(`/api/feeds/${feedId}`);
    const body = await expectJson<{
      success: boolean;
      url_hash: string;
    }>(res, 200);

    expect(body.success).toBe(true);
    expect(typeof body.url_hash).toBe("string");
  });
});
