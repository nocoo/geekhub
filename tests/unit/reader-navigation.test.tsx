// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import {
	readerPath,
	readReaderNavigation,
	readReaderRoute,
	readReadingPosition,
	saveReadingPosition,
	writeReaderNavigation,
} from "../../src/web/lib/reader-navigation";
import { useReadingPosition } from "../../src/web/lib/reader-position";
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
	document.body.replaceChildren();
});

test("paths round-trip reading scopes, Unicode IDs, reserved characters and search", () => {
	for (const filter of [
		{ view: "all", search: "" },
		{ view: "unread", search: "文字 & text #?", feedId: "RSS / 中文 %" },
		{ view: "starred", search: "", categoryId: "收藏 #1" },
		{ view: "later", search: 'quote: "a"' },
	] as const) {
		for (const selected of [null, "文章 / 1%#?"]) {
			const route = { filter, selected };
			expect(readReaderRoute(new URL(readerPath(route), location.origin))).toEqual(route);
		}
	}
	expect(readReaderRoute(new URL("/?article=old-id", location.origin)).selected).toBe("old-id");
	expect(readReaderRoute(new URL(`/?view=unknown&q=${"x".repeat(201)}`, location.origin))).toEqual({
		filter: { view: "all", search: "x".repeat(200) },
		selected: null,
	});
	for (const path of ["/unknown/article", "/feeds/%E0%A4/articles/a", "/articles/%E0%A4"])
		expect(readReaderRoute(new URL(path, location.origin))).toEqual({
			filter: { view: "all", search: "" },
			selected: null,
		});
});

test("history state is namespaced, validates its path, and upgrades old links without a new entry", () => {
	history.replaceState({ external: "preserve" }, "", "/?article=a1");
	const length = history.length;
	const navigation = readReaderNavigation();
	writeReaderNavigation(navigation, true);
	expect(location.pathname).toBe("/articles/a1");
	expect(location.search).toBe("");
	expect(history.length).toBe(length);
	expect(history.state.external).toBe("preserve");
	expect(readReaderNavigation()).toEqual(navigation);
	history.replaceState(history.state, "", "/feeds/f2");
	expect(readReaderNavigation().visit).not.toBe(navigation.visit);
	history.replaceState({ geekhub: { path: "/feeds/f2", key: 42, visit: null } }, "", "/feeds/f2");
	expect(typeof readReaderNavigation().visit).toBe("string");
	expect(typeof readReaderNavigation().key).toBe("string");
});

async function traverse(direction: "back" | "forward") {
	await act(async () => {
		const changed = new Promise<void>((resolve) =>
			window.addEventListener("popstate", () => resolve(), { once: true }),
		);
		history[direction]();
		await changed;
	});
}

test("browser history restores filters and cached snapshots without adding entries or refetching rows", async () => {
	const server = transport();
	const query = queryHarness();
	query.client.setDefaultOptions({ queries: { retry: false, gcTime: Infinity } });
	const { result } = renderHook(() => useReaderViewModel(vi.fn()), { wrapper: query.wrapper });
	await waitFor(() => expect(result.current.pages.isSuccess).toBe(true));
	act(() => result.current.choose({ view: "unread", feedId: "f1", search: "needle" }));
	await waitFor(() => expect(result.current.pages.isSuccess).toBe(true));
	const visit = result.current.visit;
	act(() => result.current.open({ ...article("a1"), is_read: 1 }));
	await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));
	const snapshot = result.current.articles;
	const snapshotData = result.current.pages.data;
	const path = "/feeds/f1/articles/a1?view=unread&q=needle";
	expect(location.pathname + location.search).toBe(path);
	const length = history.length;
	act(() => result.current.open(article("a1")));
	expect(history.length).toBe(length);
	act(() => result.current.choose({ view: "all", categoryId: "c1", search: "" }));
	await waitFor(() => expect(result.current.pages.isSuccess).toBe(true));
	server.routes.set("GET /api/feeds", [{ ...feed(), total_count: 5 }, feed("f2")]);
	await act(() => query.client.invalidateQueries({ queryKey: ["feeds"] }));
	const requests = server.articleRequests().length;
	const afterNavigation = history.length;
	await traverse("back");
	expect(location.pathname + location.search).toBe(path);
	expect(result.current.selected).toBe("a1");
	expect(result.current.filter).toEqual({ view: "unread", feedId: "f1", search: "needle" });
	expect(result.current.visit).toBe(visit);
	expect(result.current.articles).toEqual(snapshot);
	expect(result.current.pages.data).toBe(snapshotData);
	expect(result.current.updatesAvailable).toBe(true);
	expect(server.articleRequests()).toHaveLength(requests);
	expect(history.length).toBe(afterNavigation);
	await traverse("back");
	expect(result.current.selected).toBeNull();
	expect(result.current.visit).toBe(visit);
	await traverse("forward");
	expect(result.current.selected).toBe("a1");
	act(() => result.current.back());
	expect(location.pathname + location.search).toBe("/feeds/f1?view=unread&q=needle");
	expect(result.current.visit).toBe(visit);
	const listLength = history.length;
	act(() => result.current.choose(result.current.filter));
	act(() => result.current.back());
	expect(history.length).toBe(listLength);
});

test("a slow next-page action cannot override a later back navigation to the same article", async () => {
	const server = transport();
	server.routes.set("GET /api/articles?view=all&search=", {
		articles: [article("a1"), article("b1", "f2")],
		nextCursor: "next",
	});
	const gate = deferred<Response>();
	server.routes.set("GET /api/articles?view=all&search=&cursor=next", () => gate.promise);
	const { result } = await readerHarness();
	act(() => result.current.open({ ...article("b1", "f2"), is_read: 1 }));
	let moving!: Promise<void>;
	act(() => {
		moving = result.current.move(1);
	});
	await waitFor(() => expect(result.current.pages.isFetchingNextPage).toBe(true));
	act(() => result.current.open({ ...article("a1"), is_read: 1 }));
	await traverse("back");
	expect(result.current.selected).toBe("b1");
	await act(async () => {
		gate.resolve(Response.json({ articles: [article("a2")], nextCursor: null }));
		await moving;
	});
	expect(result.current.selected).toBe("b1");
	expect(location.pathname).toBe("/articles/b1");
});

test("refresh restores the source, article and previously loaded pages", async () => {
	const server = transport();
	history.replaceState(null, "", "/feeds/f1/articles/a2?q=needle");
	const navigation = readReaderNavigation();
	writeReaderNavigation(navigation, true);
	saveReadingPosition(`list:${navigation.visit}`, { top: 900, pages: 2 });
	server.routes.set("GET /api/articles?view=all&search=needle&feedId=f1", {
		articles: [article("a1")],
		nextCursor: "next",
	});
	server.routes.set("GET /api/articles?view=all&search=needle&feedId=f1&cursor=next", {
		articles: [article("a2")],
		nextCursor: null,
	});
	const { result, unmount } = await readerHarness();
	await waitFor(() => expect(result.current.articles).toHaveLength(2));
	expect(result.current.selected).toBe("a2");
	expect(result.current.heading).toBe("First feed");
	expect(result.current.restoringPages).toBe(false);
	unmount();
	const restored = await readerHarness();
	await waitFor(() => expect(restored.result.current.articles).toHaveLength(2));
	expect(restored.result.current.visit).toBe(navigation.visit);
	expect(restored.result.current.navigationKey).toBe(navigation.key);
	expect(readReadingPosition(`list:${navigation.visit}`)).toEqual({ top: 900, pages: 2 });
});

test("failed page restoration stops without discarding the article or retrying in a loop", async () => {
	const server = transport();
	history.replaceState(null, "", "/articles/a1");
	const navigation = readReaderNavigation();
	writeReaderNavigation(navigation, true);
	saveReadingPosition(`list:${navigation.visit}`, { pages: 3 });
	server.routes.set("GET /api/articles?view=all&search=", {
		articles: [article("a1")],
		nextCursor: "next",
	});
	server.routes.set("GET /api/articles?view=all&search=&cursor=next", async () =>
		Response.json({ error: "Offline" }, { status: 503 }),
	);
	const query = queryHarness();
	const { result } = renderHook(() => useReaderViewModel(vi.fn()), { wrapper: query.wrapper });
	await waitFor(() => expect(result.current.pages.isFetchNextPageError).toBe(true));
	expect(result.current.restoringPages).toBe(false);
	expect(result.current.detail.data?.id).toBe("a1");
	expect(result.current.articles).toHaveLength(1);
	expect(server.articleRequests()).toHaveLength(2);
});

test("position storage tolerates corrupt values and denied browser storage", () => {
	sessionStorage.setItem("geekhub:position:bad", "{");
	expect(readReadingPosition("bad")).toEqual({ top: 0, pages: 1 });
	sessionStorage.setItem("geekhub:position:bad", '{"top":-5,"pages":1.5}');
	expect(readReadingPosition("bad")).toEqual({ top: 0, pages: 1 });
	vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
		throw new Error("Denied");
	});
	vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
		throw new Error("Full");
	});
	expect(() => saveReadingPosition("denied", { top: 100 })).not.toThrow();
	expect(readReadingPosition("denied")).toEqual({ top: 0, pages: 1 });
});

test("scroll restoration waits for content and images, persists manual scrolling, and yields to the reader", () => {
	let resize = () => {};
	const disconnect = vi.fn();
	vi.stubGlobal(
		"ResizeObserver",
		class {
			constructor(callback: () => void) {
				resize = callback;
			}
			observe = vi.fn();
			disconnect = disconnect;
		},
	);
	const element = document.createElement("div");
	element.innerHTML = "<article></article>";
	document.body.appendChild(element);
	let available = 100;
	let top = 0;
	Object.defineProperties(element, {
		clientHeight: { configurable: true, value: 300 },
		scrollTop: {
			get: () => top,
			set: (value: number) => {
				top = Math.min(value, available);
			},
		},
	});
	const ref: { current: HTMLDivElement | null } = { current: element };
	saveReadingPosition("reader", { top: 500 });
	const { rerender, unmount } = renderHook(
		({ ready, key }) => useReadingPosition(ref, key, ready, ".prose"),
		{ initialProps: { ready: false, key: "reader" } },
	);
	rerender({ ready: true, key: "reader" });
	expect(top).toBe(0);
	element.firstElementChild?.insertAdjacentHTML(
		"beforeend",
		'<div class="prose"><img src="https://example.com/image.png"></div>',
	);
	resize();
	expect(top).toBe(100);
	element.dispatchEvent(new Event("scroll"));
	expect(readReadingPosition("reader").top).toBe(500);
	available = 1000;
	element.querySelector("img")?.dispatchEvent(new Event("load"));
	expect(top).toBe(500);
	expect(disconnect).toHaveBeenCalled();
	element.scrollTop = 600;
	element.dispatchEvent(new Event("scroll"));
	expect(readReadingPosition("reader").top).toBe(600);
	element.scrollTop = 700;
	window.dispatchEvent(new Event("pagehide"));
	expect(readReadingPosition("reader").top).toBe(700);
	saveReadingPosition("other", { top: 2000 });
	rerender({ ready: true, key: "other" });
	element.dispatchEvent(new Event("wheel"));
	element.scrollTop = 50;
	available = 2500;
	resize();
	expect(top).toBe(50);
	Object.defineProperty(element, "clientHeight", { value: 0 });
	element.dispatchEvent(new Event("scroll"));
	expect(readReadingPosition("other").top).toBe(1000);
	unmount();
	ref.current = null;
	expect(() => renderHook(() => useReadingPosition(ref, "missing", true))).not.toThrow();
});
