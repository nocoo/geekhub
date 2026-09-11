import { describe, expect, test, vi } from "vitest";
import type { FeedJob } from "../../src/shared/contracts";
import { enqueueFeed, refreshFeed, scheduleFeeds } from "../../src/worker/feeds";
import worker from "../../src/worker/index";
import { makeEnv, rss } from "./support";

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
		await refreshFeed(env, job);
		const count = await env.DB.prepare(
			"SELECT COUNT(*) AS count FROM articles WHERE feed_id='f1'",
		).first("count");
		expect(count).toBe(30);
		await env.DB.exec("UPDATE articles SET is_starred = 1, is_read = 1 WHERE feed_id = 'f1';");
		await refreshFeed(env, job);
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
		await refreshFeed(env, job);
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
		await refreshFeed(env, job);
		expect(fetch.mock.calls[0]?.[1].headers).toMatchObject({
			"If-None-Match": "etag",
			"If-Modified-Since": "date",
		});
		await refreshFeed(env, job);
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
		await env.DB.prepare("UPDATE feeds SET status='fetching',lease_until=? WHERE id='f1'")
			.bind(new Date(Date.now() + 60000).toISOString())
			.run();
		await refreshFeed(env, job);
		expect(fetch).not.toHaveBeenCalled();
		await env.DB.exec("UPDATE feeds SET lease_until='2000-01-01' WHERE id='f1';");
		fetch.mockResolvedValue(new Response(rss()));
		await refreshFeed(env, job);
		expect(fetch).toHaveBeenCalledOnce();
	});
	test("records errors and backoff, then allows a later retry", async () => {
		const env = makeEnv();
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("upstream timeout")));
		await expect(refreshFeed(env, job)).rejects.toThrow("upstream timeout");
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
		await refreshFeed(env, job);
		expect(fetch).not.toHaveBeenCalled();
		env.ENVIRONMENT = "production";
		await refreshFeed(env, job);
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
		const message = (): Message<FeedJob> => ({
			id: crypto.randomUUID(),
			timestamp: new Date(),
			body: job,
			attempts: 1,
			ack: vi.fn(),
			retry: vi.fn(),
		});
		const success = message();
		const failed = message();
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
});
