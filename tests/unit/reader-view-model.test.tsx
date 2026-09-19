// @vitest-environment jsdom
import { focusManager, onlineManager } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import {
	type ArticleDetail,
	type ArticlePage,
	defaultPreferences,
} from "../../src/shared/contracts";
import { useReaderViewModel } from "../../src/web/lib/reader-view-model";
import {
	article,
	deferred,
	feed,
	queryHarness,
	readerHarness,
	transport,
} from "./view-model-support";

afterEach(() => {
	cleanup();
	history.replaceState(null, "", "/");
	sessionStorage.clear();
	focusManager.setFocused(undefined);
	onlineManager.setOnline(true);
});

test("mark-all still updates loaded rows when subscription metadata is unavailable", async () => {
	const server = transport();
	server.routes.set("GET /api/feeds", async () =>
		Response.json({ error: "metadata unavailable" }, { status: 503 }),
	);
	const { result } = await readerHarness();
	await act(async () => {
		await result.current.markRead.mutateAsync({ view: "all", search: "" });
	});
	await waitFor(() =>
		expect(result.current.articles.map((item) => item.is_read)).toEqual([1, 1, 1]),
	);
});

test("exposes defaults during loading and supports a direct article link", async () => {
	const server = transport();
	const gate = deferred<Response>();
	server.routes.set("GET /api/settings", () => gate.promise);
	history.replaceState(null, "", "/?article=a1");
	const { wrapper } = queryHarness();
	const { result } = renderHook(() => useReaderViewModel(vi.fn()), { wrapper });
	expect(result.current.articles).toEqual([]);
	expect(result.current.preferences).toEqual(defaultPreferences);
	expect(result.current.preferencesLoaded).toBe(false);
	expect(result.current.heading).toBe("全部文章");
	await waitFor(() => expect(result.current.detail.data?.id).toBe("a1"));
	await act(async () => gate.resolve(Response.json({ ...defaultPreferences, theme: "light" })));
	await waitFor(() => expect(result.current.preferencesLoaded).toBe(true));
	expect(result.current.preferences.theme).toBe("light");
	act(() => result.current.back());
	expect(result.current.selected).toBeNull();
	expect(location.search).toBe("");
});

test("metadata updates and focus/reconnect keep the visible list and detail snapshot", async () => {
	const server = transport();
	const { result, client, notify } = await readerHarness();
	act(() => result.current.open(article("a1")));
	await waitFor(() => expect(result.current.detail.data?.is_read).toBe(1));
	const snapshot = result.current.articles;
	const detail = result.current.detail.data;
	const initialRequests = server.articleRequests().length;
	server.routes.set("GET /api/feeds", [
		{ ...feed(), status: "fetching", unread_count: 0, last_fetched_at: "2026-09-12T01:00:00Z" },
		feed("f2"),
	]);
	await act(async () => {
		await client.invalidateQueries({ queryKey: ["feeds"] });
	});
	await waitFor(() => expect(result.current.busy).toBe(true));
	expect(result.current.articles).toBe(snapshot);
	await act(async () => {
		focusManager.setFocused(false);
		focusManager.setFocused(true);
		onlineManager.setOnline(false);
		onlineManager.setOnline(true);
	});
	await waitFor(() => expect(client.isFetching()).toBe(0));
	expect(server.articleRequests()).toHaveLength(initialRequests);
	expect(result.current.detail.data).toBe(detail);
	server.routes.set("GET /api/articles?view=all&search=", {
		articles: [article("new"), ...server.articles],
		nextCursor: null,
	});
	server.routes.set("GET /api/feeds", [{ ...feed(), total_count: 3 }, feed("f2")]);
	await act(async () => {
		await client.invalidateQueries({ queryKey: ["feeds"] });
	});
	await waitFor(() => expect(result.current.articles[0]?.id).toBe("new"));
	expect(notify).toHaveBeenCalledExactlyOnceWith("已自动载入 1 篇新文章");
	expect(result.current.selected).toBe("a1");
	expect(result.current.detail.data).toBe(detail);
});

test("reading writes retain unread rows, merge only the requested fields and leave failures unchanged", async () => {
	const server = transport();
	const { result } = await readerHarness();
	act(() => result.current.choose({ view: "unread", search: "" }));
	await waitFor(() => expect(result.current.articles).toHaveLength(3));
	act(() => result.current.open(article("a1")));
	await waitFor(() => expect(result.current.detail.data?.is_read).toBe(1));
	const count = server.articleRequests().length;
	server.routes.set("PATCH /api/articles/a1", {
		...article("a1"),
		content: "STALE CONTENT",
		is_starred: 1,
	});
	await act(async () => {
		await result.current.articleWrite.mutateAsync({ id: "a1", body: { is_starred: true } });
	});
	await waitFor(() =>
		expect(result.current.detail.data).toMatchObject({
			is_read: 1,
			is_starred: 1,
			content: "<p>Content a1</p>",
		}),
	);
	expect(result.current.articles.find((item) => item.id === "a1")).toMatchObject({
		is_read: 1,
		is_starred: 1,
	});
	expect(server.articleRequests()).toHaveLength(count);
	server.routes.set("PATCH /api/articles/a1", async () =>
		Response.json({ error: "write failed" }, { status: 503 }),
	);
	await act(async () => {
		await expect(
			result.current.articleWrite.mutateAsync({ id: "a1", body: { is_starred: false } }),
		).rejects.toThrow("write failed");
	});
	expect(result.current.detail.data?.is_starred).toBe(1);
	expect(result.current.articles).toHaveLength(3);
});

test("status changes are serialized, including mark-all, to preserve the user's action order", async () => {
	const server = transport();
	const { result } = await readerHarness();
	const gate = deferred<Response>();
	let patches = 0;
	server.routes.set("PATCH /api/articles/a1", async () =>
		++patches === 1 ? gate.promise : Response.json(article("a1")),
	);
	let first!: Promise<ArticleDetail>;
	let second!: Promise<ArticleDetail>;
	act(() => {
		first = result.current.articleWrite.mutateAsync({ id: "a1", body: { is_read: true } });
	});
	await waitFor(() => expect(patches).toBe(1));
	act(() => {
		second = result.current.articleWrite.mutateAsync({ id: "a1", body: { is_read: false } });
	});
	expect(patches).toBe(1);
	await act(async () => {
		gate.resolve(Response.json({ ...article("a1"), is_read: 1 }));
		await first;
		await second;
	});
	expect(result.current.articles.find((item) => item.id === "a1")?.is_read).toBe(0);
	await act(async () => {
		await result.current.markRead.mutateAsync({
			view: "all",
			search: "",
			feedId: "f1",
			categoryId: "c1",
		});
	});
	await waitFor(() =>
		expect(result.current.articles.map((item) => item.is_read)).toEqual([1, 1, 0]),
	);
	await act(async () => {
		await result.current.markRead.mutateAsync({ view: "all", search: "" });
	});
	await waitFor(() =>
		expect(result.current.articles.map((item) => item.is_read)).toEqual([1, 1, 1]),
	);
	expect(result.current.articles).toHaveLength(3);
});

test("saved translations open by default while an explicit original choice survives refetches", async () => {
	const server = transport();
	const saved = {
		...article("a1"),
		translated_title: "已保存标题",
		summary: "已保存摘要",
		translated_content: "<p>已保存译文</p>",
	};
	server.routes.set("GET /api/articles/a1", saved);
	history.replaceState(null, "", "/articles/a1");
	const { result } = await readerHarness();
	expect(result.current.detail.data).toMatchObject(saved);
	expect(result.current.translation).toBe(true);
	act(() => result.current.setTranslation(false));
	await act(async () => {
		await result.current.detail.refetch();
	});
	expect(result.current.translation).toBe(false);
	act(() => result.current.open(article("a2")));
	await waitFor(() => expect(result.current.detail.data?.id).toBe("a2"));
	expect(result.current.translation).toBe(false);
	act(() => result.current.open(saved));
	await waitFor(() => expect(result.current.detail.data?.id).toBe("a1"));
	expect(result.current.translation).toBe(true);
	expect(server.fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
});

test("AI and full-text actions update only their results and preserve reading state", async () => {
	const server = transport();
	const { result } = await readerHarness();
	act(() => result.current.open(article("a1")));
	await waitFor(() => expect(result.current.detail.data?.is_read).toBe(1));
	const generated = {
		...article("a1"),
		summary: "Summary",
		translated_title: "译文",
		translated_description: "简介",
		translated_content: "<p>正文译文</p>",
		ai_model: "test",
	};
	server.routes.set("POST /api/articles/a1/ai", generated);
	for (const kind of ["summary", "translate-title", "translate"] as const)
		await act(async () => {
			await result.current.action.mutateAsync({ id: "a1", kind });
		});
	await waitFor(() =>
		expect(result.current.detail.data).toMatchObject({
			is_read: 1,
			summary: "Summary",
			translated_title: "译文",
			translated_content: "<p>正文译文</p>",
		}),
	);
	expect(result.current.translation).toBe(true);
	server.routes.set("POST /api/articles/a1/full", {
		...article("a1"),
		content: "<p>Complete text</p>",
		full_content_fetched: 1,
	});
	await act(async () => {
		await result.current.action.mutateAsync({ id: "a1", kind: "full" });
	});
	await waitFor(() =>
		expect(result.current.detail.data).toMatchObject({
			is_read: 1,
			translated_title: "译文",
			summary: null,
			content: "<p>Complete text</p>",
		}),
	);
	expect(result.current.translation).toBe(false);
	const gate = deferred<Response>();
	server.routes.set("POST /api/articles/a1/ai", () => gate.promise);
	let running!: Promise<ArticleDetail>;
	act(() => {
		running = result.current.action.mutateAsync({ id: "a1", kind: "translate" });
	});
	await waitFor(() => expect(result.current.actionBusy).toBe("translate"));
	act(() => result.current.open(article("b1", "f2")));
	await waitFor(() => expect(result.current.actionBusy).toBeNull());
	await act(async () => {
		gate.resolve(Response.json(generated));
		await running;
	});
	expect(result.current.translation).toBe(false);
	expect(result.current.selected).toBe("b1");
});

test("navigation and shortcuts open adjacent articles without redundant writes", async () => {
	const server = transport();
	const { result } = await readerHarness();
	const initialVisit = result.current.visit;
	await act(async () => {
		await result.current.move(1);
	});
	await waitFor(() => expect(result.current.detail.data?.id).toBe("a1"));
	const writes = () =>
		server.fetch.mock.calls.filter(([, init]) => init?.method === "PATCH").length;
	const initial = writes();
	act(() => result.current.open(article("a1")));
	expect(writes()).toBe(initial);
	await act(async () => {
		await result.current.move(1);
	});
	expect(result.current.selected).toBe("a2");
	await act(async () => {
		await result.current.move(-1);
	});
	expect(result.current.selected).toBe("a1");
	await act(async () => {
		await result.current.move(-1);
	});
	expect(result.current.selected).toBe("a1");
	act(() => result.current.back());
	await act(async () => {
		await result.current.move(-1);
	});
	expect(result.current.selected).toBe("b1");
	await act(async () => {
		await result.current.move(1);
	});
	expect(result.current.selected).toBe("b1");
	act(() => result.current.choose({ view: "all", feedId: "f1", search: "needle" }));
	expect(result.current.heading).toBe("First feed");
	expect(result.current.selected).toBeNull();
	expect(result.current.visit).not.toBe(initialVisit);
	act(() => result.current.choose({ view: "all", categoryId: "c1", search: "" }));
	expect(result.current.heading).toBe("Engineering");
	act(() => result.current.choose({ view: "starred", search: "" }));
	expect(result.current.heading).toBe("我的收藏");
});

test("next at the end loads a page and keeps manual selection when a slow page arrives", async () => {
	const server = transport();
	server.routes.set("GET /api/articles?view=all&search=", {
		articles: [article("a1")],
		nextCursor: "next",
	});
	const { result } = await readerHarness();
	act(() => result.current.open(article("a1")));
	const gate = deferred<Response>();
	server.routes.set("GET /api/articles?view=all&search=&cursor=next", () => gate.promise);
	let moving!: Promise<void>;
	act(() => {
		moving = result.current.move(1);
	});
	await waitFor(() => expect(result.current.pages.isFetchingNextPage).toBe(true));
	await act(async () => {
		await result.current.move(1);
	});
	act(() => result.current.back());
	await act(async () => {
		gate.resolve(Response.json({ articles: [article("a2")], nextCursor: null }));
		await moving;
	});
	expect(result.current.selected).toBeNull();
	await waitFor(() => expect(result.current.articles.map((item) => item.id)).toEqual(["a1", "a2"]));
});

test("next-page navigation selects the new row only in the same visit", async () => {
	const server = transport();
	server.routes.set("GET /api/articles?view=all&search=", {
		articles: [article("a1")],
		nextCursor: "next",
	});
	server.routes.set("GET /api/articles?view=all&search=&cursor=next", {
		articles: [article("a2")],
		nextCursor: null,
	});
	const { result } = await readerHarness();
	act(() => result.current.open(article("a1")));
	await act(async () => {
		await result.current.move(1);
	});
	expect(result.current.selected).toBe("a2");
});

test("list refresh errors retain cached rows and a refresh finishing after navigation is not accepted", async () => {
	const server = transport();
	const { result, notify } = await readerHarness();
	const snapshot = result.current.articles;
	server.routes.set("GET /api/articles?view=all&search=", async () =>
		Response.json({ error: "offline" }, { status: 503 }),
	);
	await act(async () => {
		expect(await result.current.reloadArticles()).toBe(false);
	});
	expect(result.current.articles).toBe(snapshot);
	expect(notify).toHaveBeenCalledWith("offline");
	const gate = deferred<Response>();
	server.routes.set("GET /api/articles?view=all&search=", () => gate.promise);
	let accepting!: Promise<boolean>;
	act(() => {
		accepting = result.current.reloadArticles();
	});
	await waitFor(() => expect(result.current.pages.isFetching).toBe(true));
	act(() => result.current.choose({ view: "all", feedId: "f2", search: "" }));
	await act(async () => {
		gate.resolve(Response.json({ articles: [article("old")], nextCursor: null }));
		expect(await accepting).toBe(false);
	});
	expect(result.current.filter.feedId).toBe("f2");
	expect(result.current.articles.some((item) => item.id === "old")).toBe(false);
});

test("failed pagination and explicit actions surface errors while keeping the reader usable", async () => {
	const server = transport();
	server.routes.set("GET /api/articles?view=all&search=", {
		articles: [article("a1")],
		nextCursor: "next",
	});
	server.routes.set("GET /api/articles?view=all&search=&cursor=next", async () =>
		Response.json({ error: "page failed" }, { status: 503 }),
	);
	const { result, notify } = await readerHarness();
	act(() => result.current.open(article("a1")));
	await act(async () => {
		await result.current.move(1);
	});
	expect(notify).toHaveBeenCalledWith("page failed");
	expect(result.current.articles).toHaveLength(1);
	for (const path of ["/refresh", "/read-all", "/articles/a1/ai"])
		server.routes.set(`POST /api${path}`, async () =>
			Response.json({ error: "request failed" }, { status: 503 }),
		);
	await act(async () => {
		await expect(result.current.refresh.mutateAsync()).rejects.toThrow("request failed");
	});
	await act(async () => {
		await expect(result.current.markRead.mutateAsync({ view: "all", search: "" })).rejects.toThrow(
			"request failed",
		);
	});
	await act(async () => {
		await expect(result.current.action.mutateAsync({ id: "a1", kind: "summary" })).rejects.toThrow(
			"request failed",
		);
	});
	expect(notify).toHaveBeenCalledWith("request failed");
	await waitFor(() =>
		expect(result.current.actionError).toMatchObject({
			kind: "summary",
			message: "request failed",
		}),
	);
	act(() => result.current.open(article("b1", "f2")));
	await waitFor(() => expect(result.current.actionError).toBeUndefined());
	act(() => result.current.open(article("a1")));
	await waitFor(() => expect(result.current.actionError?.kind).toBe("summary"));
	server.routes.set("POST /api/articles/a1/ai", { ...article("a1"), summary: "Recovered" });
	await act(async () => {
		await result.current.action.mutateAsync({ id: "a1", kind: "summary", force: true });
	});
	await waitFor(() => expect(result.current.actionError).toBeUndefined());
	expect(result.current.detail.data?.summary).toBe("Recovered");
	expect(
		server.fetch.mock.calls.some(
			([, init]) => init?.body === JSON.stringify({ action: "summary", force: true }),
		),
	).toBe(true);
});

test("settings and management changes invalidate only relevant metadata", async () => {
	const server = transport();
	const { result, client } = await readerHarness();
	const invalidate = vi.spyOn(client, "invalidateQueries");
	await act(async () => {
		await result.current.changed({
			path: "/settings",
			method: "PATCH",
			result: { ...defaultPreferences, fontSize: 20 },
		});
	});
	await waitFor(() => expect(result.current.preferences.fontSize).toBe(20));
	expect(invalidate).not.toHaveBeenCalled();
	await act(async () => {
		await result.current.changed({ path: "/ai/settings", method: "PATCH", result: null });
	});
	expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ai"] });
	invalidate.mockClear();
	await act(async () => {
		await result.current.changed({ path: "/logs", method: "DELETE", result: null });
	});
	expect(invalidate).toHaveBeenCalledOnce();
	expect(invalidate).toHaveBeenCalledWith({ queryKey: ["logs"] });
	const count = server.articleRequests().length;
	await act(async () => {
		await result.current.changed({ path: "/feeds/reorder", method: "POST", result: null });
	});
	await act(async () => {
		await result.current.refresh.mutateAsync();
	});
	expect(server.articleRequests()).toHaveLength(count);
	act(() => result.current.choose({ view: "all", feedId: "f1", search: "" }));
	server.routes.set("POST /api/feeds/f1/refresh", { queued: 1 });
	await act(async () => {
		await result.current.refresh.mutateAsync();
	});
	expect(server.fetch).toHaveBeenCalledWith(
		"/api/feeds/f1/refresh",
		expect.objectContaining({ method: "POST" }),
	);
});

test("deleting the open feed clears its rows/detail and deleting the active category exits that scope", async () => {
	transport();
	const { result } = await readerHarness();
	act(() => result.current.open(article("a1")));
	await waitFor(() => expect(result.current.detail.data?.id).toBe("a1"));
	await act(async () => {
		await result.current.changed({ path: "/feeds/f1", method: "DELETE", result: null });
	});
	expect(result.current.selected).toBeNull();
	expect(result.current.articles.map((item) => item.id)).toEqual(["b1"]);
	act(() => result.current.choose({ view: "all", feedId: "f1", search: "" }));
	await act(async () => {
		await result.current.changed({ path: "/feeds/f1", method: "DELETE", result: null });
	});
	expect(result.current.filter).toEqual({ view: "all", search: "" });
	act(() => result.current.choose({ view: "all", categoryId: "c1", search: "" }));
	await act(async () => {
		await result.current.changed({ path: "/categories/c1", method: "DELETE", result: null });
	});
	expect(result.current.filter).toEqual({ view: "all", search: "" });
});

test("automatic title translations update silently without editing active prose", async () => {
	const server = transport();
	const untranslated = { ...article("a1"), auto_translate: 1 };
	const translated = {
		...untranslated,
		translated_title: "背景译文",
		translated_description: "背景简介",
	};
	server.routes.set("GET /api/articles?view=all&search=", {
		articles: [untranslated],
		nextCursor: null,
	});
	server.routes.set("GET /api/ai/settings", { mock: true, hasApiKey: false });
	const gate = deferred<Response>();
	server.routes.set("POST /api/articles/a1/ai", () => gate.promise);
	const { result, notify } = await readerHarness();
	act(() => result.current.open(untranslated));
	await waitFor(() => expect(result.current.detail.data?.is_read).toBe(1));
	await act(async () => gate.resolve(Response.json(translated)));
	await waitFor(() => expect(result.current.articles[0]?.translated_title).toBe("背景译文"));
	expect(result.current.detail.data?.translated_title).toBeNull();
	expect(notify).not.toHaveBeenCalled();
	expect(result.current.detail.data?.content).toBe("<p>Content a1</p>");
});

test("navigation cancels queued title translations and waits for in-flight work before starting new ones", async () => {
	const server = transport();
	const a = { ...article("a1"), auto_translate: 1 };
	const b = { ...article("a2"), auto_translate: 1 };
	const c = { ...article("b1", "f2"), auto_translate: 1 };
	server.routes.set("GET /api/articles?view=all&search=", { articles: [a, b], nextCursor: null });
	server.routes.set("GET /api/articles?view=all&search=&feedId=f2", {
		articles: [c],
		nextCursor: null,
	});
	server.routes.set("GET /api/ai/settings", { mock: false, hasApiKey: true });
	const gate = deferred<Response>();
	server.routes.set("POST /api/articles/a1/ai", () => gate.promise);
	server.routes.set("POST /api/articles/b1/ai", { ...c, translated_title: "译文 B" });
	const { result } = await readerHarness();
	await waitFor(() =>
		expect(server.fetch).toHaveBeenCalledWith(
			"/api/articles/a1/ai",
			expect.objectContaining({ method: "POST" }),
		),
	);
	act(() => result.current.choose({ view: "all", feedId: "f2", search: "" }));
	await waitFor(() => expect(result.current.articles[0]?.id).toBe("b1"));
	expect(server.fetch.mock.calls.some(([url]) => url === "/api/articles/b1/ai")).toBe(false);
	await act(async () => gate.resolve(Response.json({ ...a, translated_title: "译文 A" })));
	await waitFor(() => expect(result.current.articles[0]?.translated_title).toBe("译文 B"));
	expect(server.fetch.mock.calls.some(([url]) => url === "/api/articles/a2/ai")).toBe(false);
	expect(server.fetch.mock.calls.filter(([url]) => url === "/api/articles/b1/ai")).toHaveLength(1);
});

test("translations completing during a reload survive an older list response", async () => {
	const server = transport();
	const a = { ...article("a1"), auto_translate: 1 };
	server.routes.set("GET /api/articles?view=all&search=", { articles: [a], nextCursor: null });
	server.routes.set("GET /api/ai/settings", { mock: true });
	const translation = deferred<Response>();
	server.routes.set("POST /api/articles/a1/ai", () => translation.promise);
	const { result } = await readerHarness();
	const page = deferred<Response>();
	server.routes.set("GET /api/articles?view=all&search=", () => page.promise);
	let accepting!: Promise<boolean>;
	act(() => {
		accepting = result.current.reloadArticles();
	});
	await act(async () => translation.resolve(Response.json({ ...a, translated_title: "译文" })));
	await waitFor(() => expect(result.current.articles[0]?.translated_title).toBe("译文"));
	await act(async () => {
		page.resolve(Response.json({ articles: [a], nextCursor: null } satisfies ArticlePage));
		await accepting;
	});
	expect(result.current.articles[0]?.translated_title).toBe("译文");
});

test("feed full-text translation runs on opening, reuses results and respects original choice", async () => {
	const server = transport();
	server.routes.set("GET /api/feeds", [{ ...feed(), auto_translate_content: 1 }, feed("f2")]);
	server.routes.set("GET /api/ai/settings", { mock: true });
	const gate = deferred<Response>();
	server.routes.set("POST /api/articles/a1/ai", () => gate.promise);
	const { result, notify } = await readerHarness();
	expect(server.fetch.mock.calls.some(([url]) => url === "/api/articles/a1/ai")).toBe(false);
	act(() => result.current.open(article("a1")));
	await waitFor(() => expect(result.current.actionBusy).toBe("translate"));
	await act(async () =>
		gate.resolve(Response.json({ ...article("a1"), translated_content: "<p>自动译文</p>" })),
	);
	await waitFor(() => expect(result.current.translation).toBe(true));
	expect(result.current.detail.data?.translated_content).toBe("<p>自动译文</p>");
	act(() => result.current.setTranslation(false));
	await act(async () => {
		await result.current.feeds.refetch();
	});
	expect(result.current.translation).toBe(false);
	expect(server.fetch.mock.calls.filter(([url]) => url === "/api/articles/a1/ai")).toHaveLength(1);
	expect(notify).not.toHaveBeenCalled();
});

test("automatic full translation preserves the newly selected article and cached results need no request", async () => {
	const server = transport();
	server.routes.set("GET /api/feeds", [{ ...feed(), auto_translate_content: 1 }, feed("f2")]);
	server.routes.set("GET /api/ai/settings", { hasApiKey: true });
	server.routes.set("GET /api/articles/a2", {
		...article("a2"),
		translated_content: "<p>缓存译文</p>",
	});
	const gate = deferred<Response>();
	server.routes.set("POST /api/articles/a1/ai", () => gate.promise);
	const { result } = await readerHarness();
	act(() => result.current.open(article("a1")));
	await waitFor(() => expect(result.current.actionBusy).toBe("translate"));
	act(() => result.current.open(article("a2")));
	await waitFor(() =>
		expect(result.current.detail.data?.translated_content).toBe("<p>缓存译文</p>"),
	);
	await act(async () =>
		gate.resolve(Response.json({ ...article("a1"), translated_content: "<p>迟到译文</p>" })),
	);
	expect(result.current.selected).toBe("a2");
	expect(result.current.detail.data?.translated_content).toBe("<p>缓存译文</p>");
	expect(server.fetch.mock.calls.some(([url]) => url === "/api/articles/a2/ai")).toBe(false);
});

test("automatic translation failures stay inline without retry loops and manual retry works", async () => {
	const server = transport();
	server.routes.set("GET /api/feeds", [{ ...feed(), auto_translate_content: 1 }, feed("f2")]);
	server.routes.set("GET /api/ai/settings", { mock: true });
	server.routes.set("POST /api/articles/a1/ai", async () =>
		Response.json({ error: "Translation failed" }, { status: 502 }),
	);
	const { result, notify } = await readerHarness();
	act(() => result.current.open(article("a1")));
	await waitFor(() => expect(result.current.actionError?.message).toBe("Translation failed"));
	await act(async () => {
		await result.current.feeds.refetch();
	});
	expect(server.fetch.mock.calls.filter(([url]) => url === "/api/articles/a1/ai")).toHaveLength(1);
	expect(result.current.detail.data?.content).toBe("<p>Content a1</p>");
	expect(notify).not.toHaveBeenCalled();
	server.routes.set("POST /api/articles/a1/ai", {
		...article("a1"),
		translated_content: "<p>重试成功</p>",
	});
	await act(async () => {
		await result.current.action.mutateAsync({ id: "a1", kind: "translate" });
	});
	await waitFor(() => expect(result.current.translation).toBe(true));
});

test("automatic full translation waits for AI configuration and skips empty bodies", async () => {
	const server = transport();
	server.routes.set("GET /api/feeds", [{ ...feed(), auto_translate_content: 1 }, feed("f2")]);
	const { result } = await readerHarness();
	act(() => result.current.open(article("a1")));
	await waitFor(() => expect(result.current.detail.data?.id).toBe("a1"));
	expect(server.fetch.mock.calls.some(([url]) => url === "/api/articles/a1/ai")).toBe(false);
	server.routes.set("GET /api/articles/a1", { ...article("a1"), content: " " });
	await act(async () => {
		await result.current.detail.refetch();
	});
	server.routes.set("GET /api/ai/settings", { mock: true });
	await act(async () => {
		await result.current.ai.refetch();
	});
	expect(server.fetch.mock.calls.some(([url]) => url === "/api/articles/a1/ai")).toBe(false);
});

test("automatic extraction precedes translation even with a cached summary translation", async () => {
	const server = transport();
	server.routes.set("GET /api/feeds", [
		{ ...feed(), auto_fetch_content: 1, auto_translate_content: 1 },
	]);
	server.routes.set("GET /api/ai/settings", { mock: true });
	server.routes.set("GET /api/articles/a1", {
		...article("a1"),
		translated_content: "Old partial translation",
	});
	const gate = deferred<Response>();
	server.routes.set("POST /api/articles/a1/full", () => gate.promise);
	const full = { ...article("a1"), content: "<p>Full original</p>", full_content_fetched: 1 };
	server.routes.set("POST /api/articles/a1/ai", {
		...full,
		translated_content: "<p>Full translation</p>",
	});
	const { result, notify } = await readerHarness();
	act(() => result.current.open(article("a1")));
	await waitFor(() => expect(result.current.actionBusy).toBe("full"));
	expect(server.fetch.mock.calls.some(([url]) => url === "/api/articles/a1/ai")).toBe(false);
	await act(async () => gate.resolve(Response.json(full)));
	await waitFor(() =>
		expect(result.current.detail.data?.translated_content).toBe("<p>Full translation</p>"),
	);
	await waitFor(() => expect(result.current.translation).toBe(true));
	const requests = server.fetch.mock.calls.filter(([url]) => /\/a1\/(full|ai)$/.test(String(url)));
	expect(requests.map(([url]) => url)).toEqual(["/api/articles/a1/full", "/api/articles/a1/ai"]);
	expect(JSON.parse(String(requests[0]?.[1]?.body))).toEqual({ automatic: true });
	await act(async () => {
		await result.current.feeds.refetch();
	});
	expect(server.fetch.mock.calls.filter(([url]) => url === "/api/articles/a1/full")).toHaveLength(
		1,
	);
	expect(notify).not.toHaveBeenCalled();
});

test("automatic extraction works without AI and late results do not replace the selected article", async () => {
	const server = transport();
	server.routes.set("GET /api/feeds", [{ ...feed(), auto_fetch_content: 1 }, feed("f2")]);
	const gate = deferred<Response>();
	server.routes.set("POST /api/articles/a1/full", () => gate.promise);
	const { result, notify } = await readerHarness();
	act(() => result.current.open(article("a1")));
	await waitFor(() => expect(result.current.actionBusy).toBe("full"));
	act(() => result.current.open(article("b1", "f2")));
	await waitFor(() => expect(result.current.detail.data?.id).toBe("b1"));
	await act(async () =>
		gate.resolve(
			Response.json({ ...article("a1"), full_content_fetched: 1, content: "<p>Full body</p>" }),
		),
	);
	expect(result.current.detail.data?.id).toBe("b1");
	act(() => result.current.open(article("a1")));
	await waitFor(() => expect(result.current.detail.data?.full_content_fetched).toBe(1));
	expect(server.fetch.mock.calls.filter(([url]) => url === "/api/articles/a1/full")).toHaveLength(
		1,
	);
	expect(server.fetch.mock.calls.some(([url]) => String(url).endsWith("/ai"))).toBe(false);
	expect(notify).not.toHaveBeenCalled();
});

test("failed automatic extraction retains content, blocks translation and allows manual retry", async () => {
	const server = transport();
	server.routes.set("GET /api/feeds", [
		{ ...feed(), auto_fetch_content: 1, auto_translate_content: 1 },
	]);
	server.routes.set("GET /api/ai/settings", { mock: true });
	server.routes.set("POST /api/articles/a1/full", async () =>
		Response.json({ error: "Extraction failed" }, { status: 502 }),
	);
	const { result, notify } = await readerHarness();
	act(() => result.current.open(article("a1")));
	await waitFor(() => expect(result.current.actionError?.message).toBe("Extraction failed"));
	await act(async () => {
		await result.current.feeds.refetch();
	});
	expect(result.current.detail.data?.content).toBe(article("a1").content);
	expect(server.fetch.mock.calls.filter(([url]) => url === "/api/articles/a1/full")).toHaveLength(
		1,
	);
	expect(server.fetch.mock.calls.some(([url]) => url === "/api/articles/a1/ai")).toBe(false);
	const full = { ...article("a1"), full_content_fetched: 1, content: "<p>Recovered body</p>" };
	server.routes.set("POST /api/articles/a1/full", full);
	server.routes.set("POST /api/articles/a1/ai", {
		...full,
		translated_content: "<p>Recovered translation</p>",
	});
	await act(async () => {
		await result.current.action.mutateAsync({ id: "a1", kind: "full" });
	});
	await waitFor(() =>
		expect(result.current.detail.data?.translated_content).toBe("<p>Recovered translation</p>"),
	);
	expect(notify).not.toHaveBeenCalled();
});

test("enabling extraction after translation renews the invalidated translation even for identical bodies", async () => {
	const server = transport();
	server.routes.set("GET /api/feeds", [{ ...feed(), auto_translate_content: 1 }]);
	server.routes.set("GET /api/ai/settings", { mock: true });
	server.routes.set("POST /api/articles/a1/ai", {
		...article("a1"),
		translated_content: "<p>Initial translation</p>",
	});
	const { result } = await readerHarness();
	act(() => result.current.open(article("a1")));
	await waitFor(() =>
		expect(result.current.detail.data?.translated_content).toBe("<p>Initial translation</p>"),
	);
	const full = { ...article("a1"), full_content_fetched: 1 };
	server.routes.set("POST /api/articles/a1/full", full);
	server.routes.set("POST /api/articles/a1/ai", {
		...full,
		translated_content: "<p>Renewed translation</p>",
	});
	server.routes.set("GET /api/feeds", [
		{ ...feed(), auto_fetch_content: 1, auto_translate_content: 1 },
	]);
	await act(async () => {
		await result.current.feeds.refetch();
	});
	await waitFor(() =>
		expect(result.current.detail.data?.translated_content).toBe("<p>Renewed translation</p>"),
	);
	expect(server.fetch.mock.calls.filter(([url]) => url === "/api/articles/a1/ai")).toHaveLength(2);
});
