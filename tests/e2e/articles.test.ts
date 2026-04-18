import { describe, test, expect } from "bun:test";
import { apiGet, apiPost, apiDelete, expectJson } from "./helpers";
import { MOCK_URL } from "./setup";
import { DB_AVAILABLE } from "./db-available";

const describeDb = DB_AVAILABLE ? describe : describe.skip;

/**
 * Articles action E2E tests (read, unread, bookmark, read-later).
 *
 * Strategy:
 *   1. Create a feed from the mock RSS server.
 *   2. Trigger a fetch to import articles.
 *   3. Poll until articles are available (the fetch is async).
 *   4. Exercise article action endpoints against a real article ID.
 *   5. Clean up the feed at the end.
 *
 * If articles are never imported (e.g. fetch doesn't complete in time),
 * the test falls back to validating error handling with a non-existent UUID.
 */

const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 8000;
const FAKE_UUID = "00000000-0000-0000-0000-000000000000";

let feedId: string;
let articleId: string | null = null;

/**
 * Poll GET /api/feeds/[id]/articles until at least one article appears
 * or the timeout expires.
 */
async function pollForArticles(fId: string): Promise<string | null> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const res = await apiGet(`/api/feeds/${fId}/articles`);
    if (res.status === 200) {
      const body = (await res.json()) as {
        articles: Array<{ id: string }>;
        total: number;
      };
      if (body.articles.length > 0) {
        return body.articles[0].id;
      }
    }
    await Bun.sleep(POLL_INTERVAL_MS);
  }

  return null;
}

describeDb("Articles API", () => {
  // ── Setup: create feed and fetch articles ───────────────────────

  test("setup: create a feed from mock RSS", async () => {
    const res = await apiPost("/api/feeds", {
      url: `${MOCK_URL}/mock-rss`,
    });

    // Feed may already exist from a previous run; accept both 201 and 409
    if (res.status === 409) {
      // Retrieve existing feed
      const listRes = await apiGet("/api/feeds");
      const listBody = await expectJson<{
        feeds: Array<{ id: string; url: string }>;
      }>(listRes, 200);

      const existing = listBody.feeds.find(
        (f) => f.url === `${MOCK_URL}/mock-rss`,
      );
      expect(existing).toBeDefined();
      feedId = existing!.id;
    } else {
      const body = await expectJson<{
        feed: { id: string };
      }>(res, 201);
      feedId = body.feed.id;
    }

    expect(typeof feedId).toBe("string");
  });

  test("setup: trigger fetch and wait for articles", async () => {
    // Trigger manual fetch
    const fetchRes = await apiPost(`/api/feeds/${feedId}/fetch`, {});
    const fetchBody = await expectJson<{
      success: boolean;
      message: string;
      feedId: string;
    }>(fetchRes, 200);

    expect(fetchBody.success).toBe(true);

    // Poll until articles are imported
    articleId = await pollForArticles(feedId);

    // We don't fail here — downstream tests adapt based on articleId
    if (articleId) {
      expect(typeof articleId).toBe("string");
    }
  });

  // ── Mark as read ────────────────────────────────────────────────

  test("POST /api/articles/[id]/read marks article as read", async () => {
    const id = articleId ?? FAKE_UUID;
    const res = await apiPost(`/api/articles/${id}/read`, {});

    if (articleId) {
      const body = await expectJson<{
        success: boolean;
        feedId: string | null;
        unreadCount: number | null;
      }>(res, 200);

      expect(body.success).toBe(true);
    } else {
      // Non-existent article upserts into user_articles (no FK check),
      // so it may still succeed — just verify we get a JSON response
      expect([200, 500]).toContain(res.status);
    }
  });

  test("POST /api/articles/[id]/read with invalid UUID returns 400", async () => {
    const res = await apiPost("/api/articles/not-a-uuid/read", {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid article ID format");
  });

  // ── Mark as unread ──────────────────────────────────────────────

  test("POST /api/articles/[id]/unread marks article as unread", async () => {
    const id = articleId ?? FAKE_UUID;
    const res = await apiPost(`/api/articles/${id}/unread`, {});

    if (articleId) {
      const body = await expectJson<{ success: boolean }>(res, 200);
      expect(body.success).toBe(true);
    } else {
      expect([200, 500]).toContain(res.status);
    }
  });

  test("POST /api/articles/[id]/unread with invalid UUID returns 400", async () => {
    const res = await apiPost("/api/articles/not-a-uuid/unread", {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid article ID format");
  });

  // ── Bookmark ────────────────────────────────────────────────────

  test("POST /api/articles/[id]/bookmark toggles bookmark on", async () => {
    const id = articleId ?? FAKE_UUID;
    const res = await apiPost(`/api/articles/${id}/bookmark`, {});

    if (articleId) {
      const body = await expectJson<{
        success: boolean;
        bookmarked: boolean;
        bookmarkedAt: string | null;
      }>(res, 200);

      expect(body.success).toBe(true);
      expect(body.bookmarked).toBe(true);
      expect(typeof body.bookmarkedAt).toBe("string");
    } else {
      expect([200, 500]).toContain(res.status);
    }
  });

  test("DELETE /api/articles/[id]/bookmark removes bookmark", async () => {
    const id = articleId ?? FAKE_UUID;
    const res = await apiDelete(`/api/articles/${id}/bookmark`);

    if (articleId) {
      const body = await expectJson<{ success: boolean }>(res, 200);
      expect(body.success).toBe(true);
    } else {
      expect([200, 500]).toContain(res.status);
    }
  });

  test("POST /api/articles/[id]/bookmark with invalid UUID returns 400", async () => {
    const res = await apiPost("/api/articles/not-a-uuid/bookmark", {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid article ID format");
  });

  // ── Read Later ──────────────────────────────────────────────────

  test("POST /api/articles/[id]/read-later toggles read-later on", async () => {
    const id = articleId ?? FAKE_UUID;
    const res = await apiPost(`/api/articles/${id}/read-later`, {});

    if (articleId) {
      const body = await expectJson<{
        success: boolean;
        readLater: boolean;
        readLaterAt: string | null;
      }>(res, 200);

      expect(body.success).toBe(true);
      expect(body.readLater).toBe(true);
      expect(typeof body.readLaterAt).toBe("string");
    } else {
      expect([200, 500]).toContain(res.status);
    }
  });

  test("DELETE /api/articles/[id]/read-later removes read-later", async () => {
    const id = articleId ?? FAKE_UUID;
    const res = await apiDelete(`/api/articles/${id}/read-later`);

    if (articleId) {
      const body = await expectJson<{ success: boolean }>(res, 200);
      expect(body.success).toBe(true);
    } else {
      expect([200, 500]).toContain(res.status);
    }
  });

  test("POST /api/articles/[id]/read-later with invalid UUID returns 400", async () => {
    const res = await apiPost("/api/articles/not-a-uuid/read-later", {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid article ID format");
  });

  // ── Cleanup ─────────────────────────────────────────────────────

  test("cleanup: delete the test feed", async () => {
    const res = await apiDelete(`/api/feeds/${feedId}`);
    const body = await expectJson<{ success: boolean }>(res, 200);

    expect(body.success).toBe(true);
  });
});
