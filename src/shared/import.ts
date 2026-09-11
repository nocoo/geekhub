import { z } from "zod";
import { categoryInput, feedInput, publicUrl, resolveFeedUrl } from "./validation";

const records = z.array(z.record(z.string(), z.string()));
const tables = z.object({ blogs: records, categories: records, feeds: records });
const required = (row: Record<string, string>, field: string) =>
	z.string().trim().min(1).parse(row[field]);
const timestamp = (value: string | undefined) =>
	value ? new Date(value.replace(" ", "T").replace(/\+00$/, "Z")).toISOString() : null;

function unique(values: string[], label: string) {
	if (new Set(values).size !== values.length) throw new Error(`${label} 存在重复值，导入已停止`);
}

function usableRss(value: string | undefined): string {
	if (!value) return "";
	try {
		return publicUrl(value).href;
	} catch {
		return "";
	}
}

export function normalizeImport(input: unknown) {
	const raw = tables.parse(input);
	const categories = raw.categories.map((row) => ({
		id: required(row, "id"),
		...categoryInput.parse({
			name: row.name,
			color: row.color,
			icon: row.icon,
			sort_order: Number(row.sort_order || 0),
		}),
	}));
	unique(
		categories.map((item) => item.id),
		"分类 ID",
	);
	unique(
		categories.map((item) => item.name),
		"分类名称",
	);
	const feeds = raw.feeds.map((row) => {
		const value = feedInput.parse({
			title: row.title,
			url: row.url,
			category_id: row.category_id || null,
		});
		const resolved = resolveFeedUrl(value.url, "https://rsshub.app");
		if (value.category_id && !categories.some((item) => item.id === value.category_id))
			throw new Error(`订阅「${value.title}」的分类不存在`);
		return {
			id: required(row, "id"),
			...value,
			title: required(row, "title"),
			url: value.url.startsWith("rsshub://") ? value.url : resolved,
			description: row.description ?? "",
			refresh_minutes: z.coerce.number().int().min(15).max(1440).parse(row.fetch_interval_minutes),
			auto_translate: Number(z.enum(["true", "false"]).parse(row.auto_translate) === "true"),
			is_active: Number(z.enum(["true", "false"]).parse(row.is_active) === "true"),
			created_at: timestamp(row.created_at) ?? new Date().toISOString(),
		};
	});
	unique(
		feeds.map((item) => item.id),
		"订阅 ID",
	);
	unique(
		feeds.map((item) => item.url),
		"订阅地址",
	);
	const directory = raw.blogs.map((row) => {
		const tags = z.array(z.string()).parse(JSON.parse(row.tags || "[]"));
		const score = z
			.object({ overall: z.number().min(0).max(100).optional() })
			.passthrough()
			.parse(JSON.parse(row.score || "{}"));
		return {
			id: required(row, "id"),
			title: required(row, "name"),
			url: usableRss(row.feed),
			source_feed_url: row.feed ?? "",
			site_url: publicUrl(required(row, "url")).href,
			description: tags.join(" · "),
			category: tags[0] ?? "独立博客",
			tags: JSON.stringify(tags),
			score: JSON.stringify(score),
			last_updated: timestamp(row.last_updated),
			created_at: timestamp(row.created_at),
			updated_at: timestamp(row.updated_at),
		};
	});
	unique(
		directory.map((item) => item.id),
		"精选博客 ID",
	);
	return { categories, feeds, directory };
}

type SqlValue = string | number | null | undefined;
function literal(value: SqlValue) {
	if (value === null || value === undefined) return "NULL";
	return typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;
}

export function importSql(data: ReturnType<typeof normalizeImport>) {
	const statements: string[] = [];
	// Only remove the five built-in catalogue examples. Existing subscriptions and article states are retained.
	statements.push(
		"DELETE FROM directory WHERE (id='cloudflare' AND url='https://blog.cloudflare.com/rss/') OR (id='css-tricks' AND url='https://css-tricks.com/feed/') OR (id='fowler' AND url='https://martinfowler.com/feed.atom') OR (id='hn' AND url='https://hnrss.org/frontpage') OR (id='simon' AND url='https://simonwillison.net/atom/everything/');",
	);
	for (const [table, rows] of Object.entries(data)) {
		for (const row of rows) {
			const entries = Object.entries(row);
			const columns = entries.map(([column]) => column);
			statements.push(
				`INSERT INTO ${table} (${columns.join(",")}) VALUES (${entries.map(([, value]) => literal(value)).join(",")}) ON CONFLICT(id) DO UPDATE SET ${columns
					.filter((column) => column !== "id")
					.map((column) => `${column}=excluded.${column}`)
					.join(",")};`,
			);
		}
	}
	return statements.join("\n");
}
