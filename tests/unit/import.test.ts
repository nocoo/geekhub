import { expect, test } from "vitest";
import { importSql, normalizeImport } from "../../src/shared/import";
import { TestDatabase } from "./support";

function exported() {
	return {
		categories: [
			{
				id: "csv-category",
				name: "旧分类",
				color: "#10b981",
				icon: "🌍",
				sort_order: "2",
				user_id: "retired-user",
			},
		],
		feeds: [
			{
				id: "csv-feed",
				title: "Imported feed",
				url: "rsshub://test/feed",
				category_id: "csv-category",
				fetch_interval_minutes: "60",
				auto_translate: "true",
				is_active: "true",
				description: "A 'quoted' description",
				created_at: "2026-01-10 08:49:56.238349+00",
				user_id: "another-retired-user",
			},
		],
		blogs: [
			{
				id: "csv-blog",
				name: "Author's blog",
				url: "https://author.example.com",
				feed: "https://author.example.com/feed",
				tags: '["编程","随笔"]',
				score: '{"overall":88,"contentQuality":90}',
				last_updated: "2026-01-12 03:42:42.704+00",
				created_at: "2026-01-12 03:42:42.704+00",
				updated_at: "2026-01-12 03:42:42.704+00",
			},
		],
	} satisfies Record<
		"categories" | "feeds" | "blogs",
		[Record<string, string>, ...Record<string, string>[]]
	>;
}

test("imports old IDs, category associations and catalogue metadata into one library without resetting reader state", async () => {
	const data = normalizeImport(exported());
	expect(data.categories[0]).toMatchObject({ icon: "🌍", color: "#10b981", sort_order: 2 });
	expect(data.feeds[0]).toMatchObject({
		url: "rsshub://test/feed",
		auto_translate: 1,
		is_active: 1,
	});
	expect(data.feeds[0]).not.toHaveProperty("user_id");
	const db = new TestDatabase();
	await db.exec(importSql(data));
	await db.exec(
		"INSERT INTO articles(id,feed_id,source_id,title,url,published_at,is_starred,is_read) VALUES ('saved','csv-feed','1','Saved','https://author.example.com/1','2026-01-01',1,1);",
	);
	const changed = exported();
	changed.feeds[0].title = "Renamed";
	await db.exec(importSql(normalizeImport(changed)));
	expect(await db.prepare("SELECT title,description,category_id FROM feeds").first()).toEqual({
		title: "Renamed",
		description: "A 'quoted' description",
		category_id: "csv-category",
	});
	expect(
		await db.prepare("SELECT is_starred,is_read FROM articles WHERE id='saved'").first(),
	).toEqual({ is_starred: 1, is_read: 1 });
	expect(await db.prepare("SELECT COUNT(*) AS count FROM directory").first("count")).toBe(1);
	expect(await db.prepare("SELECT title,score,last_updated FROM directory").first()).toMatchObject({
		title: "Author's blog",
		score: '{"overall":88,"contentQuality":90}',
		last_updated: "2026-01-12T03:42:42.704Z",
	});
	expect((await db.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
});

test("retains blogs without usable RSS and preserves their source value, while subscription URLs still fail validation", async () => {
	const input = exported();
	input.blogs[0].feed = "http://incomplete/feed";
	let data = normalizeImport(input);
	expect(data.directory[0]).toMatchObject({ url: "", source_feed_url: "http://incomplete/feed" });
	input.blogs[0].feed = "";
	input.blogs[0].tags = "";
	input.blogs[0].score = "";
	input.blogs[0].last_updated = "";
	input.blogs[0].created_at = "";
	input.blogs[0].updated_at = "";
	input.categories[0].sort_order = "";
	input.feeds[0].url = "https://author.example.com/feed";
	input.feeds[0].auto_translate = "false";
	input.feeds[0].is_active = "false";
	input.feeds[0].category_id = "";
	input.feeds[0].created_at = "";
	data = normalizeImport(input);
	expect(data.directory[0]).toMatchObject({
		url: "",
		category: "独立博客",
		tags: "[]",
		score: "{}",
		last_updated: null,
	});
	expect(data.feeds[0]).toMatchObject({ category_id: null, is_active: 0, auto_translate: 0 });
	await new TestDatabase().exec(importSql(data));
	input.feeds[0].url = "http://127.0.0.1/private";
	expect(() => normalizeImport(input)).toThrow();
});

test("rejects duplicate exports, dangling categories, invalid timestamps and malformed score data before writing", () => {
	const missingCategory = exported();
	missingCategory.feeds[0].category_id = "missing";
	expect(() => normalizeImport(missingCategory)).toThrow("分类不存在");
	for (const table of ["categories", "feeds", "blogs"] as const) {
		const raw = exported();
		if (table === "categories") raw.categories.push({ ...raw.categories[0] });
		if (table === "feeds") raw.feeds.push({ ...raw.feeds[0] });
		if (table === "blogs") raw.blogs.push({ ...raw.blogs[0] });
		expect(() => normalizeImport(raw)).toThrow("重复");
	}
	const names = exported();
	names.categories.push({ ...names.categories[0], id: "different-id" });
	expect(() => normalizeImport(names)).toThrow("分类名称");
	const urls = exported();
	urls.feeds.push({ ...urls.feeds[0], id: "different-id" });
	expect(() => normalizeImport(urls)).toThrow("订阅地址");
	const badDate = exported();
	badDate.blogs[0].last_updated = "bad date";
	expect(() => normalizeImport(badDate)).toThrow();
	const badScore = exported();
	badScore.blogs[0].score = '{"overall":500}';
	expect(() => normalizeImport(badScore)).toThrow();
	expect(() => normalizeImport({})).toThrow();
});
