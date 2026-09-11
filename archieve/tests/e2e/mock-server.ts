/**
 * E2E Mock Server — Bun.serve @ port 14000
 *
 * Provides fake responses for external dependencies:
 * - OpenAI API (chat completions, models)
 * - RSS feeds
 * - Image proxy targets
 * - Article full-text pages
 * - httpbin connectivity check
 *
 * Lifecycle: started/stopped by scripts/run-api-e2e.sh only.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const MOCK_PORT = Number(process.env.MOCK_PORT ?? 14000);

const fixturesDir = join(import.meta.dir, "fixtures");
const rssFeed = readFileSync(join(fixturesDir, "rss-feed.xml"), "utf-8");
const articleHtml = readFileSync(join(fixturesDir, "article.html"), "utf-8");
const openaiResponse = JSON.parse(
  readFileSync(join(fixturesDir, "openai.json"), "utf-8"),
);

// 1x1 transparent JPEG (smallest valid JPEG)
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP" +
    "//////////////////////////////////////////////////////////////////////////////////////" +
    "2wBDAf//////////////////////////////////////////////////////////////////////" +
    "/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf" +
    "/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpgA//Z",
  "base64",
);

function handleRequest(req: Request): Response {
  const url = new URL(req.url);
  const path = url.pathname;

  // OpenAI: chat completions
  if (path === "/v1/chat/completions" && req.method === "POST") {
    return Response.json(openaiResponse);
  }

  // OpenAI: model list
  if (path === "/v1/models" && req.method === "GET") {
    return Response.json({
      object: "list",
      data: [
        { id: "gpt-4o-mini", object: "model", owned_by: "openai" },
        { id: "gpt-4o", object: "model", owned_by: "openai" },
      ],
    });
  }

  // RSS feed
  if (path === "/mock-rss") {
    return new Response(rssFeed, {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }

  // Image (JPEG)
  if (path === "/mock-image.jpg") {
    return new Response(TINY_JPEG, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(TINY_JPEG.length),
      },
    });
  }

  // Article HTML page
  if (path === "/mock-article") {
    return new Response(articleHtml, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // httpbin IP (connectivity test)
  if (path === "/mock-httpbin" || path === "/ip") {
    return Response.json({ origin: "127.0.0.1" });
  }

  // Catch-all 404
  return new Response(`Mock server: no handler for ${path}`, { status: 404 });
}

const server = Bun.serve({
  port: MOCK_PORT,
  fetch: handleRequest,
});

console.log(`[mock-server] listening on http://127.0.0.1:${server.port}`);
