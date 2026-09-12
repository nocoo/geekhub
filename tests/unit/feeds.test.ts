import { describe, expect, test, vi } from "vitest";
import type { FeedJob } from "../../src/shared/contracts";
import { enqueueFeed, refreshFeed, scheduleFeeds } from "../../src/worker/feeds";
import worker from "../../src/worker/index";
import { client, deferred, makeEnv, queuedJob, rss } from "./support";

describe("durable feed work", () => {
	const job = { feedId: "f1" };
	test("queues once under a lease and resets the lease when enqueue fails", async () => {
		const env = makeEnv();
		expect(await enqueueFeed(env, job)).toBe(true);
		expect(await enqueueFeed(env, job)).toBe(false);
		expect(await enqueueFeed(env, { feedId: "missing" })).toBe(false);
		expect(env.FEED_QUEUE.send).toHaveBeenCalledOnce();
		await env.DB.exec("UPDATE feeds SET lease_until = NULL WHERE id = 'f1';");
		vi.mocked(env.FEED_QUEUE.send).mockRejectedValueOnce(new Error("queue unavailable"));
		await expect(enqueueFeed(env, job)).rejects.toThrow("queue unavailable");
		expect(
			await env.DB.prepare("SELECT status,lease_until FROM feeds WHERE id='f1'").first(),
		).toEqual({ status: "error", lease_until: null });
	});
	test("stores bounded batches, deduplicates repeated delivery and preserves read states", async () => {
		const env = makeEnv();
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(rss(28), {
						headers: { etag: "version-1", "last-modified": "Fri, 11 Sep 2026 00:00:00 GMT" },
					}),
			),
		);
		await refreshFeed(env, await queuedJob(env));
		const count = await env.DB.prepare(
			"SELECT COUNT(*) AS count FROM articles WHERE feed_id='f1'",
		).first("count");
		expect(count).toBe(30);
		await env.DB.exec("UPDATE articles SET is_starred = 1, is_read = 1 WHERE feed_id = 'f1';");
		await refreshFeed(env, await queuedJob(env));
		expect(
			await env.DB.prepare("SELECT COUNT(*) AS count FROM articles WHERE feed_id='f1'").first(
				"count",
			),
		).toBe(30);
		expect(
			await env.DB.prepare(
				"SELECT SUM(is_starred) AS count FROM articles WHERE feed_id='f1'",
			).first("count"),
		).toBe(30);
		expect(
			await env.DB.prepare("SELECT title, status,etag FROM feeds WHERE id='f1'").first(),
		).toEqual({ title: "Example", status: "success", etag: "version-1" });
		expect(
			await env.DB.prepare("SELECT message FROM fetch_logs ORDER BY id DESC LIMIT 1").first(
				"message",
			),
		).toBe("已是最新内容");
		await env.DB.exec("UPDATE feeds SET title='example.com' WHERE id='f1';");
		await refreshFeed(env, await queuedJob(env));
		expect(await env.DB.prepare("SELECT title FROM feeds WHERE id='f1'").first("title")).toBe(
			"Fresh feed",
		);
	});
	test("reuses validators on 304 and handles empty feeds without a D1 batch", async () => {
		const env = makeEnv();
		await env.DB.exec("UPDATE feeds SET etag='etag', last_modified='date' WHERE id='f1';");
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 304 }))
			.mockResolvedValueOnce(new Response(rss(0)));
		vi.stubGlobal("fetch", fetch);
		await refreshFeed(env, await queuedJob(env));
		expect(fetch.mock.calls[0]?.[1].headers).toMatchObject({
			"If-None-Match": "etag",
			"If-Modified-Since": "date",
		});
		await refreshFeed(env, await queuedJob(env));
		expect(
			await env.DB.prepare("SELECT COUNT(*) AS count FROM articles WHERE feed_id='f1'").first(
				"count",
			),
		).toBe(2);
	});
	test("does no work for deleted feeds or an active competing consumer", async () => {
		const env = makeEnv();
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		await refreshFeed(env, { feedId: "missing" });
		await refreshFeed(env, { feedId: "missing" });
		const claimed = await queuedJob(env);
		await env.DB.prepare("UPDATE feeds SET status='fetching',lease_until=? WHERE id='f1'")
			.bind(new Date(Date.now() + 60000).toISOString())
			.run();
		await refreshFeed(env, claimed);
		expect(fetch).not.toHaveBeenCalled();
		await env.DB.exec("UPDATE feeds SET lease_until='2000-01-01' WHERE id='f1';");
		fetch.mockResolvedValue(new Response(rss()));
		await refreshFeed(env, claimed);
		expect(fetch).toHaveBeenCalledOnce();
	});
	test("records errors and backoff, then allows a later retry", async () => {
		const env = makeEnv();
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("upstream timeout")));
		await expect(refreshFeed(env, await queuedJob(env))).rejects.toThrow("upstream timeout");
		expect(
			await env.DB.prepare("SELECT status,last_error,lease_until FROM feeds WHERE id='f1'").first(),
		).toEqual({ status: "error", last_error: "upstream timeout", lease_until: null });
		expect(
			await env.DB.prepare("SELECT level FROM fetch_logs ORDER BY id DESC LIMIT 1").first("level"),
		).toBe("error");
	});
	test("uses local fixtures only in the local runtime", async () => {
		const env = makeEnv();
		await env.DB.exec(
			"UPDATE feeds SET url='https://demo.geekhub.example/rss/simon' WHERE id='f1';",
		);
		const fetch = vi.fn(async () => new Response(rss()));
		vi.stubGlobal("fetch", fetch);
		await refreshFeed(env, await queuedJob(env));
		expect(fetch).not.toHaveBeenCalled();
		env.ENVIRONMENT = "production";
		await refreshFeed(env, await queuedJob(env));
		expect(fetch).toHaveBeenCalledOnce();
	});
	test("scheduler enqueues due feeds and expires old logs", async () => {
		const env = makeEnv();
		await env.DB.exec(
			"INSERT INTO fetch_logs(feed_title,level,message,created_at) VALUES ('Old','info','Expired','2000-01-01');",
		);
		expect(await scheduleFeeds(env)).toBe(1);
		expect(await scheduleFeeds(env)).toBe(0);
		expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM fetch_logs").first("count")).toBe(0);
	});
	test("worker acknowledges completed queue work and retries failed jobs", async () => {
		const env = makeEnv();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValueOnce(new Response(rss())).mockRejectedValueOnce(new Error("retry")),
		);
		await env.DB.exec(
			"INSERT INTO feeds(id,title,url) VALUES ('f2','Second','https://example.com/second');",
		);
		const firstJob = await queuedJob(env);
		const secondJob = await queuedJob(env, "f2");
		const message = (body: FeedJob): Message<FeedJob> => ({
			id: crypto.randomUUID(),
			timestamp: new Date(),
			body,
			attempts: 1,
			ack: vi.fn(),
			retry: vi.fn(),
		});
		const success = message(firstJob);
		const failed = message(secondJob);
		await worker.queue(
			{
				queue: "local",
				messages: [success, failed],
				metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
				ackAll: vi.fn(),
				retryAll: vi.fn(),
			},
			env,
		);
		expect(success.ack).toHaveBeenCalledOnce();
		expect(failed.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
		await worker.scheduled(
			{ cron: "*/15 * * * *", scheduledTime: Date.now(), noRetry: vi.fn() },
			env,
		);
	});
	test("acknowledges duplicate, superseded and pre-migration messages without refetching", async () => {
		const env = makeEnv();
		const fetch = vi.fn(async () => new Response(rss()));
		vi.stubGlobal("fetch", fetch);
		const delivered = await queuedJob(env);
		await refreshFeed(env, delivered);
		await refreshFeed(env, delivered);
		await refreshFeed(env, { feedId: "f1" });
		expect(fetch).toHaveBeenCalledOnce();
		const current = await queuedJob(env);
		await refreshFeed(env, delivered);
		expect(fetch).toHaveBeenCalledOnce();
		await refreshFeed(env, current);
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	test.each(["replace", "pause", "delete", "requeue"])(
		"fences in-flight writes after %s",
		async (change) => {
			const env = makeEnv();
			const response = deferred<Response>();
			const fetch = vi.fn(() => response.promise);
			vi.stubGlobal("fetch", fetch);
			const oldJob = await queuedJob(env);
			const running = refreshFeed(env, oldJob);
			await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
			const request = client(env);
			if (change === "replace")
				await request("PATCH", "/feeds/f1", {
					url: "https://new.example.com/rss",
					site_url: "https://new.example.com",
				});
			if (change === "pause") await request("PATCH", "/feeds/f1", { is_active: false });
			if (change === "delete") await request("DELETE", "/feeds/f1");
			if (change === "requeue") {
				await env.DB.exec("UPDATE feeds SET lease_until = '2000-01-01' WHERE id = 'f1';");
				await queuedJob(env);
			}
			response.resolve(new Response(rss(28), { headers: { etag: "stale" } }));
			await running;
			await refreshFeed(env, oldJob);
			expect(fetch).toHaveBeenCalledOnce();
			expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM articles").first("n")).toBe(
				change === "delete" ? 0 : 2,
			);
			expect(
				await env.DB.prepare("SELECT COUNT(*) AS n FROM fetch_logs WHERE level = 'success'").first(
					"n",
				),
			).toBe(0);
			if (change !== "delete") {
				const row = await env.DB.prepare(
					"SELECT status, etag, refresh_token FROM feeds WHERE id = 'f1'",
				).first<{ status: string; etag: string | null; refresh_token: string | null }>();
				expect(row?.etag).toBeNull();
				expect(row?.status).toBe(change === "pause" ? "idle" : "queued");
				expect(row?.refresh_token).not.toBe(oldJob.token);
			}
		},
	);

	test("a superseded network failure cannot change the new feed's status", async () => {
		const env = makeEnv();
		const response = deferred<Response>();
		const fetch = vi.fn(() => response.promise);
		vi.stubGlobal("fetch", fetch);
		const running = refreshFeed(env, await queuedJob(env));
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
		await client(env)("PATCH", "/feeds/f1", { url: "https://replacement.example.com/rss" });
		response.reject(new Error("old host unavailable"));
		await running;
		expect(
			await env.DB.prepare("SELECT status, last_error FROM feeds WHERE id = 'f1'").first(),
		).toEqual({ status: "queued", last_error: null });
	});

	test("backoff grows to one day and successful retries clear it", async () => {
		const env = makeEnv();
		await env.DB.exec("UPDATE feeds SET failure_count = 10 WHERE id = 'f1';");
		const fetch = vi
			.fn()
			.mockRejectedValueOnce(new Error("gone"))
			.mockResolvedValueOnce(new Response(rss()));
		vi.stubGlobal("fetch", fetch);
		const retry = await queuedJob(env);
		const before = Date.now();
		await expect(refreshFeed(env, retry)).rejects.toThrow("gone");
		const next = await env.DB.prepare(
			"SELECT next_fetch_at FROM feeds WHERE id = 'f1'",
		).first<string>("next_fetch_at");
		expect(Date.parse(next ?? "") - before).toBeGreaterThanOrEqual(86400_000);
		expect(Date.parse(next ?? "") - before).toBeLessThan(86401_000);
		await refreshFeed(env, retry);
		expect(
			await env.DB.prepare("SELECT failure_count FROM feeds WHERE id = 'f1'").first(
				"failure_count",
			),
		).toBe(0);
	});

	test("completion respects a refresh interval edited during the request", async () => {
		const env = makeEnv();
		const response = deferred<Response>();
		const fetch = vi.fn(() => response.promise);
		vi.stubGlobal("fetch", fetch);
		const running = refreshFeed(env, await queuedJob(env));
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
		await client(env)("PATCH", "/feeds/f1", {
			refresh_minutes: 15,
			site_url: "https://saved.example.com",
		});
		response.resolve(new Response(rss()));
		await running;
		const row = await env.DB.prepare(
			"SELECT last_fetched_at, next_fetch_at, site_url FROM feeds WHERE id = 'f1'",
		).first<{ last_fetched_at: string; next_fetch_at: string; site_url: string }>();
		expect(Date.parse(row?.next_fetch_at ?? "") - Date.parse(row?.last_fetched_at ?? "")).toBe(
			15 * 60_000,
		);
		expect(row?.site_url).toBe("https://saved.example.com/");
	});
});
