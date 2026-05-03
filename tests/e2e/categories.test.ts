import { describe, test, expect } from "vitest";
import { apiGet, apiPost, apiPut, apiDelete, expectJson } from "./helpers";
import { DB_AVAILABLE } from "./db-available";

const describeDb = DB_AVAILABLE ? describe : describe.skip;

/**
 * Categories CRUD E2E tests.
 *
 * Tests run sequentially against a real Next.js dev server + local Supabase.
 * A category is created mid-run and its id is shared across subsequent tests.
 */

let categoryId: string;

describeDb("Categories API", () => {
  // ── List categories (baseline) ──────────────────────────────────

  test("GET /api/categories returns 200 with categories array", async () => {
    const res = await apiGet("/api/categories");
    const body = await expectJson<{ categories: unknown[] }>(res, 200);

    expect(Array.isArray(body.categories)).toBe(true);
  });

  // ── Create category ─────────────────────────────────────────────

  test("POST /api/categories creates a category and returns 201", async () => {
    const res = await apiPost("/api/categories", { name: "Test Category" });
    const body = await expectJson<{
      category: {
        id: string;
        name: string;
        color: string;
        icon: string;
        sort_order: number;
      };
    }>(res, 201);

    expect(body.category).toBeDefined();
    expect(typeof body.category.id).toBe("string");
    expect(body.category.name).toBe("Test Category");
    expect(typeof body.category.color).toBe("string");
    expect(typeof body.category.icon).toBe("string");

    // Store for subsequent tests
    categoryId = body.category.id;
  });

  test("POST /api/categories with missing name returns 400", async () => {
    const res = await apiPost("/api/categories", {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("POST /api/categories with duplicate name returns 409", async () => {
    const res = await apiPost("/api/categories", { name: "Test Category" });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  // ── Update category ─────────────────────────────────────────────

  test("PUT /api/categories/[id] updates the category name", async () => {
    const res = await apiPut(`/api/categories/${categoryId}`, {
      name: "Updated Category",
    });
    const body = await expectJson<{
      category: { id: string; name: string };
    }>(res, 200);

    expect(body.category.id).toBe(categoryId);
    expect(body.category.name).toBe("Updated Category");
  });

  test("PUT /api/categories/[id] with non-existent id returns 404", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await apiPut(`/api/categories/${fakeId}`, {
      name: "Ghost",
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  // ── Delete category ─────────────────────────────────────────────

  test("DELETE /api/categories/[id] removes the category", async () => {
    const res = await apiDelete(`/api/categories/${categoryId}`);
    const body = await expectJson<{ success: boolean }>(res, 200);

    expect(body.success).toBe(true);
  });

  test("GET /api/categories no longer includes the deleted category", async () => {
    const res = await apiGet("/api/categories");
    const body = await expectJson<{
      categories: Array<{ id: string }>;
    }>(res, 200);

    const match = body.categories.find((c) => c.id === categoryId);
    expect(match).toBeUndefined();
  });
});
