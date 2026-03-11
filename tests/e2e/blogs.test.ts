import { describe, test, expect } from "bun:test";
import { apiGet, expectJson } from "./helpers";

/**
 * Blogs API E2E tests.
 *
 * Covers GET /api/blogs — blog discovery list.
 */

describe("Blogs API", () => {
  test("GET /api/blogs returns 200 with blogs, tags, and pagination", async () => {
    const res = await apiGet("/api/blogs");
    const body = await expectJson<{
      blogs: unknown[];
      tags: string[];
      pagination: {
        page: number;
        limit: number;
        hasMore: boolean;
      };
    }>(res, 200);

    expect(Array.isArray(body.blogs)).toBe(true);
    expect(Array.isArray(body.tags)).toBe(true);
    expect(typeof body.pagination.page).toBe("number");
    expect(typeof body.pagination.limit).toBe("number");
    expect(typeof body.pagination.hasMore).toBe("boolean");
  });
});
