import { describe, expect, test, vi } from "vitest";
import type { DiagnosticJob, FeedDiagnostic, QueueJob } from "../../src/shared/contracts";
import { getFeed } from "../../src/worker/data";
import {
	diagnoseFeed,
	discoverFeedLinks,
	enqueueDiagnostic,
	getDiagnostic,
	inspectFeed,
	runDiagnostic,
} from "../../src/worker/diagnostics";
import worker from "../../src/worker/index";
import { client, deferred, makeEnv, rss } from "./support";

const signal = () => new AbortController().signal;
const noSite = "<rss><channel><title>No main site</title></channel></rss>";

describe("feed inspection and rediscovery", () => {
	test("finds declared RSS/Atom and subscription links, resolves base URLs and rejects unsafe links", () => {
		expect(
			discoverFeedLinks(
				`<base href="/blog/"><link rel="alternate" type="application/rss+xml" href="rss.xml">
			<link rel="ALTERNATE stylesheet" type="application/atom+xml" href="atom.xml">
			<a href="rss.xml">RSS</a><a href="/subscribe">订阅</a><a href="/ordinary">Home</a>
			<a href="/sitemap.xml">RSS sitemap</a><a href="http://127.0.0.1/rss">RSS</a>
			<link rel="alternate" type="text/html" href="/not-a-feed"><a href="javascript:alert(1)">RSS</a>`,
				"https://example.com/home",
			),
		).toEqual([
			"https://example.com/blog/rss.xml",
			"https://example.com/blog/atom.xml",
			"https://example.com/subscribe",
		]);
		expect(
			discoverFeedLinks(
				`<base href="http://localhost/"><a href="/feed">Feed</a>`,
				"https://example.com",
			),
		).toEqual(["https://example.com/feed"]);
		expect(
			discoverFeedLinks(
				Array.from({ length: 10 }, (_, index) => `<a href="/rss/${index}">RSS</a>`).join(""),
				"https://example.com",
			),
		).toHaveLength(6);
	});

	test("reports date coverage across the entire response, independently of the 200-entry ingest limit", async () => {
		const env = makeEnv();
		const xml = rss(205)
			.replace("Fri, 11 Sep 2026 00:00:00 GMT", "2019-01-01")
			.replace("<guid>204</guid>", "<guid>204</guid><published>unused</published>")
			.replace(
				"</channel>",
				`<item><title>Undated</title><link>https://example.com/u</link></item>
				<item><title>Invalid</title><pubDate>bad</pubDate></item>
				<item><title>Future</title><pubDate>2100-01-01</pubDate></item></channel>`,
			);
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(xml)),
		);
		const result = await inspectFeed(env, "https://example.com/rss", signal());
		expect(result).toMatchObject({
			status: 200,
			entries: 208,
			readableEntries: 200,
			undatedEntries: 2,
			futureEntries: 1,
			oldestAt: "2019-01-01T00:00:00.000Z",
			latestAt: "2026-09-11T00:00:00.000Z",
			error: null,
		});
		expect(result.hops).toEqual([{ url: "https://example.com/rss", status: 200 }]);
		expect(result.ageDays).toBeGreaterThanOrEqual(0);
		expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM articles").first("n")).toBe(2);
	});

	test("an undated feed, an empty feed and an old feed cannot be mistaken for fresh articles", async () => {
		const env = makeEnv();
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(rss().replace(/<pubDate>.*?<\/pubDate>/, "")))
			.mockResolvedValueOnce(new Response(rss(0)))
			.mockResolvedValueOnce(
				new Response(rss().replace("Fri, 11 Sep 2026 00:00:00 GMT", "2010-01-01")),
			);
		vi.stubGlobal("fetch", fetch);
		expect(await inspectFeed(env, "https://example.com/rss", signal())).toMatchObject({
			entries: 1,
			undatedEntries: 1,
			ageDays: null,
			oldestAt: null,
			latestAt: null,
		});
		expect(await inspectFeed(env, "https://example.com/rss", signal())).toMatchObject({
			entries: 0,
			ageDays: null,
		});
		expect((await inspectFeed(env, "https://example.com/rss", signal())).ageDays).toBeGreaterThan(
			90,
		);
	});

	test("preserves status, redirects and parse failures without exposing unsafe destinations", async () => {
		const env = makeEnv();
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(null, { status: 301, headers: { location: "/canonical" } }),
			)
			.mockResolvedValueOnce(new Response("<html>no feed</html>"))
			.mockResolvedValueOnce(new Response("Gone", { status: 410 }))
			.mockResolvedValueOnce(
				new Response(null, { status: 302, headers: { location: "http://localhost/private" } }),
			);
		vi.stubGlobal("fetch", fetch);
		const malformed = await inspectFeed(env, "https://example.com/rss", signal());
		expect(malformed).toMatchObject({
			finalUrl: "https://example.com/canonical",
			status: 200,
			entries: null,
		});
		expect(malformed.hops).toHaveLength(2);
		expect(malformed.error).toContain("没有找到");
		expect(await inspectFeed(env, "https://example.com/rss", signal())).toMatchObject({
			status: 410,
			entries: null,
			error: "抓取失败：HTTP 410",
		});
		const unsafe = await inspectFeed(env, "https://example.com/rss", signal());
		expect(unsafe.finalUrl).toBe("https://example.com/rss");
		expect(unsafe.error).toContain("公开网站");
	});

	test("bounds responses and reports timeout and transport errors", async () => {
		const env = makeEnv();
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response("large", { headers: { "content-length": "5000000" } }))
			.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"))
			.mockRejectedValueOnce(new Error("DNS unavailable"));
		vi.stubGlobal("fetch", fetch);
		expect((await inspectFeed(env, "https://example.com/rss", signal())).error).toContain(
			"大小限制",
		);
		expect((await inspectFeed(env, "https://example.com/rss", signal())).error).toContain(
			"连接超时",
		);
		expect((await inspectFeed(env, "https://example.com/rss", signal())).error).toBe(
			"DNS unavailable",
		);
		expect((await inspectFeed(env, "http://localhost/rss", signal())).error).toContain("公开网站");
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	test("checks both site protocols, verifies discovered candidates and includes canonical RSS redirects", async () => {
		const env = makeEnv();
		const fetch = vi.fn(async (input: URL) => {
			if (input.pathname === "/feed")
				return new Response(null, { status: 301, headers: { location: "/canonical.xml" } });
			if (["/canonical.xml", "/new.xml"].includes(input.pathname)) return new Response(rss());
			if (input.pathname === "/")
				return input.protocol === "http:"
					? new Response(null, { status: 308, headers: { location: "https://example.com/" } })
					: new Response('<link rel="alternate" type="application/rss+xml" href="/new.xml">');
			return new Response("missing", { status: 404 });
		});
		vi.stubGlobal("fetch", fetch);
		const report = await diagnoseFeed(env, await getFeed(env.DB, "f1"));
		expect(report.siteUrl).toBe("https://example.com/");
		expect(report.sites.map((site) => [new URL(site.url).protocol, site.status])).toEqual([
			["https:", 200],
			["http:", 200],
		]);
		expect(report.sites[1]?.hops).toHaveLength(2);
		expect(
			report.candidates
				.filter((candidate) => !candidate.inspection.error)
				.map((candidate) => [candidate.source, candidate.url]),
		).toEqual([
			["redirect", "https://example.com/canonical.xml"],
			["page", "https://example.com/new.xml"],
		]);
		expect(report.candidates.some((candidate) => candidate.inspection.status === 404)).toBe(true);
		expect(report.candidates.length).toBeLessThanOrEqual(6);
	});

	test("resolves common paths relative to the main-site directory even when both protocols fail", async () => {
		const env = makeEnv();
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: URL) =>
				url.pathname === "/feed" ? new Response(noSite) : new Response(null, { status: 503 }),
			),
		);
		const report = await diagnoseFeed(
			env,
			await getFeed(env.DB, "f1"),
			"https://publisher.example.com/blog/index.html?language=en",
		);
		expect(report.sites.every((site) => Boolean(site.error))).toBe(true);
		expect(report.candidates.map((candidate) => candidate.url)).toEqual(
			["feed/", "rss.xml", "atom.xml", "feed.xml"].map(
				(path) => `https://publisher.example.com/blog/${path}`,
			),
		);
	});

	test("a feed without main-site metadata falls back to its origin, while RSSHub does not", async () => {
		const env = makeEnv();
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(noSite)),
		);
		const feed = await getFeed(env.DB, "f1");
		expect((await diagnoseFeed(env, feed)).siteUrl).toBe("https://example.com");
		const hub = await diagnoseFeed(env, {
			...feed,
			url: "rsshub://github/issue/nocoo/geekhub",
			site_url: "https://rsshub.app",
		});
		expect(hub.siteUrl).toBeNull();
		expect(hub.sites).toEqual([]);
		expect(hub.candidates).toEqual([]);
	});

	test("fixture responses are restricted to the local environment and declared demo routes", async () => {
		const env = makeEnv();
		const fetch = vi.fn(async () => new Response(rss()));
		vi.stubGlobal("fetch", fetch);
		const report = await diagnoseFeed(env, {
			...(await getFeed(env.DB, "f1")),
			url: "https://demo.geekhub.example/rss/simon",
			site_url: "https://demo.geekhub.example/site/simon",
		});
		expect(report.feed.entries).toBe(6);
		expect(report.sites.every((site) => site.status === 200)).toBe(true);
		expect(
			report.candidates.find((candidate) => candidate.source === "page")?.inspection.entries,
		).toBe(6);
		expect(report.candidates.some((candidate) => candidate.inspection.status === 404)).toBe(true);
		expect(fetch).not.toHaveBeenCalled();
		env.ENVIRONMENT = "production";
		expect(
			(await inspectFeed(env, "https://demo.geekhub.example/rss/simon", signal())).entries,
		).toBe(1);
		expect(fetch).toHaveBeenCalledOnce();
	});
});

describe("durable diagnostics", () => {
	test("deduplicates active runs, persists results and lets the queue dispatcher acknowledge them", async () => {
		const env = makeEnv();
		await env.DB.exec(
			"UPDATE feeds SET url = 'https://demo.geekhub.example/rss/simon', site_url = 'https://demo.geekhub.example/site/simon' WHERE id = 'f1';",
		);
		const feed = await getFeed(env.DB, "f1");
		expect(await getDiagnostic(env.DB, feed.id)).toBeNull();
		const first = await enqueueDiagnostic(env, feed);
		expect(first?.status).toBe("queued");
		expect((await enqueueDiagnostic(env, feed))?.run_id).toBe(first?.run_id);
		expect(env.FEED_QUEUE.send).toHaveBeenCalledOnce();
		const job = vi.mocked(env.FEED_QUEUE.send).mock.calls[0]?.[0] as DiagnosticJob;
		const message: Message<QueueJob> = {
			id: "diagnostic",
			timestamp: new Date(),
			body: job,
			attempts: 1,
			ack: vi.fn(),
			retry: vi.fn(),
		};
		await worker.queue(
			{
				queue: "local",
				messages: [message],
				ackAll: vi.fn(),
				retryAll: vi.fn(),
				metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
			},
			env,
		);
		expect(message.ack).toHaveBeenCalledOnce();
		const done = await getDiagnostic(env.DB, feed.id);
		expect(done?.status).toBe("success");
		expect(done?.finished_at).toBeTruthy();
		expect(done?.report?.feed.entries).toBe(6);
		await runDiagnostic(env, job);
		expect(await getDiagnostic(env.DB, feed.id)).toEqual(done);
		expect((await enqueueDiagnostic(env, feed, "https://other.example.com"))?.run_id).not.toBe(
			first?.run_id,
		);
	});

	test("reports expired queued/running checks as retryable and replaces the expired run", async () => {
		const env = makeEnv();
		const feed = await getFeed(env.DB, "f1");
		const first = await enqueueDiagnostic(env, feed);
		for (const status of ["queued", "running"]) {
			await env.DB.prepare(
				"UPDATE feed_diagnostics SET status = ?, requested_at = '2000-01-01T00:00:00.000Z'",
			)
				.bind(status)
				.run();
			expect(await getDiagnostic(env.DB, "f1")).toMatchObject({
				status: "error",
				error: "上次检查已超时，请重新检查",
			});
		}
		expect((await enqueueDiagnostic(env, feed))?.run_id).not.toBe(first?.run_id);
	});

	test("queue failures are persisted and malformed legacy addresses produce a recoverable report error", async () => {
		const env = makeEnv();
		const feed = await getFeed(env.DB, "f1");
		vi.mocked(env.FEED_QUEUE.send).mockRejectedValueOnce(new Error("queue unavailable"));
		await expect(enqueueDiagnostic(env, feed)).rejects.toThrow("诊断队列暂不可用");
		expect((await getDiagnostic(env.DB, "f1"))?.status).toBe("error");
		await enqueueDiagnostic(env, feed);
		const job = vi.mocked(env.FEED_QUEUE.send).mock.calls.at(-1)?.[0] as DiagnosticJob;
		await env.DB.exec("UPDATE feeds SET url = 'broken' WHERE id = 'f1';");
		await runDiagnostic(env, job);
		expect(await getDiagnostic(env.DB, "f1")).toMatchObject({ status: "error", report: null });
	});

	test("URL edits remove stale reports even if the old diagnostic is still running", async () => {
		const env = makeEnv();
		const response = deferred<Response>();
		const fetch = vi.fn(() => response.promise);
		vi.stubGlobal("fetch", fetch);
		await enqueueDiagnostic(env, await getFeed(env.DB, "f1"));
		const running = runDiagnostic(
			env,
			vi.mocked(env.FEED_QUEUE.send).mock.calls[0]?.[0] as DiagnosticJob,
		);
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
		await client(env)("PATCH", "/feeds/f1", { url: "https://changed.example.com/rss" });
		fetch.mockImplementation(async () => new Response("missing", { status: 404 }));
		response.resolve(new Response(noSite));
		await running;
		expect(await getDiagnostic(env.DB, "f1")).toBeNull();
	});

	test("HTTP contracts reject unsafe main sites and missing records", async () => {
		const env = makeEnv();
		const request = client(env);
		expect(await request("GET", "/feeds/f1/diagnostics")).toBeNull();
		await request("GET", "/feeds/missing/diagnostics", undefined, 404);
		await request("POST", "/feeds/missing/diagnostics", {}, 404);
		await request("POST", "/feeds/f1/diagnostics", { siteUrl: "http://localhost:9000" }, 400);
		await request("POST", "/feeds/f1/diagnostics", { siteUrl: "" }, 400);
		const result = await request<FeedDiagnostic>(
			"POST",
			"/feeds/f1/diagnostics",
			{ siteUrl: "https://example.com/site" },
			202,
		);
		expect(result.status).toBe("queued");
	});
});
