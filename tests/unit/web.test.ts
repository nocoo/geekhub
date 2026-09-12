// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Article, ArticleDetail } from "../../src/shared/contracts";
import { ApiError, aiAdapter, api } from "../../src/web/lib/api";
import {
	adjacentArticle,
	articleQuery,
	dateLabel,
	feedRevision,
	patchArticles,
	readerShortcut,
	sizeLabel,
	titleOf,
	translateTitles,
} from "../../src/web/lib/reader";
import { article, feed } from "./view-model-support";

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

test("snapshot revisions ignore status/read counts/order and respect the current feed/category", () => {
	const feeds = [feed(), feed("f2")];
	const all = { view: "all", search: "" } as const;
	expect(feedRevision(feeds, all)).toBe(
		feedRevision(
			[
				{ ...feeds[1], status: "queued", unread_count: 0 },
				{ ...feeds[0], last_fetched_at: "changed" },
			] as typeof feeds,
			all,
		),
	);
	expect(feedRevision(feeds, { ...all, feedId: "f1" })).toBe(feedRevision([feed()], all));
	expect(feedRevision(feeds, { ...all, categoryId: "c1" })).toBe(feedRevision([feed()], all));
	expect(feedRevision([{ ...feed(), total_count: 3 }], all)).not.toBe(feedRevision([feed()], all));
	const data = {
		pages: [{ articles: [article("a1"), article("a2")], nextCursor: null }],
		pageParams: [undefined],
	};
	expect(patchArticles(undefined, () => true, { is_read: 1 })).toBeUndefined();
	const patched = patchArticles(data, (item) => item.id === "a1", { is_read: 1 });
	expect(patched?.pages[0]?.articles.map((item) => item.is_read)).toEqual([1, 0]);
	expect(patched?.pages[0]?.articles[1]).toBe(data.pages[0]?.articles[1]);
	expect(adjacentArticle([], null, 1)).toBeUndefined();
	expect(adjacentArticle(data.pages[0]?.articles ?? [], null, -1)?.id).toBe("a2");
});

test("keyboard shortcuts support navigation and actions without hijacking typing, menus or browser shortcuts", () => {
	const commands = {
		j: "next",
		J: "next",
		k: "previous",
		ArrowDown: "next",
		ArrowUp: "previous",
		"/": "search",
		Escape: "back",
		m: "read",
		s: "star",
		l: "later",
		o: "original",
		r: "refresh",
	};
	for (const [key, command] of Object.entries(commands))
		expect(readerShortcut(new KeyboardEvent("keydown", { key }), false)).toBe(command);
	expect(readerShortcut(new KeyboardEvent("keydown", { key: "x" }), false)).toBeNull();
	expect(readerShortcut(new KeyboardEvent("keydown", { key: "j" }), true)).toBeNull();
	for (const flags of [
		{ ctrlKey: true },
		{ metaKey: true },
		{ altKey: true },
		{ isComposing: true },
	])
		expect(readerShortcut(new KeyboardEvent("keydown", { key: "j", ...flags }), false)).toBeNull();
	const prevented = new KeyboardEvent("keydown", { key: "j", cancelable: true });
	prevented.preventDefault();
	expect(readerShortcut(prevented, false)).toBeNull();
	expect(
		readerShortcut(new KeyboardEvent("keydown", { key: "r", repeat: true }), false),
	).toBeNull();
	expect(readerShortcut(new KeyboardEvent("keydown", { key: "j", repeat: true }), false)).toBe(
		"next",
	);
	expect(readerShortcut(new KeyboardEvent("keydown", { key: "k", repeat: true }), false)).toBe(
		"previous",
	);
	for (const markup of [
		"<input>",
		"<textarea></textarea>",
		"<select></select>",
		'<div contenteditable="true"><span></span></div>',
		'<div role="dialog"><button>Go</button></div>',
		'<div role="menu"><button>Go</button></div>',
	]) {
		document.body.innerHTML = markup;
		const event = new KeyboardEvent("keydown", { key: "j", bubbles: true });
		document.body.querySelector("span, button, input, textarea, select")?.dispatchEvent(event);
		expect(readerShortcut(event, false)).toBeNull();
	}
	for (const name of ["reader-scroll", "reader-sidebar"]) {
		document.body.innerHTML = `<div class="${name}"><button>Go</button></div>`;
		const event = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true });
		document.querySelector("button")?.dispatchEvent(event);
		expect(readerShortcut(event, false)).toBeNull();
	}
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
