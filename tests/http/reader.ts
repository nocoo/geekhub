import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import type {
	ArticleDetail,
	ArticlePage,
	Category,
	Feed,
	FeedDiagnostic,
	Stats,
} from "../../src/shared/contracts";

const base = process.env.GEEKHUB_TEST_URL;
if (
	!base ||
	new URL(base).hostname !== "127.0.0.1" ||
	process.env.RESOURCE_ENV !== "test" ||
	!process.env.GEEKHUB_TEST_STATE
)
	throw new Error("HTTP tests require the isolated local harness");
const routes = [
	...readFileSync("src/worker/index.ts", "utf8").matchAll(
		/app\.(get|post|patch|delete)\(\s*"([^"]+)"/g,
	),
].map((match) => ({ method: match[1]?.toUpperCase(), path: match[2] ?? "" }));
const covered = new Set<string>();
let checks = 0;
async function request<T = Record<string, unknown>>(
	method: string,
	path: string,
	body?: unknown,
	status = 200,
): Promise<T> {
	const response = await fetch(`${base}/api${path}`, {
		method,
		...(body === undefined
			? {}
			: { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
		signal: AbortSignal.timeout(20000),
	});
	const text = await response.text();
	assert.equal(response.status, status, `${method} ${path}: ${text}`);
	for (const route of routes)
		if (
			route.method === method &&
			new RegExp(`^${route.path.replace(/:[^/]+/g, "[^/]+")}$`).test(`/api${path.split("?")[0]}`)
		)
			covered.add(`${method} ${route.path}`);
	checks++;
	return JSON.parse(text) as T;
}

assert.equal((await request("GET", "/live")).status, "ok");
assert.equal((await request("GET", "/session")).local, true);
const initial = await request<Stats>("GET", "/stats");
assert.equal(initial.feeds, 4);
assert.equal(initial.articles, 24);
const categories = await request<Category[]>("GET", "/categories");
assert.equal(categories.length, 3);
const category = await request<Category>(
	"POST",
	"/categories",
	{ name: "HTTP 测试分类", color: "violet" },
	201,
);
await request("POST", "/categories", { name: "HTTP 测试分类" }, 409);
await request("PATCH", `/categories/${category.id}`, { name: "HTTP 分类已编辑", color: "blue" });
const categoryIds = [category.id, ...categories.map((item) => item.id)];
await request("POST", "/categories/reorder", { ids: categoryIds });
assert.deepEqual(
	(await request<Category[]>("GET", "/categories")).map((item) => item.id),
	categoryIds,
);
await request("POST", "/categories/reorder", { ids: [category.id] }, 409);
await request("PATCH", "/categories/missing-category", { name: "intruder" }, 404);
await request("POST", "/feeds", { url: "http://127.0.0.1/private" }, 400);
await request(
	"POST",
	"/feeds",
	{ url: "https://valid.example.com/feed", category_id: "missing-category" },
	404,
);
const added = await request<Feed>(
	"POST",
	"/feeds",
	{
		url: "https://demo.geekhub.example/rss/cloudflare?integration=1",
		title: "HTTP test feed",
		category_id: category.id,
	},
	201,
);
await request("PATCH", `/feeds/${added.id}`, {
	title: "HTTP updated feed",
	auto_translate: true,
	refresh_minutes: 30,
});
await request("POST", "/feeds", { url: added.url }, 409);
await request("PATCH", "/feeds/missing-feed", { title: "intruder" }, 404);
await request("DELETE", "/feeds/missing-feed", undefined, 404);
let refreshed: Feed | undefined;
for (let attempt = 0; attempt < 100; attempt++) {
	refreshed = (await request<Feed[]>("GET", "/feeds")).find((feed) => feed.id === added.id);
	if (refreshed?.status === "success") break;
	await Bun.sleep(100);
}
assert.equal(refreshed?.status, "success", "Queue consumer must actually complete");
assert.equal(refreshed.total_count, 6);
const feedIds = (await request<Feed[]>("GET", "/feeds")).map((feed) => feed.id).reverse();
await request("POST", "/feeds/reorder", { ids: feedIds, feedId: added.id, categoryId: null });
let ordered = await request<Feed[]>("GET", "/feeds");
assert.deepEqual(
	ordered.map((feed) => feed.id),
	feedIds,
);
assert.equal(ordered.find((feed) => feed.id === added.id)?.category_id, null);
await request("POST", "/feeds/reorder", {
	ids: feedIds,
	feedId: added.id,
	categoryId: category.id,
});
await request("POST", "/feeds/reorder", { ids: [added.id, added.id] }, 400);
await request("POST", "/feeds/reorder", { ids: feedIds.slice(1) }, 409);
ordered = await request<Feed[]>("GET", "/feeds");
assert.deepEqual(
	ordered.map((feed) => feed.id),
	feedIds,
	"Rejected orders are atomic",
);
await request("PATCH", `/feeds/${added.id}`, {
	site_url: "https://demo.geekhub.example/site/cloudflare",
});
assert.equal(await request("GET", `/feeds/${added.id}/diagnostics`), null);
await request("POST", `/feeds/${added.id}/diagnostics`, { siteUrl: "http://localhost" }, 400);
await request("POST", `/feeds/${added.id}/diagnostics`, {}, 202);
let diagnostic: FeedDiagnostic | undefined;
for (let attempt = 0; attempt < 100; attempt++) {
	diagnostic = await request<FeedDiagnostic>("GET", `/feeds/${added.id}/diagnostics`);
	if (diagnostic.status !== "queued" && diagnostic.status !== "running") break;
	await Bun.sleep(100);
}
assert.equal(diagnostic?.status, "success", "Diagnostic must run through the real local queue");
assert.equal(diagnostic.report?.feed.entries, 6);
assert.equal(diagnostic.report?.sites.length, 2);
assert.ok(diagnostic.report?.sites.every((site) => site.status === 200));
const replacement = diagnostic.report?.candidates.find((candidate) => !candidate.inspection.error);
assert.ok(replacement, "Main-site discovery must verify a replacement RSS");
const retained = (await request<ArticlePage>("GET", `/articles?feedId=${added.id}`)).articles[0];
assert.ok(retained);
await request("PATCH", `/articles/${retained.id}`, { is_starred: true, is_later: true });
const replaced = await request<Feed>("PATCH", `/feeds/${added.id}`, {
	url: replacement.inspection.finalUrl,
});
assert.equal(replaced.id, added.id);
assert.equal(replaced.total_count, 6);
assert.equal(await request("GET", `/feeds/${added.id}/diagnostics`), null);
assert.equal((await request<ArticleDetail>("GET", `/articles/${retained.id}`)).is_starred, 1);
assert.equal((await request<ArticleDetail>("GET", `/articles/${retained.id}`)).is_later, 1);
await request("PATCH", `/feeds/${added.id}`, { url: "http://127.0.0.1/private" }, 400);
await request("POST", `/feeds/${added.id}/refresh`, undefined, 202);
const first = await request<ArticlePage>("GET", "/articles?limit=5");
assert.equal(first.articles.length, 5);
assert.ok(first.nextCursor);
const next = await request<ArticlePage>(
	"GET",
	`/articles?limit=5&cursor=${encodeURIComponent(first.nextCursor)}`,
);
assert.ok(
	!next.articles.some((article) => first.articles.some((earlier) => earlier.id === article.id)),
	"Keyset pagination cannot repeat rows",
);
await request("GET", "/articles?cursor=broken", undefined, 400);
const scoped = await request<ArticlePage>(
	"GET",
	`/articles?feedId=${added.id}&categoryId=${category.id}&search=quiet`,
);
assert.equal(scoped.articles.length, 1);
assert.equal(
	(await request<ArticlePage>("GET", "/articles?feedId=missing-feed")).articles.length,
	0,
);
const article = first.articles[0];
assert.ok(article);
const detail = await request<ArticleDetail>("GET", `/articles/${article.id}`);
assert.ok(detail.content.length > 100);
await request("GET", "/articles/missing-article", undefined, 404);
await request("PATCH", "/articles/missing-article", { is_starred: true }, 404);
await Promise.all([
	request("PATCH", `/articles/${article.id}`, { is_read: true }),
	request("PATCH", `/articles/${article.id}`, { is_starred: true }),
	request("PATCH", `/articles/${article.id}`, { is_later: true }),
]);
const changed = await request<ArticleDetail>("GET", `/articles/${article.id}`);
assert.equal(
	changed.is_read + changed.is_starred + changed.is_later,
	3,
	"Concurrent status patches preserve each other",
);
for (const view of ["starred", "later"])
	assert.ok(
		(await request<ArticlePage>("GET", `/articles?view=${view}`)).articles.some(
			(item) => item.id === article.id,
		),
	);
assert.ok(
	!(await request<ArticlePage>("GET", "/articles?view=unread")).articles.some(
		(item) => item.id === article.id,
	),
);
await request("POST", "/read-all", { feedId: added.id, categoryId: category.id });
assert.equal(
	(await request<ArticlePage>("GET", `/articles?feedId=${added.id}&view=unread`)).articles.length,
	0,
);
const full = await request<ArticleDetail>("POST", `/articles/${article.id}/full`);
assert.equal(full.full_content_fetched, 1);
for (const action of ["summary", "translate", "translate-title"]) {
	const result: ArticleDetail = await request<ArticleDetail>("POST", `/articles/${article.id}/ai`, {
		action,
	});
	assert.equal(result.ai_model, "local-mock");
}
const aiArticle = await request<ArticleDetail>("GET", `/articles/${article.id}`);
assert.ok(aiArticle.summary && aiArticle.translated_content && aiArticle.translated_title);
await request("POST", "/articles/missing-article/ai", { action: "summary" }, 404);
await request("GET", "/settings");
await request("PATCH", "/settings", {
	theme: "light",
	fontSize: 20,
	fontFamily: "sans",
	showImages: false,
	rsshubUrl: "https://rsshub.app",
});
assert.equal((await request("GET", "/settings")).fontSize, 20);
await request("PATCH", "/settings", { fontSize: 99 }, 400);
await request("PATCH", "/settings", { rsshubUrl: "http://localhost:9000" }, 400);
assert.equal((await request("GET", "/ai/settings")).hasApiKey, false);
assert.equal(
	(await request("POST", "/ai/test", { provider: "minimax", model: "MiniMax-M2.5" })).success,
	true,
);
const fakeKey = `test-only-${crypto.randomUUID()}`;
const saved = await request("PATCH", "/ai/settings", {
	provider: "minimax",
	model: "MiniMax-M2.5",
	apiKey: fakeKey,
});
assert.equal(saved.hasApiKey, true);
assert.ok(!JSON.stringify(saved).includes(fakeKey));
assert.ok(!JSON.stringify(await request("GET", "/ai/settings")).includes(fakeKey));
await request("PATCH", "/ai/settings", { apiKey: "" });
await request(
	"PATCH",
	"/ai/settings",
	{
		provider: "custom",
		model: "test",
		sdkType: "openai",
		baseURL: "http://localhost:9999",
		apiKey: fakeKey,
	},
	400,
);
await request("GET", "/directory");
await request("GET", "/logs");
await request("GET", `/logs?feedId=${added.id}&level=success&limit=10`);
await request("POST", "/cleanup", { days: 1, onlyRead: true });
await request("GET", "/images", undefined, 400);
await request("GET", "/images?url=http://127.0.0.1/private", undefined, 502);
await request("POST", "/refresh", undefined, 202);
await request("PATCH", `/feeds/${added.id}`, { is_active: false });
assert.equal(
	(await request<Feed[]>("GET", "/feeds")).find((feed) => feed.id === added.id)?.is_active,
	0,
);
await request("DELETE", `/categories/${category.id}`);
assert.equal(
	(await request<Feed[]>("GET", "/feeds")).find((feed) => feed.id === added.id)?.category_id,
	null,
);
await request("DELETE", `/feeds/${added.id}`);
assert.equal(
	(await request<ArticlePage>("GET", `/articles?feedId=${added.id}`)).articles.length,
	0,
);
await request("DELETE", "/logs");
const crossSite = await fetch(`${base}/api/categories`, {
	method: "POST",
	headers: { origin: "https://attacker.example.com", "content-type": "application/json" },
	body: JSON.stringify({ name: "CSRF" }),
});
assert.equal(crossSite.status, 403);
const spoofed = await fetch(`${base}/api/session`, {
	headers: { "cf-connecting-ip": "203.0.113.4" },
});
assert.equal(spoofed.status, 403);
await request("GET", "/not-an-endpoint", undefined, 404);
const missing = routes.filter((route) => !covered.has(`${route.method} ${route.path}`));
assert.deepEqual(missing, [], "Every API method/path needs a real HTTP check");
writeFileSync(
	"test-results/l2/endpoints.json",
	JSON.stringify(
		{
			at: new Date().toISOString(),
			checks,
			endpoints: [...covered].sort(),
			coverage: `${covered.size}/${routes.length}`,
			runtime: "Wrangler local Worker + SQLite",
		},
		null,
		2,
	),
);
console.log(
	`L2 passed: ${checks} real HTTP checks, ${covered.size}/${routes.length} API endpoints, queue, pagination, missing records, AI and cleanup.`,
);
