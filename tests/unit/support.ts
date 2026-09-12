import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { expect, vi } from "vitest";
import type { FeedJob } from "../../src/shared/contracts";
import { enqueueFeed } from "../../src/worker/feeds";
import { app } from "../../src/worker/index";

export function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
}

export function client(env: Env) {
	return async <T = Record<string, unknown>>(
		method: string,
		path: string,
		body?: unknown,
		status = 200,
	): Promise<T> => {
		const response = await app.request(
			`http://127.0.0.1/api${path}`,
			{
				method,
				...(body === undefined
					? {}
					: { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
			},
			env,
		);
		const result = await response.json();
		expect(response.status, `${method} ${path}: ${JSON.stringify(result)}`).toBe(status);
		return result as T;
	};
}

export async function queuedJob(env: Env, feedId = "f1"): Promise<FeedJob> {
	expect(await enqueueFeed(env, { feedId })).toBe(true);
	return vi.mocked(env.FEED_QUEUE.send).mock.calls.at(-1)?.[0] as FeedJob;
}

class Statement implements D1PreparedStatement {
	constructor(
		private db: DatabaseSync,
		private sql: string,
		private values: SQLInputValue[] = [],
	) {}
	bind(...values: unknown[]) {
		return new Statement(this.db, this.sql, values as SQLInputValue[]);
	}
	async first<T>(column?: string): Promise<T | null> {
		const row = this.db.prepare(this.sql).get(...this.values);
		return (row ? (column ? row[column] : row) : null) as T | null;
	}
	async run<T>(): Promise<D1Result<T>> {
		const result = this.db.prepare(this.sql).run(...this.values);
		return {
			success: true,
			results: [],
			meta: {
				changes: Number(result.changes),
				last_row_id: Number(result.lastInsertRowid),
				duration: 0,
				size_after: 0,
				rows_read: 0,
				rows_written: Number(result.changes),
				changed_db: true,
			},
		};
	}
	async all<T>(): Promise<D1Result<T>> {
		const rows = this.db.prepare(this.sql).all(...this.values);
		return {
			success: true,
			results: rows as T[],
			meta: {
				changes: 0,
				last_row_id: 0,
				duration: 0,
				size_after: 0,
				rows_read: rows.length,
				rows_written: 0,
				changed_db: false,
			},
		};
	}
	raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>;
	raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
	async raw<T>(options?: { columnNames?: boolean }): Promise<T[] | [string[], ...T[]]> {
		const statement = this.db.prepare(this.sql);
		const rows = statement.all(...this.values).map(Object.values) as T[];
		return options?.columnNames
			? [statement.columns().map((column) => column.name), ...rows]
			: rows;
	}
}

export class TestDatabase implements D1Database {
	sqlite = new DatabaseSync(":memory:");
	constructor() {
		const migrations = new URL("../../migrations/", import.meta.url);
		for (const file of readdirSync(migrations)
			.filter((file) => file.endsWith(".sql"))
			.sort())
			this.sqlite.exec(readFileSync(new URL(file, migrations), "utf8"));
	}
	prepare(sql: string) {
		return new Statement(this.sqlite, sql);
	}
	async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
		this.sqlite.exec("BEGIN");
		try {
			const results = [];
			for (const statement of statements) results.push(await statement.run<T>());
			this.sqlite.exec("COMMIT");
			return results;
		} catch (error) {
			this.sqlite.exec("ROLLBACK");
			throw error;
		}
	}
	async exec(sql: string) {
		this.sqlite.exec(sql);
		return { count: 1, duration: 0 };
	}
	withSession() {
		return {
			prepare: this.prepare.bind(this),
			batch: this.batch.bind(this),
			getBookmark: () => null,
		};
	}
	async dump() {
		return new ArrayBuffer(0);
	}
}

export function makeEnv(): Env & { DB: TestDatabase } {
	const db = new TestDatabase();
	db.sqlite.exec(`INSERT INTO categories(id,name,color) VALUES ('c1','Engineering','green');
    INSERT INTO feeds(id,category_id,title,url) VALUES ('f1','c1','Example','https://example.com/feed');
    INSERT INTO articles(id,feed_id,source_id,title,url,published_at,content,description) VALUES
      ('a1','f1','one','Hello world','https://example.com/one','2026-09-01T12:00:00.000Z','<p>An article about the craft of writing software and the value of careful attention to small details.</p>','The craft of writing software.'),
      ('a2','f1','two','Hello again','https://example.com/two','2026-09-01T12:00:00.000Z','<p>Second article.</p>','Another idea.');`);
	return {
		DB: db,
		FEED_QUEUE: {
			send: vi
				.fn<Queue["send"]>()
				.mockResolvedValue({ metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } } }),
			sendBatch: vi.fn<Queue["sendBatch"]>(),
			metrics: vi.fn<Queue["metrics"]>(),
		},
		ENVIRONMENT: "local",
		RESOURCE_ENV: "local",
		LOCAL_USER_EMAIL: "",
		CF_ACCESS_AUD: "",
		CF_ACCESS_TEAM_DOMAIN: "",
		AI_ENCRYPTION_KEY: crypto.randomUUID() + crypto.randomUUID(),
	};
}

export function rss(items = 1) {
	return `<rss version="2.0"><channel><title>Fresh feed</title><link>https://example.com</link><description>Feed description</description>${Array.from({ length: items }, (_, index) => `<item><guid>${index}</guid><title>Item ${index}</title><link>https://example.com/article/${index}</link><pubDate>Fri, 11 Sep 2026 00:00:00 GMT</pubDate><description><![CDATA[<p>Safe content ${index}</p>]]></description></item>`).join("")}</channel></rss>`;
}

export function aiResponse(text: string, sdk: "openai" | "anthropic" = "openai") {
	const body =
		sdk === "openai"
			? {
					id: "resp_local",
					created_at: 1,
					model: "test-model",
					status: "completed",
					error: null,
					incomplete_details: null,
					output: [
						{
							id: "msg_local",
							type: "message",
							role: "assistant",
							status: "completed",
							content: [{ type: "output_text", text, annotations: [] }],
						},
					],
					usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
				}
			: {
					id: "msg_local",
					type: "message",
					role: "assistant",
					model: "test-model",
					content: [{ type: "text", text }],
					stop_reason: "end_turn",
					stop_sequence: null,
					usage: { input_tokens: 10, output_tokens: 10 },
				};
	return Response.json(body);
}
