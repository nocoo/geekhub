import { describe, test, expect } from "bun:test";
import { apiGet, apiPost, expectJson } from "./helpers";

/**
 * Data API E2E tests.
 *
 * Covers all /api/data/* routes: stats, health, files, storage,
 * logs, feeds, cleanup, and cleanup-articles.
 */

describe("Data API", () => {
  // ── Stats ───────────────────────────────────────────────────────────

  test("GET /api/data/stats returns 200 with stats object", async () => {
    const res = await apiGet("/api/data/stats");
    const body = await expectJson<{
      totalFeeds: number;
      activeFeeds: number;
      pausedFeeds: number;
      errorFeeds: number;
      totalArticles: number;
      totalRead: number;
      totalUnread: number;
      todayFetched: number;
      storageSize: number;
      lastUpdate: string;
    }>(res, 200);

    expect(typeof body.totalFeeds).toBe("number");
    expect(typeof body.activeFeeds).toBe("number");
    expect(typeof body.pausedFeeds).toBe("number");
    expect(typeof body.errorFeeds).toBe("number");
    expect(typeof body.totalArticles).toBe("number");
    expect(typeof body.totalRead).toBe("number");
    expect(typeof body.totalUnread).toBe("number");
    expect(typeof body.todayFetched).toBe("number");
    expect(typeof body.storageSize).toBe("number");
    expect(typeof body.lastUpdate).toBe("string");
  });

  // ── Health ──────────────────────────────────────────────────────────

  test("GET /api/data/health returns 200 with system health", async () => {
    const res = await apiGet("/api/data/health");
    const body = await expectJson<{
      database: string;
      proxy: string;
      storage: string;
      memory: number;
      cpu: number;
    }>(res, 200);

    expect(["connected", "error", "slow"]).toContain(body.database);
    expect(["connected", "disconnected", "error"]).toContain(body.proxy);
    expect(["healthy", "warning", "critical"]).toContain(body.storage);
    expect(typeof body.memory).toBe("number");
    expect(typeof body.cpu).toBe("number");
  });

  // ── Files ───────────────────────────────────────────────────────────

  test("GET /api/data/files returns 200 with tables and summary", async () => {
    const res = await apiGet("/api/data/files");
    const body = await expectJson<{
      tables: Array<{
        table_name: string;
        row_count: number;
        size_bytes: number;
      }>;
      summary: {
        totalFeeds: number;
        totalArticles: number;
        totalLogs: number;
        recentFetches24h: number;
        storageType: string;
      };
    }>(res, 200);

    expect(Array.isArray(body.tables)).toBe(true);
    for (const table of body.tables) {
      expect(typeof table.table_name).toBe("string");
      expect(typeof table.row_count).toBe("number");
      expect(typeof table.size_bytes).toBe("number");
    }

    expect(typeof body.summary.totalFeeds).toBe("number");
    expect(typeof body.summary.totalArticles).toBe("number");
    expect(typeof body.summary.totalLogs).toBe("number");
    expect(typeof body.summary.recentFetches24h).toBe("number");
    expect(body.summary.storageType).toBe("supabase");
  });

  // ── Storage ─────────────────────────────────────────────────────────

  test("GET /api/data/storage returns 200 with storage info", async () => {
    const res = await apiGet("/api/data/storage");
    const body = await expectJson<{
      totalSize: number;
      breakdown: Record<string, number>;
      stats: {
        totalFeeds: number;
        totalArticles: number;
        totalLogs: number;
      };
      supabaseLimits: {
        freeDatabaseLimit: number;
        freeFileStorageLimit: number;
      };
    }>(res, 200);

    expect(typeof body.totalSize).toBe("number");
    expect(typeof body.breakdown).toBe("object");
    expect(typeof body.stats.totalFeeds).toBe("number");
    expect(typeof body.stats.totalArticles).toBe("number");
    expect(typeof body.stats.totalLogs).toBe("number");
    expect(typeof body.supabaseLimits.freeDatabaseLimit).toBe("number");
    expect(typeof body.supabaseLimits.freeFileStorageLimit).toBe("number");
  });

  // ── Logs ────────────────────────────────────────────────────────────

  test("GET /api/data/logs returns 200 with log entries array", async () => {
    const res = await apiGet("/api/data/logs");
    const body = await expectJson<
      Array<{
        timestamp: string;
        level: string;
        feedId: string;
        feedTitle: string;
        message: string;
      }>
    >(res, 200);

    // May be empty if no feeds exist; just verify it's an array
    expect(Array.isArray(body)).toBe(true);

    if (body.length > 0) {
      const entry = body[0];
      expect(typeof entry.timestamp).toBe("string");
      expect(typeof entry.level).toBe("string");
      expect(typeof entry.feedId).toBe("string");
      expect(typeof entry.feedTitle).toBe("string");
      expect(typeof entry.message).toBe("string");
    }
  });

  // ── Feeds ───────────────────────────────────────────────────────────

  test("GET /api/data/feeds returns 200 with feed status array", async () => {
    const res = await apiGet("/api/data/feeds");
    const body = await expectJson<
      Array<{
        id: string;
        title: string;
        url: string;
        status: string;
        successRate: number;
        articleCount: number;
        storageSize: number;
      }>
    >(res, 200);

    expect(Array.isArray(body)).toBe(true);

    if (body.length > 0) {
      const feed = body[0];
      expect(typeof feed.id).toBe("string");
      expect(typeof feed.title).toBe("string");
      expect(typeof feed.url).toBe("string");
      expect(["active", "error", "paused", "fetching"]).toContain(feed.status);
      expect(typeof feed.successRate).toBe("number");
      expect(typeof feed.articleCount).toBe("number");
    }
  });

  // ── Cleanup (logs) ──────────────────────────────────────────────────

  test("GET /api/data/cleanup returns 200 with cleanup preview", async () => {
    const res = await apiGet("/api/data/cleanup");
    const body = await expectJson<{
      cleanupNeeded: {
        oldLogs: number;
        recommendation: string;
      };
    }>(res, 200);

    expect(typeof body.cleanupNeeded.oldLogs).toBe("number");
    expect(typeof body.cleanupNeeded.recommendation).toBe("string");
  });

  test("POST /api/data/cleanup returns 200 with cleanup result", async () => {
    const res = await apiPost("/api/data/cleanup", {
      deleteOldLogs: true,
      olderThanDays: 30,
    });
    const body = await expectJson<{
      deletedLogs: number;
      errors: string[];
    }>(res, 200);

    expect(typeof body.deletedLogs).toBe("number");
    expect(Array.isArray(body.errors)).toBe(true);
  });

  // ── Cleanup articles ────────────────────────────────────────────────

  test("GET /api/data/cleanup-articles returns 200 with article cleanup stats", async () => {
    const res = await apiGet("/api/data/cleanup-articles");
    const body = await expectJson<{
      totalArticles: number;
      readArticles: number;
      unreadArticles: number;
      articlesByFeed: Array<{
        feedId: string;
        total: number;
        read: number;
        unread: number;
      }>;
    }>(res, 200);

    expect(typeof body.totalArticles).toBe("number");
    expect(typeof body.readArticles).toBe("number");
    expect(typeof body.unreadArticles).toBe("number");
    expect(Array.isArray(body.articlesByFeed)).toBe(true);
  });

  test("POST /api/data/cleanup-articles returns 200 with execution result", async () => {
    const res = await apiPost("/api/data/cleanup-articles", {
      olderThanDays: 365,
    });
    const body = await expectJson<{
      deletedCount: number;
      errors: string[];
    }>(res, 200);

    expect(typeof body.deletedCount).toBe("number");
    expect(Array.isArray(body.errors)).toBe(true);
  });
});
