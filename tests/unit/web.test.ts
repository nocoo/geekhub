// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Article, ArticleDetail } from "../../src/shared/contracts";
import { ApiError, aiAdapter, api } from "../../src/web/lib/api";
import {
	articleQuery,
	dateLabel,
	readerNodes,
	sizeLabel,
	titleOf,
	translateTitles,
} from "../../src/web/lib/reader";

afterEach(() => {
	document.body.replaceChildren();
});
test("reader filters, dates and display helpers handle pagination and empty states", () => {
	expect(
		articleQuery(
			{ view: "unread", search: "文字 & text", feedId: "feed", categoryId: "category" },
			"cursor",
		),
	).toContain("cursor=cursor");
	expect(articleQuery({ view: "all", search: "" })).toBe("/articles?view=all&search=");
	const now = new Date("2026-09-12T12:00:00Z").getTime();
	expect(dateLabel("invalid", now)).toBe("");
	expect(dateLabel(new Date(now).toISOString(), now)).toBe("刚刚");
	expect(dateLabel(new Date(now - 5 * 60000).toISOString(), now)).toBe("5 分钟前");
	expect(dateLabel(new Date(now - 2 * 3600000).toISOString(), now)).toBe("2 小时前");
	expect(dateLabel(new Date(now - 2 * 86400000).toISOString(), now)).toBe("2 天前");
	expect(dateLabel("2025-01-01", now)).toBeTruthy();
	expect(dateLabel(new Date().toISOString())).toBe("刚刚");
	expect(sizeLabel(1024)).toBe("1.0 KB");
	expect(sizeLabel(1048576)).toBe("1.0 MB");
	expect(titleOf({ title: "Original", translated_title: "译文" })).toBe("译文");
	expect(titleOf({ title: "Original", translated_title: null })).toBe("Original");
});

test("reader honors image preferences and routes images through the authenticated proxy", () => {
	const html = '<p>Text</p><img src="https://example.com/image.png"><img>';
	document.body.replaceChildren(readerNodes(html, true));
	expect(document.querySelector("img")?.getAttribute("src")).toBe(
		"/api/images?url=https%3A%2F%2Fexample.com%2Fimage.png",
	);
	expect(document.querySelector("img")?.referrerPolicy).toBe("no-referrer");
	document.body.replaceChildren(readerNodes(html, false));
	expect(document.querySelectorAll("img")).toHaveLength(0);
	expect(document.body.textContent).toBe("Text");
});

test("automatic title translation is sequential, cancels on navigation and never repeats failed paid work", async () => {
	const article: Article = {
		id: "one",
		feed_id: "feed",
		feed_title: "Feed",
		site_url: "https://example.com",
		title: "Title",
		url: "https://example.com/article",
		author: "Author",
		published_at: "2026-09-01T00:00:00.000Z",
		description: "Description",
		image_url: null,
		is_read: 0,
		is_starred: 0,
		is_later: 0,
		auto_translate: 1,
		translated_title: null,
		translated_description: null,
	};
	const translated: ArticleDetail = {
		...article,
		translated_title: "译文",
		content: "",
		summary: null,
		translated_content: null,
		ai_model: "test",
		full_content_fetched: 0,
	};
	const fetch = vi.fn().mockImplementation(async () => Response.json(translated));
	vi.stubGlobal("fetch", fetch);
	const attempted = new Set<string>();
	let active = true;
	const update = vi.fn(async () => {
		active = false;
	});
	await translateTitles([article, { ...article, id: "two" }], attempted, () => active, update);
	expect(fetch).toHaveBeenCalledOnce();
	expect(update).toHaveBeenCalledWith(translated);
	expect(attempted.has("two")).toBe(false);
	active = true;
	await translateTitles(
		[
			article,
			{ ...article, id: "off", auto_translate: 0 },
			{ ...article, id: "already", translated_title: "译文" },
		],
		attempted,
		() => active,
		update,
	);
	expect(fetch).toHaveBeenCalledOnce();
	fetch.mockRejectedValueOnce(new Error("network unavailable"));
	await translateTitles([{ ...article, id: "failure" }], attempted, () => active, update);
	await translateTitles([{ ...article, id: "failure" }], attempted, () => active, update);
	expect(fetch).toHaveBeenCalledTimes(2);
	expect(attempted.has("failure")).toBe(true);
});

describe("browser API adapter", () => {
	test("passes credentials, cancellation and JSON only for request bodies", async () => {
		const fetch = vi.fn(async (_request: RequestInfo | URL, _init?: RequestInit) =>
			Response.json({ ok: true }),
		);
		vi.stubGlobal("fetch", fetch);
		const signal = new AbortController().signal;
		expect(await api("/test", { method: "POST", body: { value: 1 }, signal })).toEqual({
			ok: true,
		});
		expect(fetch).toHaveBeenCalledWith(
			"/api/test",
			expect.objectContaining({
				credentials: "same-origin",
				signal,
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: '{"value":1}',
			}),
		);
		await api("/test");
		expect(fetch.mock.calls[1]?.[1]).not.toHaveProperty("body");
	});
	test("recognizes Access redirects and HTTP errors without leaking HTML", async () => {
		const redirect = Response.json({});
		Object.defineProperty(redirect, "redirected", { value: true });
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(redirect)
			.mockResolvedValueOnce(new Response("<html>Access</html>"))
			.mockResolvedValueOnce(Response.json({ error: "Conflict" }, { status: 409 }))
			.mockResolvedValueOnce(Response.json({}, { status: 500 }));
		vi.stubGlobal("fetch", fetch);
		for (let i = 0; i < 2; i++)
			await expect(api("/test")).rejects.toMatchObject({ name: "ApiError", status: 401 });
		await expect(api("/test")).rejects.toEqual(new ApiError("Conflict", 409));
		await expect(api("/test")).rejects.toMatchObject({ status: 500, message: "请求失败，请重试" });
	});
	test("implements next-ai's public storage adapter", async () => {
		const fetch = vi.fn(async (_request: RequestInfo | URL, _init?: RequestInit) =>
			Response.json({ provider: "minimax", hasApiKey: false }),
		);
		vi.stubGlobal("fetch", fetch);
		await aiAdapter.getSettings();
		await aiAdapter.saveSettings({ model: "MiniMax-M2.5" });
		await aiAdapter.testConnection({ provider: "minimax", model: "MiniMax-M2.5" });
		expect(fetch.mock.calls.map((call) => call[0])).toEqual([
			"/api/ai/settings",
			"/api/ai/settings",
			"/api/ai/test",
		]);
	});
});
