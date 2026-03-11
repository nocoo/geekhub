import { describe, test, expect } from "bun:test";
import { apiGet, apiPost } from "./helpers";
import { MOCK_URL } from "./setup";

/**
 * Image proxy E2E tests.
 *
 * Tests the /api/image-proxy route which proxies images via:
 * - GET with ?data= (base64-encoded JSON {url, referer})
 * - POST with JSON body {url, referer}
 */

/** Encode a proxy request into the base64 `data` query param */
function encodeProxyData(params: { url: string; referer?: string }): string {
  // Route expects: base64(encodeURIComponent(JSON.stringify(params)))
  return btoa(encodeURIComponent(JSON.stringify(params)));
}

describe("Image Proxy API", () => {
  // ── GET method ──────────────────────────────────────────────────

  test("GET /api/image-proxy?data=<encoded> returns image/jpeg", async () => {
    const data = encodeProxyData({ url: `${MOCK_URL}/mock-image.jpg` });
    const res = await apiGet(`/api/image-proxy?data=${data}`);

    expect(res.status).toBe(200);
    const contentType = res.headers.get("content-type");
    expect(contentType).toContain("image/jpeg");

    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  test("GET /api/image-proxy without data param returns 400", async () => {
    const res = await apiGet("/api/image-proxy");

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("GET /api/image-proxy with invalid base64 returns 400", async () => {
    const res = await apiGet("/api/image-proxy?data=not-valid-base64!!!");

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  // ── POST method ─────────────────────────────────────────────────

  test("POST /api/image-proxy with url returns image/jpeg", async () => {
    const res = await apiPost("/api/image-proxy", {
      url: `${MOCK_URL}/mock-image.jpg`,
    });

    expect(res.status).toBe(200);
    const contentType = res.headers.get("content-type");
    expect(contentType).toContain("image/jpeg");

    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  test("POST /api/image-proxy with referer returns 200", async () => {
    const res = await apiPost("/api/image-proxy", {
      url: `${MOCK_URL}/mock-image.jpg`,
      referer: "https://example.com",
    });

    expect(res.status).toBe(200);
    const contentType = res.headers.get("content-type");
    expect(contentType).toContain("image/jpeg");
  });

  test("POST /api/image-proxy without url returns 400", async () => {
    const res = await apiPost("/api/image-proxy", {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
