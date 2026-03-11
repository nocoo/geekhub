import { describe, test, expect } from "bun:test";
import { apiGet, expectJson, readSSEEvents } from "./helpers";

/**
 * Logs API E2E tests.
 *
 * Covers /api/logs (JSON) and /api/logs/stream (SSE).
 */

describe("Logs API", () => {
  // ── JSON logs ───────────────────────────────────────────────────────

  test("GET /api/logs returns 200 with logs array", async () => {
    const res = await apiGet("/api/logs");
    const body = await expectJson<{
      logs: Array<{
        timestamp: string;
        level: string;
        action: string;
        url: string;
        status?: number;
        duration?: string;
        message?: string;
        feedTitle?: string;
      }>;
    }>(res, 200);

    expect(Array.isArray(body.logs)).toBe(true);

    if (body.logs.length > 0) {
      const log = body.logs[0];
      expect(typeof log.timestamp).toBe("string");
      expect(typeof log.level).toBe("string");
      expect(typeof log.action).toBe("string");
      expect(typeof log.url).toBe("string");
    }
  });

  // ── SSE stream ──────────────────────────────────────────────────────

  test("GET /api/logs/stream returns SSE events with system and init", async () => {
    // The stream sends: system (connected), init (initial logs), then periodic updates.
    // We read up to 5 events with a 5s timeout — expect at least system + init.
    const events = await readSSEEvents("/api/logs/stream", 5, 5000);

    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0]).toBe("system");
    expect(events[1]).toBe("init");
  });
});
