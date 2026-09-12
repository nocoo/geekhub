import type { FeedJob } from "../shared/contracts";
import { resolveFeedUrl } from "../shared/validation";
import { preferences } from "./data";
import { parseFeed } from "./lib/content";
import { errorMessage } from "./lib/errors";
import { fetchPublic, readBounded } from "./lib/network";
import { demoHost, localFeedXml } from "./local";

interface FeedRow {
	id: string;
	title: string;
	url: string;
	refresh_minutes: number;
	etag: string | null;
	last_modified: string | null;
	fetch_revision: number;
	failure_count: number;
}

export async function fetchLog(
	db: D1Database,
	feed: Pick<FeedRow, "id" | "title">,
	level: "info" | "success" | "error",
	message: string,
	count = 0,
	duration: number | null = null,
) {
	await db
		.prepare(
			"INSERT INTO fetch_logs (feed_id, feed_title, level, message, articles_added, duration_ms) SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM feeds WHERE id = ?)",
		)
		.bind(feed.id, feed.title, level, message.slice(0, 500), count, duration, feed.id)
		.run();
}

export async function enqueueFeed(env: Env, job: FeedJob): Promise<boolean> {
	const now = new Date().toISOString();
	const token = crypto.randomUUID();
	const claimed =
		await env.DB.prepare(`UPDATE feeds SET status = 'queued', lease_until = ?, last_error = NULL, refresh_token = ?, fetch_revision = fetch_revision + 1
    WHERE id = ? AND (lease_until IS NULL OR lease_until < ?) RETURNING id`)
			.bind(new Date(Date.now() + 5 * 60_000).toISOString(), token, job.feedId, now)
			.first();
	if (!claimed) return false;
	try {
		await env.FEED_QUEUE.send({ feedId: job.feedId, token });
	} catch (error) {
		await env.DB.prepare(
			"UPDATE feeds SET status = 'error', lease_until = NULL, refresh_token = NULL, last_error = ? WHERE id = ? AND refresh_token = ?",
		)
			.bind("抓取队列暂不可用，请重试", job.feedId, token)
			.run();
		throw error;
	}
	return true;
}

export async function refreshFeed(env: Env, job: FeedJob): Promise<void> {
	// Pre-migration messages have no ownership token. Cron will reschedule them after the lease expires.
	if (!job.token) return;
	const started = Date.now();
	const feed =
		await env.DB.prepare(`UPDATE feeds SET status = 'fetching', lease_until = ?, fetch_revision = fetch_revision + 1
    WHERE id = ? AND (status != 'fetching' OR lease_until < ?)
		AND refresh_token = ?
    RETURNING *`)
			.bind(
				new Date(started + 90_000).toISOString(),
				job.feedId,
				new Date(started).toISOString(),
				job.token,
			)
			.first<FeedRow>();
	if (!feed) return;
	try {
		await fetchLog(env.DB, feed, "info", "正在读取订阅源…");
		const url = new URL(resolveFeedUrl(feed.url, (await preferences(env.DB)).rsshubUrl));
		const headers: Record<string, string> = {
			Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
		};
		if (feed.etag) headers["If-None-Match"] = feed.etag;
		if (feed.last_modified) headers["If-Modified-Since"] = feed.last_modified;
		const response =
			env.ENVIRONMENT === "local" && url.hostname === demoHost
				? new Response(localFeedXml(url), { headers: { "content-type": "application/rss+xml" } })
				: await fetchPublic(url.href, headers);
		let added = 0;
		if (response.status !== 304) {
			const parsed = parseFeed(
				new TextDecoder().decode(await readBounded(response, 4 * 1024 * 1024)),
				response.url || url.href,
			);
			// Each write checks ownership: replacing an address or a newer consumer fences out old work.
			for (let offset = 0; offset < parsed.articles.length; offset += 25) {
				const statements = await Promise.all(
					parsed.articles.slice(offset, offset + 25).map(async (article) => {
						const hash = await crypto.subtle.digest(
							"SHA-256",
							new TextEncoder().encode(`${feed.id}\0${article.sourceId}`),
						);
						const id = Array.from(new Uint8Array(hash), (b) =>
							b.toString(16).padStart(2, "0"),
						).join("");
						return env.DB.prepare(`INSERT OR IGNORE INTO articles
            (id, feed_id, source_id, title, url, author, published_at, content, description, image_url)
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            WHERE EXISTS (SELECT 1 FROM feeds WHERE id = ? AND fetch_revision = ?)`).bind(
							id,
							feed.id,
							article.sourceId,
							article.title,
							article.url,
							article.author,
							article.publishedAt,
							article.content,
							article.description,
							article.imageUrl,
							feed.id,
							feed.fetch_revision,
						);
					}),
				);
				const results = await env.DB.batch(statements);
				added += results.reduce((sum, result) => sum + result.meta.changes, 0);
			}
			await env.DB.prepare(
				"UPDATE feeds SET title = CASE WHEN title = ? THEN ? ELSE title END, site_url = CASE WHEN site_url = '' THEN ? ELSE site_url END, description = ?, etag = ?, last_modified = ? WHERE id = ? AND fetch_revision = ?",
			)
				.bind(
					url.hostname,
					parsed.title,
					feed.url.startsWith("rsshub://") ? (parsed.declaredSiteUrl ?? "") : parsed.siteUrl,
					parsed.description,
					response.headers.get("etag"),
					response.headers.get("last-modified"),
					feed.id,
					feed.fetch_revision,
				)
				.run();
		}
		const now = new Date().toISOString();
		const completed =
			await env.DB.prepare(`UPDATE feeds SET status = 'success', lease_until = NULL, refresh_token = NULL, last_error = NULL, failure_count = 0,
		  last_fetched_at = ?, next_fetch_at = strftime('%Y-%m-%dT%H:%M:%fZ', ?, '+' || refresh_minutes || ' minutes') WHERE id = ? AND fetch_revision = ?`)
				.bind(now, now, feed.id, feed.fetch_revision)
				.run();
		if (!completed.meta.changes) return;
		await fetchLog(
			env.DB,
			feed,
			"success",
			added ? `发现 ${added} 篇新文章` : "已是最新内容",
			added,
			Date.now() - started,
		);
	} catch (error) {
		const message = errorMessage(error).slice(0, 500);
		const delayMinutes = Math.min(
			1440,
			feed.refresh_minutes * 2 ** Math.min(feed.failure_count, 7),
		);
		const failed = await env.DB.prepare(
			"UPDATE feeds SET status = 'error', lease_until = NULL, last_error = ?, next_fetch_at = ?, failure_count = failure_count + 1 WHERE id = ? AND fetch_revision = ?",
		)
			.bind(
				message,
				new Date(Date.now() + delayMinutes * 60_000).toISOString(),
				feed.id,
				feed.fetch_revision,
			)
			.run();
		if (!failed.meta.changes) return;
		await fetchLog(env.DB, feed, "error", message, 0, Date.now() - started);
		throw error;
	}
}

export async function scheduleFeeds(env: Env): Promise<number> {
	const now = new Date().toISOString();
	const due = await env.DB.prepare(`SELECT id FROM feeds
    WHERE is_active = 1 AND (next_fetch_at IS NULL OR next_fetch_at <= ?) AND (lease_until IS NULL OR lease_until < ?)
    ORDER BY next_fetch_at LIMIT 50`)
		.bind(now, now)
		.all<{ id: string }>();
	for (const feed of due.results) await enqueueFeed(env, { feedId: feed.id });
	await env.DB.prepare("DELETE FROM fetch_logs WHERE created_at < ?")
		.bind(new Date(Date.now() - 30 * 86400_000).toISOString())
		.run();
	return due.results.length;
}
