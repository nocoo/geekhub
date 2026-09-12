import {
	type ArticleDetail,
	defaultPreferences,
	type Feed,
	type Preferences,
	type Stats,
} from "../shared/contracts";
import { fail } from "./lib/errors";

export async function preferences(db: D1Database): Promise<Preferences> {
	const row = await db
		.prepare("SELECT preferences FROM settings WHERE id = 1")
		.first<{ preferences: string }>();
	return { ...defaultPreferences, ...JSON.parse(row?.preferences ?? "{}") };
}

export async function getFeed(db: D1Database, id: string): Promise<Feed> {
	const feed = await db
		.prepare(`SELECT f.*,
    (SELECT COUNT(*) FROM articles WHERE feed_id = f.id) AS total_count,
    (SELECT COUNT(*) FROM articles WHERE feed_id = f.id AND is_read = 0) AS unread_count
    FROM feeds f WHERE f.id = ?`)
		.bind(id)
		.first<Feed>();
	if (!feed) fail(404, "订阅源不存在");
	return feed;
}

export async function requireCategory(db: D1Database, id: string | null | undefined) {
	if (id && !(await db.prepare("SELECT id FROM categories WHERE id = ?").bind(id).first()))
		fail(404, "分类不存在");
}

export async function articleDetail(db: D1Database, id: string): Promise<ArticleDetail> {
	const article = await db
		.prepare(`SELECT a.*, f.title AS feed_title, f.site_url, f.auto_translate
    FROM articles a JOIN feeds f ON f.id = a.feed_id WHERE a.id = ?`)
		.bind(id)
		.first<ArticleDetail>();
	if (!article) fail(404, "文章不存在");
	return article;
}

export async function listFeeds(db: D1Database): Promise<Feed[]> {
	const rows = await db
		.prepare(`SELECT f.*, COUNT(a.id) AS total_count,
    COALESCE(SUM(CASE WHEN a.is_read = 0 THEN 1 ELSE 0 END), 0) AS unread_count
    FROM feeds f LEFT JOIN articles a ON a.feed_id = f.id
    GROUP BY f.id ORDER BY f.sort_order, f.title COLLATE NOCASE, f.id`)
		.all<Feed>();
	return rows.results;
}

export async function reorder(
	db: D1Database,
	table: "feeds" | "categories",
	ids: string[],
	move?: { feedId: string; categoryId: string | null },
): Promise<void> {
	if (move && !ids.includes(move.feedId)) fail(400, "要移动的订阅不在排序列表中");
	const json = JSON.stringify(ids);
	const params: (string | number | null)[] = [json];
	if (move) params.push(move.feedId, move.categoryId);
	// One conditional statement rejects stale/incomplete orders without partially moving a group.
	const result = await db
		.prepare(`UPDATE ${table}
    SET sort_order = (SELECT CAST(key AS INTEGER) FROM json_each(?) WHERE value = ${table}.id)
    ${move ? ", category_id = CASE WHEN id = ? THEN ? ELSE category_id END" : ""}
    WHERE (SELECT COUNT(*) FROM ${table}) = ?
    AND NOT EXISTS (SELECT 1 FROM json_each(?) AS requested
      LEFT JOIN ${table} AS current ON current.id = requested.value WHERE current.id IS NULL)`)
		.bind(...params, ids.length, json)
		.run();
	if (result.meta.changes !== ids.length) fail(409, "订阅或分类已变化，请重新加载后再排序");
}

export async function dataStats(db: D1Database): Promise<Stats> {
	const result = await db
		.prepare(`SELECT COUNT(*) AS articles,
    COALESCE(SUM(1 - a.is_read), 0) AS unread, COALESCE(SUM(a.is_starred), 0) AS starred,
    COALESCE(SUM(a.is_later), 0) AS later,
    COALESCE(SUM(length(CAST(a.content AS BLOB)) + length(CAST(COALESCE(a.translated_content, '') AS BLOB))), 0) AS bytes,
    (SELECT COUNT(*) FROM feeds) AS feeds,
    (SELECT COUNT(*) FROM fetch_logs) AS logs
    FROM articles a`)
		.first<Stats>();
	if (!result) throw new Error("数据库统计查询失败");
	return result;
}
