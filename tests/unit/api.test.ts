import { describe, expect, test, vi } from "vitest";
import type {
	ArticleDetail,
	ArticlePage,
	Category,
	Feed,
	Preferences,
	Stats,
} from "../../src/shared/contracts";
import { APP_VERSION } from "../../src/shared/version";
import { dataStats, preferences } from "../../src/worker/data";
import { app } from "../../src/worker/index";
import { makeEnv } from "./support";

function client(env: Env) {
	return async <T = Record<string, unknown>>(
		method: string,
		path: string,
		body?: unknown,
		status = 200,
	): Promise<T> => {
		const response = await app.request(
			`http://127.0.0.1/api${path}`,
			{
				method,
				...(body === undefined
					? {}
					: { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
			},
			env,
		);
		const result = await response.json();
		expect(response.status, `${method} ${path}: ${JSON.stringify(result)}`).toBe(status);
		return result as T;
	};
}

describe("reader API with SQLite SQL", () => {
	test("health, identity, errors and bounded request bodies", async () => {
		const env = makeEnv();
		const request = client(env);
		expect(await request("GET", "/live")).toMatchObject({ status: "ok", version: APP_VERSION });
		expect(await request("GET", "/session")).toMatchObject({ local: true });
		await request("GET", "/unknown", undefined, 404);
		await request("POST", "/categories", { name: "a".repeat(70000) }, 413);
		expect(
			(
				await app.request(
					"http://127.0.0.1/api/categories",
					{ method: "POST", headers: { "content-type": "application/json" }, body: "not-json" },
					env,
				)
			).status,
		).toBe(400);
		vi.spyOn(env.DB, "prepare").mockImplementation(() => {
			throw new Error("private database details");
		});
		await request("GET", "/live", undefined, 503);
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(await request("GET", "/stats", undefined, 500)).toEqual({
			error: "服务暂时不可用，请稍后重试",
		});
		expect(JSON.stringify(log.mock.calls)).not.toContain("private database details");
	});
	test("category CRUD and missing-category handling", async () => {
		const env = makeEnv();
		const request = client(env);
		expect(await request<Category[]>("GET", "/categories")).toEqual([
			{ id: "c1", name: "Engineering", color: "green", icon: "", sort_order: 0 },
		]);
		const category = await request<Category>("POST", "/categories", { name: "  Reading  " }, 201);
		expect(category.name).toBe("Reading");
		await request("POST", "/categories", { name: "Reading" }, 409);
		await request("POST", "/categories", { name: "" }, 400);
		await request("PATCH", `/categories/${category.id}`, { name: "Ideas", color: "rose" });
		await request("PATCH", "/categories/c2", { name: "stolen" }, 404);
		await request("DELETE", "/categories/c2", undefined, 404);
		await request("DELETE", `/categories/${category.id}`);
		await request("DELETE", `/categories/${category.id}`, undefined, 404);
	});
	test("feed CRUD, RSSHub resolution, missing records and queue failures", async () => {
		const env = makeEnv();
		const request = client(env);
		expect(await request<Feed[]>("GET", "/feeds")).toMatchObject([
			{ id: "f1", unread_count: 2, total_count: 2 },
		]);
		const feed = await request<Feed>(
			"POST",
			"/feeds",
			{ url: "rsshub://github/issue/nocoo/geekhub", category_id: "c1" },
			201,
		);
		expect(feed.url).toBe("rsshub://github/issue/nocoo/geekhub");
		expect(feed.title).toBe("rsshub.app");
		await request("POST", "/feeds", { url: "https://example.com/feed" }, 409);
		await request("POST", "/feeds", { url: "http://localhost:9000" }, 400);
		await request("POST", "/feeds", { url: "https://example.com/new", category_id: "c2" }, 404);
		await request("PATCH", `/feeds/${feed.id}`, { auto_translate: true });
		await request("PATCH", `/feeds/${feed.id}`, {
			title: "Updated",
			category_id: null,
			refresh_minutes: 15,
			auto_translate: false,
		});
		await request("PATCH", `/feeds/${feed.id}`, {}, 400);
		await request("PATCH", `/feeds/${feed.id}`, { category_id: "c2" }, 404);
		await request("PATCH", "/feeds/f2", { title: "stolen" }, 404);
		await request("POST", "/feeds/f2/refresh", undefined, 404);
		await request("POST", "/feeds/f1/refresh", undefined, 202);
		expect((await request("POST", "/feeds/f1/refresh", undefined, 202)).queued).toBe(false);
		expect((await request("POST", "/refresh", undefined, 202)).queued).toBe(0);
		vi.mocked(env.FEED_QUEUE.send).mockRejectedValueOnce(new Error("unavailable"));
		const failed = await request<Feed>(
			"POST",
			"/feeds",
			{ url: "https://example.com/new", title: "Kept despite queue failure" },
			201,
		);
		expect(failed.status).toBe("error");
		await request("DELETE", `/feeds/${feed.id}`);
		await request("DELETE", "/feeds/f2", undefined, 404);
		await env.DB.exec(
			`WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x < 500) INSERT INTO feeds(id,title,url) SELECT 'limit-'||x,'Limit','https://example.com/'||x FROM n;`,
		);
		await request("POST", "/feeds", { url: "https://example.com/over-limit" }, 422);
	});
	test("keyset pagination and literal search across feed/category/read filters", async () => {
		const env = makeEnv();
		const request = client(env);
		const first = await request<ArticlePage>("GET", "/articles?limit=1");
		expect(first.articles[0]?.id).toBe("a2");
		expect(first.nextCursor).toBeTruthy();
		const second = await request<ArticlePage>(
			"GET",
			`/articles?limit=1&cursor=${encodeURIComponent(first.nextCursor ?? "")}`,
		);
		expect(second.articles[0]?.id).toBe("a1");
		expect(second.nextCursor).toBeNull();
		await request("GET", "/articles?cursor=invalid", undefined, 400);
		await request("GET", "/articles?limit=0", undefined, 400);
		expect((await request<ArticlePage>("GET", "/articles?search=%25")).articles).toHaveLength(0);
		expect(
			(await request<ArticlePage>("GET", "/articles?feedId=f1&categoryId=c1&search=software"))
				.articles,
		).toHaveLength(1);
		expect((await request<ArticlePage>("GET", "/articles?feedId=f2")).articles).toHaveLength(0);
		expect((await request<ArticlePage>("GET", "/articles?view=unread")).articles).toHaveLength(2);
		await request("PATCH", "/articles/a1", { is_starred: true, is_later: true });
		expect(
			(await request<ArticlePage>("GET", "/articles?view=starred")).articles.map(
				(article) => article.id,
			),
		).toEqual(["a1"]);
		expect(
			(await request<ArticlePage>("GET", "/articles?view=later")).articles.map(
				(article) => article.id,
			),
		).toEqual(["a1"]);
	});
	test("concurrent article state changes update only specified fields", async () => {
		const env = makeEnv();
		const request = client(env);
		expect(await request<ArticleDetail>("GET", "/articles/a1")).toMatchObject({
			is_read: 0,
			is_starred: 0,
		});
		await Promise.all([
			request("PATCH", "/articles/a1", { is_read: true }),
			request("PATCH", "/articles/a1", { is_starred: true }),
			request("PATCH", "/articles/a1", { is_later: true }),
		]);
		expect(await request<ArticleDetail>("GET", "/articles/a1")).toMatchObject({
			is_read: 1,
			is_starred: 1,
			is_later: 1,
		});
		await request("PATCH", "/articles/a1", {}, 400);
		await request("PATCH", "/articles/a1", { is_read: "true" }, 400);
		await request("PATCH", "/articles/private", { is_read: true }, 404);
		await request("GET", "/articles/missing", undefined, 404);
		await request("POST", "/read-all", { feedId: "f1", categoryId: "c1" });
		expect((await request<ArticlePage>("GET", "/articles?view=unread")).articles).toHaveLength(0);
		await request("POST", "/read-all", {});
		expect(
			await env.DB.prepare("SELECT is_read FROM articles WHERE id='private'").first("is_read"),
		).toBeNull();
	});
	test("extracts, sanitizes and persists full text with cache invalidation", async () => {
		const env = makeEnv();
		const request = client(env);
		await env.DB.exec(
			"UPDATE articles SET summary='old summary',translated_content='old translation' WHERE id='a1';",
		);
		const fetch = vi.fn(async () => {
			const response = new Response(
				`<article><h1>Article</h1><p>${"Longer full text. ".repeat(30)}</p><img src='/image.png' onerror='bad()'><script>bad()</script></article>`,
			);
			Object.defineProperty(response, "url", { value: "https://canonical.example.com/story" });
			return response;
		});
		vi.stubGlobal("fetch", fetch);
		const full = await request<ArticleDetail>("POST", "/articles/a1/full");
		expect(full.full_content_fetched).toBe(1);
		expect(full.content).toContain("Longer full text");
		expect(full.content).not.toMatch(/onerror|script/);
		expect(full.content).toContain("https://canonical.example.com/image.png");
		expect(full.summary).toBeNull();
		expect(full.translated_content).toBeNull();
		await request("POST", "/articles/a1/full");
		expect(fetch).toHaveBeenCalledOnce();
		fetch.mockRejectedValueOnce(new Error("blocked"));
		await request("POST", "/articles/a2/full", undefined, 502);
		await env.DB.exec(
			"UPDATE articles SET url='https://demo.geekhub.example/article' WHERE id='a2';",
		);
		expect((await request<ArticleDetail>("POST", "/articles/a2/full")).content).toContain(
			"Every good tool",
		);
	});
	test("AI endpoints preserve cached content and support explicit regeneration", async () => {
		const env = makeEnv();
		const request = client(env);
		await request("GET", "/ai/settings");
		await request("PATCH", "/ai/settings", { provider: "minimax", model: "MiniMax-M2.5" });
		expect(
			(await request("POST", "/ai/test", { provider: "minimax", model: "MiniMax-M2.5" })).success,
		).toBe(true);
		for (const action of ["summary", "translate", "translate-title"])
			await request("POST", "/articles/a1/ai", { action });
		const result = await request<ArticleDetail>("GET", "/articles/a1");
		expect(result.summary).toContain("本地模拟摘要");
		expect(result.translated_title).toContain("阅读手记");
		expect(result.translated_content).toContain("本地模拟译文");
		await env.DB.exec("UPDATE articles SET summary='cached' WHERE id='a1';");
		expect(
			(await request<ArticleDetail>("POST", "/articles/a1/ai", { action: "summary" })).summary,
		).toBe("cached");
		expect(
			(await request<ArticleDetail>("POST", "/articles/a1/ai", { action: "summary", force: true }))
				.summary,
		).not.toBe("cached");
		await request("POST", "/articles/private/ai", { action: "summary" }, 404);
	});
	test("preferences validate RSSHub and merge concurrent partial updates", async () => {
		const env = makeEnv();
		const request = client(env);
		expect((await request<Preferences>("GET", "/settings")).fontSize).toBe(18);
		await request("PATCH", "/settings", {
			fontSize: 22,
			showImages: false,
			rsshubUrl: "https://rsshub.example.com/",
		});
		expect(await request<Preferences>("GET", "/settings")).toMatchObject({
			fontSize: 22,
			showImages: false,
			rsshubUrl: "https://rsshub.example.com",
		});
		await request("PATCH", "/settings", { rsshubUrl: "http://[::1]" }, 400);
		await request("PATCH", "/settings", { rsshubUrl: "" }, 400);
		await Promise.all([
			request("PATCH", "/settings", { theme: "light" }),
			request("PATCH", "/settings", { fontSize: 24 }),
		]);
		expect(await request<Preferences>("GET", "/settings")).toMatchObject({
			theme: "light",
			fontSize: 24,
			showImages: false,
		});
		await env.DB.exec("DELETE FROM settings;");
		expect((await preferences(env.DB)).fontSize).toBe(18);
	});
	test("cleanup protects favorites and later, stats measure stored bodies, logs filter", async () => {
		const env = makeEnv();
		const request = client(env);
		await env.DB.exec(`UPDATE articles SET published_at='2000-01-01', is_read=1 WHERE feed_id='f1'; UPDATE articles SET is_starred=1 WHERE id='a1';
      INSERT INTO fetch_logs(feed_id,feed_title,level,message) VALUES ('f1','Example','success','Success');`);
		const stats = await request<Stats>("GET", "/stats");
		expect(stats).toMatchObject({
			feeds: 1,
			articles: 2,
			unread: 0,
			starred: 1,
			later: 0,
			logs: 1,
		});
		expect(stats.bytes).toBeGreaterThan(100);
		expect((await request("POST", "/cleanup", { days: 30, feedId: "f1" })).deleted).toBe(1);
		await env.DB.exec("UPDATE articles SET is_read=0, is_starred=0, is_later=1 WHERE id='a1';");
		expect((await request("POST", "/cleanup", { days: 30, onlyRead: false })).deleted).toBe(0);
		await env.DB.exec("UPDATE articles SET is_later=0 WHERE id='a1';");
		expect((await request("POST", "/cleanup", { days: 30, onlyRead: false })).deleted).toBe(1);
		expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM articles").first("count")).toBe(0);
		expect(await request("GET", "/logs?feedId=f1&level=success&limit=1")).toHaveLength(1);
		expect(await request("GET", "/logs?feedId=f2")).toHaveLength(0);
		await request("GET", "/logs");
		await request("DELETE", "/logs");
		expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM fetch_logs").first("count")).toBe(0);
		expect(await request("GET", "/directory")).toHaveLength(5);
		expect(await dataStats(env.DB)).toMatchObject({
			articles: 0,
			bytes: 0,
			feeds: 1,
			logs: 0,
		});
	});
	test("image proxy validates media types, URL and body limits", async () => {
		const env = makeEnv();
		const request = client(env);
		await request("GET", "/images", undefined, 400);
		await request("GET", "/images?url=http://localhost/image", undefined, 502);
		const fetch = vi.fn().mockResolvedValueOnce(
			new Response(new Uint8Array([1, 2, 3]), {
				headers: { "content-type": "image/png; charset=binary" },
			}),
		);
		vi.stubGlobal("fetch", fetch);
		const response = await app.request(
			"http://127.0.0.1/api/images?url=https://example.com/image",
			{},
			env,
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("private, max-age=3600");
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
		fetch.mockResolvedValueOnce(
			new Response("<svg onload='bad()'></svg>", { headers: { "content-type": "image/svg+xml" } }),
		);
		await request("GET", "/images?url=https://example.com/svg", undefined, 422);
		fetch.mockResolvedValueOnce(new Response(null));
		await request("GET", "/images?url=https://example.com/no-type", undefined, 422);
		fetch.mockResolvedValueOnce(
			new Response("too big", {
				headers: { "content-type": "image/png", "content-length": "99999999" },
			}),
		);
		vi.spyOn(console, "error").mockImplementation(() => {});
		await request("GET", "/images?url=https://example.com/large", undefined, 500);
	});
});
