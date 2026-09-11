import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Article, DirectoryFeed, FeedJob } from "../shared/contracts";
import {
	aiActionInput,
	aiInput,
	articleUpdate,
	categoryInput,
	cleanupInput,
	decodeCursor,
	encodeCursor,
	feedInput,
	feedUpdate,
	markReadInput,
	preferencesInput,
	publicUrl,
	resolveFeedUrl,
} from "../shared/validation";
import { APP_VERSION } from "../shared/version";
import { aiCached, aiSettings, saveAiSettings, testAi, transformArticle } from "./ai";
import { type AppEnv, authenticate } from "./auth";
import { articleDetail, dataStats, getFeed, listFeeds, preferences, requireCategory } from "./data";
import { enqueueFeed, refreshFeed, scheduleFeeds } from "./feeds";
import { withAuthorProfile } from "./lib/author-profile";
import { extractArticle } from "./lib/content";
import { fail } from "./lib/errors";
import { fetchPublic, readBounded } from "./lib/network";
import { demoArticleContent, demoHost } from "./local";

export const app = new Hono<AppEnv>();

app.onError((error, c) => {
	if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
	if (error instanceof z.ZodError || error instanceof SyntaxError)
		return c.json({ error: "请求参数无效，请检查输入" }, 400);
	if (/UNIQUE constraint failed/.test(error.message))
		return c.json({ error: "该名称或订阅源已存在" }, 409);
	console.error(
		JSON.stringify({
			event: "request_error",
			method: c.req.method,
			path: c.req.path,
			type: error.name,
		}),
	);
	return c.json({ error: "服务暂时不可用，请稍后重试" }, 500);
});
app.use("/api/*", async (c, next) => {
	c.header("X-Content-Type-Options", "nosniff");
	c.header("Cache-Control", "no-store");
	await next();
});
app.get("/api/live", async (c) => {
	try {
		await c.env.DB.prepare("SELECT 1 FROM settings WHERE id = 1").first();
		return c.json({ status: "ok", version: APP_VERSION, storage: "d1" });
	} catch {
		return c.json({ status: "unavailable", version: APP_VERSION }, 503);
	}
});
app.use("/api/*", authenticate);
app.use(
	"/api/*",
	bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: "请求内容超过大小限制" }, 413) }),
);

app.get("/api/session", async (c) => {
	const local = c.get("local");
	const user = c.get("user");
	const lookup = c.env.RESOURCE_ENV !== "test" && (!local || Boolean(c.env.LOCAL_USER_EMAIL));
	return c.json({
		user: lookup ? await withAuthorProfile(user) : { ...user, avatarUrl: null },
		local,
	});
});
app.get("/api/categories", async (c) =>
	c.json(
		(
			await c.env.DB.prepare(
				"SELECT id, name, color, icon, sort_order FROM categories ORDER BY sort_order, name",
			).all()
		).results,
	),
);
app.post("/api/categories", async (c) => {
	const input = categoryInput.parse(await c.req.json());
	const id = crypto.randomUUID();
	await c.env.DB.prepare(
		"INSERT INTO categories (id, name, color, icon, sort_order) VALUES (?, ?, ?, ?, ?)",
	)
		.bind(id, input.name, input.color, input.icon ?? "", input.sort_order ?? 0)
		.run();
	return c.json({ id, icon: "", sort_order: 0, ...input }, 201);
});
app.patch("/api/categories/:id", async (c) => {
	const input = categoryInput.parse(await c.req.json());
	const id = c.req.param("id");
	await requireCategory(c.env.DB, id);
	await c.env.DB.prepare(
		"UPDATE categories SET name = ?, color = ?, icon = COALESCE(?, icon), sort_order = COALESCE(?, sort_order) WHERE id = ?",
	)
		.bind(input.name, input.color, input.icon ?? null, input.sort_order ?? null, id)
		.run();
	return c.json({ id, ...input });
});
app.delete("/api/categories/:id", async (c) => {
	const id = c.req.param("id");
	await requireCategory(c.env.DB, id);
	await c.env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
	return c.json({ ok: true });
});

app.get("/api/feeds", async (c) => c.json(await listFeeds(c.env.DB)));
app.post("/api/feeds", async (c) => {
	const input = feedInput.parse(await c.req.json());
	await requireCategory(c.env.DB, input.category_id);
	let url: string;
	try {
		const resolved = resolveFeedUrl(input.url, (await preferences(c.env.DB)).rsshubUrl);
		url = input.url.startsWith("rsshub://") ? input.url : resolved;
	} catch {
		fail(400, "请输入有效的公开 RSS 地址或 RSSHub 路由");
	}
	const count = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM feeds").first<{
		count: number;
	}>();
	if (count && count.count >= 500) fail(422, "最多订阅 500 个源");
	const id = crypto.randomUUID();
	const title =
		input.title || new URL(resolveFeedUrl(url, (await preferences(c.env.DB)).rsshubUrl)).hostname;
	await c.env.DB.prepare("INSERT INTO feeds (id, category_id, title, url) VALUES (?, ?, ?, ?)")
		.bind(id, input.category_id ?? null, title, url)
		.run();
	// Persist first: a transient queue failure leaves a visible, retryable subscription.
	try {
		await enqueueFeed(c.env, { feedId: id });
	} catch {
		/* enqueueFeed persists the failure for retry in the UI. */
	}
	return c.json(await getFeed(c.env.DB, id), 201);
});
app.patch("/api/feeds/:id", async (c) => {
	const input = feedUpdate.parse(await c.req.json());
	const id = c.req.param("id");
	await getFeed(c.env.DB, id);
	await requireCategory(c.env.DB, input.category_id);
	const entries = Object.entries(input);
	await c.env.DB.prepare(
		`UPDATE feeds SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE id = ?`,
	)
		.bind(...entries.map(([, value]) => (typeof value === "boolean" ? Number(value) : value)), id)
		.run();
	return c.json(await getFeed(c.env.DB, id));
});
app.delete("/api/feeds/:id", async (c) => {
	const id = c.req.param("id");
	await getFeed(c.env.DB, id);
	await c.env.DB.prepare("DELETE FROM feeds WHERE id = ?").bind(id).run();
	return c.json({ ok: true });
});
app.post("/api/feeds/:id/refresh", async (c) => {
	const id = c.req.param("id");
	await getFeed(c.env.DB, id);
	return c.json({ queued: await enqueueFeed(c.env, { feedId: id }) }, 202);
});
app.post("/api/refresh", async (c) => {
	const feeds = await listFeeds(c.env.DB);
	let queued = 0;
	for (const feed of feeds)
		if (feed.is_active && (await enqueueFeed(c.env, { feedId: feed.id }))) queued++;
	return c.json({ queued }, 202);
});

const listInput = z.object({
	view: z.enum(["all", "unread", "starred", "later"]).default("all"),
	feedId: z.string().optional(),
	categoryId: z.string().optional(),
	search: z.string().max(200).default(""),
	cursor: z.string().max(512).optional(),
	limit: z.coerce.number().int().min(1).max(50).default(30),
});
app.get("/api/articles", async (c) => {
	const input = listInput.parse(c.req.query());
	const where = ["1 = 1"];
	const params: (string | number)[] = [];
	if (input.feedId) {
		where.push("f.id = ?");
		params.push(input.feedId);
	}
	if (input.categoryId) {
		where.push("f.category_id = ?");
		params.push(input.categoryId);
	}
	if (input.view === "unread") where.push("a.is_read = 0");
	if (input.view === "starred") where.push("a.is_starred = 1");
	if (input.view === "later") where.push("a.is_later = 1");
	if (input.search) {
		where.push(
			"(a.title LIKE ? ESCAPE '\\' OR a.description LIKE ? ESCAPE '\\' OR a.translated_title LIKE ? ESCAPE '\\')",
		);
		const search = `%${input.search.replace(/[\\%_]/g, "\\$&")}%`;
		params.push(search, search, search);
	}
	if (input.cursor) {
		let cursor: ReturnType<typeof decodeCursor>;
		try {
			cursor = decodeCursor(input.cursor);
		} catch {
			fail(400, "分页游标无效");
		}
		where.push("(a.published_at < ? OR (a.published_at = ? AND a.id < ?))");
		params.push(cursor.date, cursor.date, cursor.id);
	}
	const rows =
		await c.env.DB.prepare(`SELECT a.id, a.feed_id, f.title AS feed_title, f.site_url, f.auto_translate,
    a.title, a.url, a.author, a.published_at, a.description, a.image_url, a.is_read, a.is_starred, a.is_later,
    a.translated_title, a.translated_description FROM articles a JOIN feeds f ON a.feed_id = f.id
    WHERE ${where.join(" AND ")} ORDER BY a.published_at DESC, a.id DESC LIMIT ?`)
			.bind(...params, input.limit + 1)
			.all<Article>();
	const articles = rows.results.slice(0, input.limit);
	const last = articles.at(-1);
	return c.json({
		articles,
		nextCursor:
			rows.results.length > input.limit && last ? encodeCursor(last.published_at, last.id) : null,
	});
});
app.get("/api/articles/:id", async (c) => c.json(await articleDetail(c.env.DB, c.req.param("id"))));
app.patch("/api/articles/:id", async (c) => {
	const input = articleUpdate.parse(await c.req.json());
	const id = c.req.param("id");
	await articleDetail(c.env.DB, id);
	const entries = Object.entries(input);
	await c.env.DB.prepare(
		`UPDATE articles SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE id = ?`,
	)
		.bind(...entries.map(([, value]) => Number(value)), id)
		.run();
	return c.json(await articleDetail(c.env.DB, id));
});
app.post("/api/read-all", async (c) => {
	const input = markReadInput.parse(await c.req.json());
	const clauses = ["1 = 1"];
	const params: string[] = [];
	if (input.feedId) {
		clauses.push("id = ?");
		params.push(input.feedId);
	}
	if (input.categoryId) {
		clauses.push("category_id = ?");
		params.push(input.categoryId);
	}
	const result = await c.env.DB.prepare(
		`UPDATE articles SET is_read = 1 WHERE is_read = 0 AND feed_id IN (SELECT id FROM feeds WHERE ${clauses.join(" AND ")})`,
	)
		.bind(...params)
		.run();
	return c.json({ updated: result.meta.changes });
});
app.post("/api/articles/:id/full", async (c) => {
	const id = c.req.param("id");
	const article = await articleDetail(c.env.DB, id);
	if (!article.full_content_fetched) {
		let html: string;
		let baseUrl = article.url;
		try {
			if (c.get("local") && new URL(article.url).hostname === demoHost) {
				html = `<article>${demoArticleContent(article.title)}</article>`;
			} else {
				const response = await fetchPublic(article.url, { Accept: "text/html" });
				baseUrl = response.url || article.url;
				html = new TextDecoder().decode(await readBounded(response, 4 * 1024 * 1024));
			}
			const content = extractArticle(html, baseUrl).content;
			await c.env.DB.prepare(
				"UPDATE articles SET content = ?, full_content_fetched = 1, summary = NULL, translated_content = NULL WHERE id = ?",
			)
				.bind(content, id)
				.run();
		} catch {
			fail(502, "无法提取正文，网站可能限制抓取；可以打开原文阅读");
		}
	}
	return c.json(await articleDetail(c.env.DB, id));
});
app.post("/api/articles/:id/ai", async (c) => {
	const { action, force } = aiActionInput.parse(await c.req.json());
	const id = c.req.param("id");
	const article = await articleDetail(c.env.DB, id);
	if (force || !aiCached(article, action))
		await transformArticle(c.env, article, action, c.get("local"));
	return c.json(await articleDetail(c.env.DB, id));
});

app.get("/api/settings", async (c) => c.json(await preferences(c.env.DB)));
app.patch("/api/settings", async (c) => {
	const input = preferencesInput.parse(await c.req.json());
	if (input.rsshubUrl) {
		try {
			input.rsshubUrl = publicUrl(input.rsshubUrl).href.replace(/\/$/, "");
		} catch {
			fail(400, "RSSHub 实例地址无效");
		}
	}
	await c.env.DB.prepare(
		"UPDATE settings SET preferences = json_patch(preferences, ?) WHERE id = 1",
	)
		.bind(JSON.stringify(input))
		.run();
	return c.json(await preferences(c.env.DB));
});
app.get("/api/ai/settings", async (c) => c.json(await aiSettings(c.env, c.get("local"))));
app.patch("/api/ai/settings", async (c) =>
	c.json(await saveAiSettings(c.env, aiInput.parse(await c.req.json()), c.get("local"))),
);
app.post("/api/ai/test", async (c) =>
	c.json(await testAi(c.env, aiInput.parse(await c.req.json()), c.get("local"))),
);
app.get("/api/stats", async (c) => c.json(await dataStats(c.env.DB)));
app.post("/api/cleanup", async (c) => {
	const input = cleanupInput.parse(await c.req.json());
	const params = [new Date(Date.now() - input.days * 86400_000).toISOString()];
	if (input.feedId) params.push(input.feedId);
	const result =
		await c.env.DB.prepare(`DELETE FROM articles WHERE published_at < ? AND is_starred = 0 AND is_later = 0 ${input.onlyRead ? "AND is_read = 1" : ""}
    AND feed_id IN (SELECT id FROM feeds ${input.feedId ? "WHERE id = ?" : ""})`)
			.bind(...params)
			.run();
	return c.json({ deleted: result.meta.changes });
});
app.get("/api/logs", async (c) => {
	const input = z
		.object({
			feedId: z.string().optional(),
			level: z.enum(["info", "success", "error"]).optional(),
			limit: z.coerce.number().int().min(1).max(200).default(80),
		})
		.parse(c.req.query());
	const clauses = ["1 = 1"];
	const params: (string | number)[] = [];
	if (input.feedId) {
		clauses.push("feed_id = ?");
		params.push(input.feedId);
	}
	if (input.level) {
		clauses.push("level = ?");
		params.push(input.level);
	}
	return c.json(
		(
			await c.env.DB.prepare(
				`SELECT id, feed_id, feed_title, level, message, articles_added, duration_ms, created_at FROM fetch_logs WHERE ${clauses.join(" AND ")} ORDER BY id DESC LIMIT ?`,
			)
				.bind(...params, input.limit)
				.all()
		).results,
	);
});
app.delete("/api/logs", async (c) => {
	await c.env.DB.prepare("DELETE FROM fetch_logs").run();
	return c.json({ ok: true });
});
app.get("/api/directory", async (c) => {
	const rows = await c.env.DB.prepare(
		"SELECT id, title, url, site_url, description, category, tags, score, last_updated FROM directory ORDER BY COALESCE(json_extract(score, '$.overall'), 0) DESC, title",
	).all<Omit<DirectoryFeed, "tags" | "score"> & { tags: string; score: string }>();
	return c.json(
		rows.results.map((row) => ({
			...row,
			tags: JSON.parse(row.tags),
			score: JSON.parse(row.score),
		})),
	);
});
app.get("/api/images", async (c) => {
	const url = c.req.query("url");
	if (!url) fail(400, "图片地址不能为空");
	let response: Response;
	try {
		response = await fetchPublic(url, { Accept: "image/avif,image/webp,image/*" });
	} catch {
		fail(502, "图片加载失败");
	}
	const type = response.headers.get("content-type")?.split(";")[0];
	if (!type || !/^image\/(jpeg|png|gif|webp|avif)$/.test(type)) {
		await response.body?.cancel();
		fail(422, "不支持的图片格式");
	}
	const data = await readBounded(response, 4 * 1024 * 1024);
	return new Response(data, {
		headers: {
			"content-type": type,
			"cache-control": "private, max-age=3600",
			"x-content-type-options": "nosniff",
		},
	});
});
app.notFound((c) => c.json({ error: "接口不存在" }, 404));

export default {
	fetch: app.fetch,
	async queue(batch: MessageBatch<FeedJob>, env: Env) {
		for (const message of batch.messages) {
			try {
				await refreshFeed(env, message.body);
				message.ack();
			} catch {
				message.retry({ delaySeconds: 60 });
			}
		}
	},
	async scheduled(_controller: ScheduledController, env: Env) {
		await scheduleFeeds(env);
	},
} satisfies ExportedHandler<Env, FeedJob>;
