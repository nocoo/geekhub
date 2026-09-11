import { describe, expect, test } from "vitest";
import packageJson from "../../package.json";
import { DB_AVAILABLE } from "./db-available";
import { apiGet } from "./helpers";

describe("GET /api/live", () => {
  test("returns JSON health with no-store", async () => {
    const res = await apiGet("/api/live");
    expect(res.headers.get("cache-control")).toMatch(/no-store/i);
    const body = (await res.json()) as { status: string; version?: string };

    expect(body.version).toBe(packageJson.version);
    if (DB_AVAILABLE) {
      expect(res.status).toBe(200);
      expect(body).toEqual({ status: "ok", version: packageJson.version });
    } else {
      expect(res.status).toBe(503);
      expect(body).toEqual({ status: "error", version: packageJson.version });
    }
  });
});
