import { readFileSync } from "node:fs";
import { HTTPException } from "hono/http-exception";
import { expect, test, vi } from "vitest";
import type { FetchLog } from "../../src/shared/contracts";
import { fetchLog, refreshFeed } from "../../src/worker/feeds";
import { FeedLogCache, feedLogs, withActivity } from "../../src/worker/logs";
import { client, makeEnv, queuedJob, rss } from "./support";

test("the shared cache bounds history, filters before limiting and never reads or writes D1", async () => {
	const env = makeEnv();
	const request = client(env);
	const sql = vi.spyOn(env.DB, "prepare").mockImplementation(() => {
		throw new Error("Logs must not use D1");
	});
	for (let i = 0; i < 505; i++)
		await fetchLog(
			env,
			{ id: `f${i % 2}`, title: "Feed" },
			i % 2 ? "error" : "success",
			`Entry ${i}`,
		);
	const logs = await request<FetchLog[]>("GET", "/logs");
	expect(logs).toHaveLength(500);
	expect(logs[0]?.message).toBe("Entry 504");
	expect(logs.at(-1)?.message).toBe("Entry 5");
	expect(new Set(logs.map((log) => log.id)).size).toBe(500);
	expect(logs[0]?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	expect(await request("GET", "/logs?feedId=f1&level=error&limit=1")).toMatchObject([
		{ message: "Entry 503", level: "error", feed_id: "f1" },
	]);
	expect(await request("GET", "/logs?level=info")).toEqual([]);
	for (const query of ["limit=0", "limit=501", "limit=1.5", "limit=no", "level=invalid"])
		await request("GET", `/logs?${query}`, undefined, 400);
	await request("DELETE", "/logs");
	expect(await request("GET", "/logs")).toEqual([]);
	await fetchLog(env, { id: "f1", title: "Feed" }, "info", "After clear");
	expect((await feedLogs(env).list())[0]?.id).toBeGreaterThan(logs[0]?.id ?? 0);
	expect(sql).not.toHaveBeenCalled();
});

test("cache bounds entry size, protects snapshots and starts empty after an instance restart", async () => {
	const ctx = {
		storage: new Proxy(
			{},
			{
				get: () => {
					throw new Error("No durable storage");
				},
			},
		),
	} as DurableObjectState;
	const cache = new FeedLogCache(ctx, {} as Env);
	await cache.append({
		feed_id: "f1",
		feed_title: "t".repeat(300),
		message: "m".repeat(600),
		level: "success",
		articles_added: 3,
		duration_ms: 42,
	});
	const snapshot = await cache.list();
	expect(snapshot[0]).toMatchObject({
		feed_title: "t".repeat(200),
		message: "m".repeat(500),
		articles_added: 3,
		duration_ms: 42,
	});
	if (snapshot[0]) snapshot[0].message = "Mutated";
	snapshot.pop();
	expect((await cache.list())[0]?.message).toBe("m".repeat(500));
	expect(await new FeedLogCache(ctx, {} as Env).list()).toEqual([]);
});

test("cache outages neither fail successful refreshes nor replace upstream errors", async () => {
	const env = makeEnv();
	vi.spyOn(env.FEED_LOGS, "getByName").mockImplementation(() => {
		throw new Error("cache unavailable");
	});
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.stubGlobal(
		"fetch",
		vi
			.fn()
			.mockResolvedValueOnce(new Response(rss()))
			.mockRejectedValueOnce(new Error("upstream timeout")),
	);
	await refreshFeed(env, await queuedJob(env));
	expect(await env.DB.prepare("SELECT status FROM feeds WHERE id = 'f1'").first("status")).toBe(
		"success",
	);
	await expect(refreshFeed(env, await queuedJob(env))).rejects.toThrow("upstream timeout");
	expect(
		await env.DB.prepare("SELECT last_error FROM feeds WHERE id = 'f1'").first("last_error"),
	).toBe("upstream timeout");
});

test("cleanup migration deletes legacy log data while retaining reader data", async () => {
	const env = makeEnv();
	await env.DB.exec(
		"INSERT INTO fetch_logs(feed_id, feed_title, level, message) VALUES ('f1', 'Feed', 'info', 'Old log');",
	);
	await env.DB.exec(
		readFileSync(new URL("../../migrations/0003_clear_fetch_logs.sql", import.meta.url), "utf8"),
	);
	expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM fetch_logs").first("n")).toBe(0);
	expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM feeds").first("n")).toBe(1);
	expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM articles").first("n")).toBe(2);
});

test("activities correlate start and completion, filter by kind, and keep failures safe", async () => {
	const env = makeEnv();
	const request = client(env);
	const context = {
		category: "translation" as const,
		automatic: true,
		feed_id: "f1",
		feed_title: "Feed",
		article_id: "a1",
		article_title: "An article",
		message: "自动翻译全文",
	};
	const result = await withActivity(env, context, async () => {
		expect((await feedLogs(env).list())[0]).toMatchObject({
			level: "info",
			automatic: true,
			article_id: "a1",
		});
		return "translated";
	});
	expect(result).toBe("translated");
	const [done, started] = await request<FetchLog[]>("GET", "/logs?category=translation");
	expect(done).toMatchObject({
		level: "success",
		activity_id: started?.activity_id,
		message: "自动翻译全文 · 已完成",
	});
	expect(done?.duration_ms).toBeGreaterThanOrEqual(0);
	expect(await request("GET", "/logs?category=feed")).toEqual([]);
	await request("GET", "/logs?category=unknown", undefined, 400);
	await expect(
		withActivity(env, context, async () => {
			throw new HTTPException(502, { message: "AI 请求超时" });
		}),
	).rejects.toThrow("AI 请求超时");
	expect((await feedLogs(env).list())[0]).toMatchObject({
		level: "error",
		message: "自动翻译全文 · AI 请求超时",
	});
	await expect(
		withActivity(env, context, async () => {
			throw new Error("sensitive provider response");
		}),
	).rejects.toThrow("sensitive");
	expect(JSON.stringify(await feedLogs(env).list())).not.toContain("sensitive");
	vi.spyOn(env.FEED_LOGS, "getByName").mockImplementation(() => {
		throw new Error("cache unavailable");
	});
	vi.spyOn(console, "error").mockImplementation(() => {});
	expect(await withActivity(env, context, async () => "still works")).toBe("still works");
});

test("AI and extraction routes record actual work and skip cache hits", async () => {
	const env = makeEnv();
	env.RESOURCE_ENV = "test";
	await env.DB.exec(
		"CREATE TABLE _test_marker(key TEXT PRIMARY KEY, value TEXT); INSERT INTO _test_marker VALUES ('env','test');",
	);
	const request = client(env);
	await request("POST", "/articles/a1/ai", { action: "translate", automatic: true });
	expect(await request("GET", "/logs?category=translation&level=success")).toMatchObject([
		{ article_id: "a1", automatic: true },
	]);
	const count = (await feedLogs(env).list()).length;
	await request("POST", "/articles/a1/ai", { action: "translate", automatic: true });
	expect((await feedLogs(env).list()).length).toBe(count);
	await request("POST", "/articles/a1/ai", { action: "summary" });
	expect(await request("GET", "/logs?category=summary&level=success")).toHaveLength(1);
	vi.stubGlobal(
		"fetch",
		vi
			.fn()
			.mockResolvedValue(
				new Response(
					"<article><p>Readable article content, with enough details to extract a complete paragraph for the reader.</p></article>",
				),
			),
	);
	await request("POST", "/articles/a1/full");
	expect(await request("GET", "/logs?category=extraction&level=success")).toHaveLength(1);
});
