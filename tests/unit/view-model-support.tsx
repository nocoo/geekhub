import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { expect, vi } from "vitest";
import { type ArticleDetail, defaultPreferences, type Feed } from "../../src/shared/contracts";
import { useReaderViewModel } from "../../src/web/lib/reader-view-model";

export function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

export const article = (id: string, feedId = "f1"): ArticleDetail => ({
	id,
	feed_id: feedId,
	feed_title: feedId === "f1" ? "First feed" : "Second feed",
	site_url: "https://example.com",
	title: `Article ${id}`,
	url: `https://example.com/${id}`,
	author: "Writer",
	published_at: "2026-09-01T00:00:00.000Z",
	description: `Description ${id}`,
	image_url: null,
	is_read: 0,
	is_starred: 0,
	is_later: 0,
	auto_translate: 0,
	translated_title: null,
	translated_description: null,
	content: `<p>Content ${id}</p>`,
	summary: null,
	translated_content: null,
	ai_model: null,
	full_content_fetched: 0,
});

export const feed = (id = "f1"): Feed => ({
	id,
	category_id: id === "f1" ? "c1" : null,
	title: id === "f1" ? "First feed" : "Second feed",
	url: `https://example.com/${id}/rss`,
	site_url: "https://example.com",
	description: "Feed",
	auto_translate: 0,
	is_active: 1,
	refresh_minutes: 60,
	status: "success",
	last_error: null,
	last_fetched_at: "2026-09-01T00:00:00.000Z",
	next_fetch_at: null,
	unread_count: 2,
	total_count: 2,
	sort_order: id === "f1" ? 0 : 1,
});

type Reply = unknown | ((init?: RequestInit) => Promise<Response>);
export function transport() {
	const articles = [article("a1"), article("a2"), article("b1", "f2")];
	const routes = new Map<string, Reply>([
		["GET /api/feeds", [feed(), feed("f2")]],
		[
			"GET /api/categories",
			[{ id: "c1", name: "Engineering", color: "green", icon: "", sort_order: 0 }],
		],
		["GET /api/settings", defaultPreferences],
		[
			"GET /api/stats",
			{ feeds: 2, articles: 3, unread: 3, starred: 0, later: 0, logs: 0, bytes: 300 },
		],
		[
			"GET /api/ai/settings",
			{ provider: "minimax", model: "model", hasApiKey: false, mock: false },
		],
		["GET /api/logs", []],
		["POST /api/refresh", { queued: 2 }],
		["POST /api/read-all", { ok: true }],
		["GET /api/articles?view=all&search=", { articles, nextCursor: null }],
	]);
	for (const item of articles) {
		routes.set(`GET /api/articles/${item.id}`, item);
		routes.set(`PATCH /api/articles/${item.id}`, async (init?: RequestInit) =>
			Response.json({
				...item,
				...Object.fromEntries(
					Object.entries(JSON.parse(String(init?.body))).map(([key, value]) => [
						key,
						Number(value),
					]),
				),
			}),
		);
	}
	const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const method = init?.method ?? "GET";
		const path = String(input);
		const key = `${method} ${path}`;
		const result = routes.has(key)
			? routes.get(key)
			: method === "GET" && path.startsWith("/api/articles?")
				? { articles, nextCursor: null }
				: undefined;
		if (result === undefined) throw new Error(`Missing test response: ${method} ${path}`);
		return typeof result === "function" ? result(init) : Response.json(result);
	});
	vi.stubGlobal("fetch", fetch);
	return {
		routes,
		fetch,
		articles,
		articleRequests: () =>
			fetch.mock.calls.filter(([input]) => String(input).startsWith("/api/articles?")),
	};
}

export function queryHarness() {
	const client = new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0 },
			mutations: { retry: false, gcTime: 0 },
		},
	});
	const wrapper = ({ children }: PropsWithChildren) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	return { client, wrapper };
}

export async function readerHarness() {
	const query = queryHarness();
	const notify = vi.fn();
	const hook = renderHook(() => useReaderViewModel(notify), { wrapper: query.wrapper });
	await waitFor(() => {
		expect(hook.result.current.pages.isSuccess).toBe(true);
		expect(query.client.isFetching()).toBe(0);
	});
	return { ...query, ...hook, notify };
}
