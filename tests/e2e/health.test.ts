import { describe, test, expect } from "vitest";
import { apiGet, expectJson } from "./helpers";

describe("GET /api/health", () => {
  test("returns 200 with status ok and version string", async () => {
    const res = await apiGet("/api/health");
    const body = await expectJson<{ status: string; version: string }>(res, 200);

    expect(body.status).toBe("ok");
    expect(typeof body.version).toBe("string");
    expect(body.version.length).toBeGreaterThan(0);
  });
});
