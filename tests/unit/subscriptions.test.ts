import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { expect, test, vi } from "vitest";
import type { Category, Feed } from "../../src/shared/contracts";
import { client, makeEnv } from "./support";

test("retired feed state is removed without losing subscriptions or reading state", () => {
	const db = new DatabaseSync(":memory:");
	try {
		for (const file of readdirSync("migrations")
			.filter((name) => name < "0007")
			.sort())
			db.exec(readFileSync(`migrations/${file}`, "utf8"));
		db.exec(`
			INSERT INTO categories(id,name) VALUES ('category','Kept');
			INSERT INTO feeds(id,category_id,title,url,refresh_minutes,next_fetch_at,failure_count,refresh_token,fetch_revision)
			VALUES ('feed','category','Kept','https://example.com/rss',30,'2100-01-01',3,'current-job',7);
			INSERT INTO articles(id,feed_id,source_id,title,url,published_at,is_read,is_starred,is_later)
			VALUES ('article','feed','source','Kept','https://example.com/article','2026-01-01',1,1,1);
			INSERT INTO fetch_logs(feed_id,feed_title,level,message) VALUES ('feed','Kept','info','Retired');
		`);
		db.exec(readFileSync("migrations/0007_remove_retired_feed_state.sql", "utf8"));
		expect(db.prepare("SELECT category_id,refresh_token,fetch_revision FROM feeds").get()).toEqual({
			category_id: "category",
			refresh_token: "current-job",
			fetch_revision: 7,
		});
		expect(db.prepare("SELECT is_read,is_starred,is_later FROM articles").get()).toEqual({
			is_read: 1,
			is_starred: 1,
			is_later: 1,
		});
		expect(
			db.prepare("SELECT name FROM sqlite_master WHERE name IN ('fetch_logs','feeds_due')").all(),
		).toEqual([]);
		const columns = db
			.prepare("PRAGMA table_info(feeds)")
			.all()
			.map((column) => column.name);
		for (const name of ["refresh_minutes", "next_fetch_at", "failure_count"])
			expect(columns).not.toContain(name);
		expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
	} finally {
		db.close();
	}
});

test("migration preserves existing articles and initializes a deterministic subscription order", () => {
	const db = new DatabaseSync(":memory:");
	try {
		db.exec(readFileSync("migrations/0001_reader.sql", "utf8"));
		db.exec(
			"INSERT INTO feeds(id,title,url) VALUES ('z','Zulu','https://z.example.com/rss'),('a','Alpha','https://a.example.com/rss');",
		);
		db.exec(
			"INSERT INTO articles(id,feed_id,source_id,title,url,published_at,is_starred) VALUES ('article','z','source','Kept','https://z.example.com/article','2020-01-01',1);",
		);
		db.exec(readFileSync("migrations/0002_reader_workflow.sql", "utf8"));
		expect(db.prepare("SELECT id,sort_order FROM feeds ORDER BY sort_order").all()).toEqual([
			{ id: "a", sort_order: 0 },
			{ id: "z", sort_order: 1 },
		]);
		expect(db.prepare("SELECT is_starred FROM articles").get()?.is_starred).toBe(1);
		expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
	} finally {
		db.close();
	}
});

test("subscription ordering is complete, atomic, persisted and can move between categories", async () => {
	const env = makeEnv();
	const request = client(env);
	const category = await request<Category>(
		"POST",
		"/categories",
		{ name: "News", icon: "🗞", sort_order: 5 },
		201,
	);
	const second = await request<Feed>(
		"POST",
		"/feeds",
		{ title: "Second", url: "https://example.com/second" },
		201,
	);
	const third = await request<Feed>(
		"POST",
		"/feeds",
		{ title: "Third", url: "https://example.com/third" },
		201,
	);
	const ids = [third.id, "f1", second.id];
	await request("POST", "/feeds/reorder", { ids, feedId: "f1", categoryId: category.id });
	const ordered = await request<Feed[]>("GET", "/feeds");
	expect(ordered.map((feed) => feed.id)).toEqual(ids);
	expect(ordered.map((feed) => feed.sort_order)).toEqual([0, 1, 2]);
	expect(ordered[1]).toMatchObject({ category_id: category.id, total_count: 2, unread_count: 2 });
	await request("POST", "/feeds/reorder", { ids: ["f1", second.id] }, 409);
	await request("POST", "/feeds/reorder", { ids: ["f1", second.id, "missing"] }, 409);
	await request("POST", "/feeds/reorder", { ids: ["f1", "f1", second.id] }, 400);
	await request("POST", "/feeds/reorder", { ids, feedId: "missing", categoryId: null }, 400);
	await request("POST", "/feeds/reorder", { ids, feedId: "f1" }, 400);
	await request("POST", "/feeds/reorder", { ids, categoryId: null }, 400);
	await request("POST", "/feeds/reorder", { ids, feedId: "f1", categoryId: "missing" }, 404);
	await request("POST", "/feeds/reorder", { ids: [] }, 400);
	expect((await request<Feed[]>("GET", "/feeds")).map((feed) => feed.id)).toEqual(ids);
	await request("POST", "/feeds/reorder", { ids: [...ids].reverse() });
	await request("POST", "/feeds/reorder", { ids, feedId: "f1", categoryId: null });
	expect((await request<Feed[]>("GET", "/feeds"))[1]?.category_id).toBeNull();
	await request("PATCH", `/categories/${category.id}`, {
		name: "Renamed",
		color: "#123456",
		icon: "📚",
		sort_order: 2,
	});
	await request("POST", "/categories/reorder", { ids: [category.id, "c1"] });
	expect(await request<Category[]>("GET", "/categories")).toMatchObject([
		{ id: category.id, sort_order: 0, color: "#123456", icon: "📚" },
		{ id: "c1", sort_order: 1 },
	]);
	await request("POST", "/categories/reorder", { ids: ["c1"] }, 409);
});

test("replacing a URL resets validators and queued work while retaining reading data", async () => {
	const env = makeEnv();
	const request = client(env);
	await env.DB.exec(
		"UPDATE feeds SET etag='old', last_modified='old', last_error='old', last_fetched_at='2000-01-01', site_url='https://old.example.com' WHERE id='f1';",
	);
	await env.DB.exec("UPDATE articles SET is_read=1,is_starred=1,is_later=1 WHERE id='a1';");
	const replaced = await request<Feed>("PATCH", "/feeds/f1", {
		url: " https://new.example.com/rss#fragment ",
	});
	expect(replaced).toMatchObject({
		id: "f1",
		url: "https://new.example.com/rss",
		site_url: "",
		status: "queued",
		total_count: 2,
	});
	expect(
		await env.DB.prepare(
			"SELECT etag,last_modified,last_fetched_at FROM feeds WHERE id='f1'",
		).first(),
	).toEqual({
		etag: null,
		last_modified: null,
		last_fetched_at: null,
	});
	expect(await request("GET", "/articles/a1")).toMatchObject({
		is_read: 1,
		is_starred: 1,
		is_later: 1,
	});
	expect(env.FEED_QUEUE.send).toHaveBeenCalledOnce();
	await request("PATCH", "/feeds/f1", {
		url: replaced.url,
		site_url: "https://new.example.com/blog",
	});
	expect(env.FEED_QUEUE.send).toHaveBeenCalledOnce();
	await request("PATCH", "/feeds/f1", { is_active: false });
	await request("PATCH", "/feeds/f1", {
		url: "rsshub://github/issue/nocoo/geekhub",
	});
	expect(env.FEED_QUEUE.send).toHaveBeenCalledOnce();
	vi.mocked(env.FEED_QUEUE.send).mockRejectedValueOnce(new Error("queue offline"));
	const resumed = await request<Feed>("PATCH", "/feeds/f1", { is_active: true });
	expect(resumed).toMatchObject({
		is_active: 1,
		status: "error",
		url: "rsshub://github/issue/nocoo/geekhub",
	});
	await request("PATCH", "/feeds/f1", { refresh_minutes: 30 }, 400);
	expect(resumed).not.toHaveProperty("refresh_minutes");
	expect(resumed).not.toHaveProperty("next_fetch_at");
});

test("address editing validates both destinations and preserves the old address on conflict", async () => {
	const env = makeEnv();
	const request = client(env);
	for (const patch of [
		{ url: "http://127.0.0.1/rss" },
		{ url: "rsshub://../secret" },
		{ site_url: "http://localhost" },
		{ site_url: "javascript:alert(1)" },
	])
		await request("PATCH", "/feeds/f1", patch, 400);
	const duplicate = await request<Feed>(
		"POST",
		"/feeds",
		{ url: "https://example.com/duplicate" },
		201,
	);
	await request("PATCH", "/feeds/f1", { url: duplicate.url }, 409);
	expect((await request<Feed[]>("GET", "/feeds")).find((feed) => feed.id === "f1")?.url).toBe(
		"https://example.com/feed",
	);
});
