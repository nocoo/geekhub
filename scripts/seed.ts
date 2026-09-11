import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { demoArticleContent, demoHost, demoSources, demoTitles } from "../src/worker/local";
import { verifyLocalBindings } from "./verify-test-bindings";

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

export async function seedSql(): Promise<string> {
	const statements = [
		"INSERT OR IGNORE INTO categories(id,name,color) VALUES ('engineering','技术与工程','green'),('design','设计与体验','blue'),('inspiration','独立与创造','amber');",
	];
	for (const [index, source] of demoSources.entries()) {
		statements.push(`INSERT OR IGNORE INTO feeds(id,category_id,title,url,site_url,description,status,last_fetched_at,next_fetch_at)
      VALUES (${quote(source.id)},${quote(source.category)},${quote(source.title)},${quote(`https://${demoHost}/rss/${source.id}`)},${quote(source.site)},${quote(source.description)},'success',${quote(new Date().toISOString())},${quote(new Date(Date.now() + 3600_000).toISOString())});`);
		for (const [i, title] of (demoTitles[index] ?? []).entries()) {
			const sourceId = `${source.id}-${i}`;
			const hash = await crypto.subtle.digest(
				"SHA-256",
				new TextEncoder().encode(`${source.id}\0${sourceId}`),
			);
			const id = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
			const content = demoArticleContent(title);
			statements.push(`INSERT OR IGNORE INTO articles(id,feed_id,source_id,title,url,author,published_at,content,description,is_read,is_starred,is_later)
        VALUES (${[id, source.id, sourceId, title, `https://${demoHost}/articles/${sourceId}`, source.title, new Date(Date.now() - (index * 25 + i * 240) * 60_000).toISOString(), content, index === 3 ? "在订阅、收藏与打开的标签之间，总有一个值得停下来思考的想法。给阅读留一点空间，给好奇心留一扇窗。" : "Somewhere between the feeds, the bookmarks, and the open tabs, there is an idea worth sitting with. A small invitation to slow down and follow that idea."].map(quote).join(",")},${i > 3 ? 1 : 0},${i === 2 ? 1 : 0},${i === 1 ? 1 : 0});`);
		}
		statements.push(
			`INSERT INTO fetch_logs(feed_id,feed_title,level,message,articles_added,duration_ms) VALUES (${quote(source.id)},${quote(source.title)},'success','本地阅读集已就绪',6,${120 + index * 43});`,
		);
	}
	return statements.join("\n");
}

export async function executeLocalSql(state: string, sql: string): Promise<unknown> {
	const filename = resolve(state, `query-${crypto.randomUUID()}.sql`);
	writeFileSync(filename, sql);
	const child = Bun.spawn(
		[
			"bun",
			"x",
			"wrangler",
			"d1",
			"execute",
			"geekhub-local",
			"--local",
			"--config",
			"wrangler.jsonc",
			"--env",
			"local",
			"--persist-to",
			state,
			"--file",
			filename,
			"--json",
		],
		{ stdout: "pipe", stderr: "pipe" },
	);
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	const { unlinkSync } = await import("node:fs");
	unlinkSync(filename);
	if (code) throw new Error(`Local SQLite command failed: ${stderr}`);
	return JSON.parse(stdout);
}

export async function assertMarker(state: string) {
	verifyLocalBindings(state);
	const result = await executeLocalSql(state, "SELECT value FROM _test_marker WHERE key = 'env';");
	if (!Array.isArray(result) || result[0]?.results?.[0]?.value !== "test")
		throw new Error("Refusing to seed/reset a database without _test_marker= test");
}

if (import.meta.main) {
	const state = ".wrangler/state";
	mkdirSync(state, { recursive: true });
	if (!existsSync(".dev.vars.local"))
		writeFileSync(
			".dev.vars.local",
			`AI_ENCRYPTION_KEY=${crypto.randomUUID()}${crypto.randomUUID()}\n`,
			{ mode: 0o600 },
		);
	const rows = await executeLocalSql(state, "SELECT COUNT(*) AS count FROM feeds;");
	if (Array.isArray(rows) && rows[0]?.results?.[0]?.count === 0) {
		await executeLocalSql(state, await seedSql());
		console.log("Local SQLite seeded. Start the reader with bun dev.");
	} else {
		console.log("Existing subscriptions retained. Start the reader with bun dev.");
	}
}
