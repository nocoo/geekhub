import { DurableObject } from "cloudflare:workers";
import { HTTPException } from "hono/http-exception";
import type { FetchLog } from "../shared/contracts";

export class FeedLogCache extends DurableObject<Env> {
	// Intentionally transient: eviction/redeployment starts a fresh activity window.
	private entries: FetchLog[] = [];
	private sequence = 0;

	async append(entry: Omit<FetchLog, "id" | "created_at">): Promise<void> {
		this.entries.unshift({
			...entry,
			feed_title: entry.feed_title.slice(0, 200),
			message: entry.message.slice(0, 500),
			article_title: entry.article_title?.slice(0, 200),
			id: ++this.sequence,
			created_at: new Date().toISOString(),
		});
		this.entries.length = Math.min(this.entries.length, 500);
	}

	async list(): Promise<FetchLog[]> {
		return this.entries.map((entry) => ({ ...entry }));
	}

	async clear(): Promise<void> {
		this.entries = [];
	}
}

export function feedLogs(env: Env) {
	// GeekHub has one shared reader dataset, including its ephemeral activity.
	return env.FEED_LOGS.getByName("reader");
}

export async function activityLog(env: Env, entry: Omit<FetchLog, "id" | "created_at">) {
	try {
		await feedLogs(env).append(entry);
	} catch {
		// Activity is best effort; an unavailable cache must not fail the underlying work.
		console.error(JSON.stringify({ event: "activity_cache_unavailable" }));
	}
}

export async function withActivity<T>(
	env: Env,
	context: Pick<
		FetchLog,
		"feed_id" | "feed_title" | "category" | "article_id" | "article_title" | "automatic"
	> & { message: string },
	work: () => Promise<T>,
): Promise<T> {
	const started = Date.now();
	const entry = { ...context, activity_id: crypto.randomUUID(), articles_added: 0 };
	await activityLog(env, {
		...entry,
		level: "info",
		duration_ms: null,
		message: `${context.message} · 开始`,
	});
	try {
		const result = await work();
		await activityLog(env, {
			...entry,
			level: "success",
			duration_ms: Date.now() - started,
			message: `${context.message} · 已完成`,
		});
		return result;
	} catch (error) {
		await activityLog(env, {
			...entry,
			level: "error",
			duration_ms: Date.now() - started,
			message: `${context.message} · ${error instanceof HTTPException ? error.message : "处理失败，请重试"}`,
		});
		throw error;
	}
}
