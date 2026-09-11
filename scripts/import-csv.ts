import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { importSql, normalizeImport } from "../src/shared/import";
import { executeLocalSql } from "./seed";

const args = process.argv.slice(2);
const directory = resolve(args.find((arg) => !arg.startsWith("--")) ?? ".");
const remote = args.includes("--remote");
const checkOnly = args.includes("--check");
if (
	args.some((arg) => arg.startsWith("--") && !["--local", "--remote", "--check"].includes(arg)) ||
	(remote && args.includes("--local"))
)
	throw new Error("Usage: bun run db:import <CSV directory> [--local|--remote] [--check]");
if (process.env.GEEKHUB_TEST_STATE || process.env.RESOURCE_ENV === "test")
	throw new Error("Use the isolated test harness to import test fixtures");

// Python's standard CSV parser handles quoted newlines, UTF-8 BOMs and embedded quotes.
const parser = Bun.spawn(
	[
		"python3",
		"-c",
		`
import csv, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
tables = {}
for table in ("blogs", "categories", "feeds"):
    with (root / (table + "_rows.csv")).open(encoding="utf-8-sig", newline="") as source:
        tables[table] = list(csv.DictReader(source))
print(json.dumps(tables, ensure_ascii=False))
`,
		directory,
	],
	{ stdout: "pipe", stderr: "pipe" },
);
const [stdout, stderr, parsed] = await Promise.all([
	new Response(parser.stdout).text(),
	new Response(parser.stderr).text(),
	parser.exited,
]);
if (parsed) throw new Error(stderr);
const data = normalizeImport(JSON.parse(stdout));
const sources = Object.fromEntries(
	["blogs", "categories", "feeds"].map((table) => {
		const filename = `${table}_rows.csv`;
		return [
			filename,
			createHash("sha256")
				.update(readFileSync(resolve(directory, filename)))
				.digest("hex"),
		];
	}),
);
const summary = {
	target: remote ? "production D1 / geekhub-db" : "local Wrangler SQLite / geekhub-local",
	categories: data.categories.length,
	feeds: data.feeds.length,
	directory: data.directory.length,
	withoutRss: data.directory.filter((row) => !row.url).length,
	sources,
};
console.log(JSON.stringify(summary, null, 2));
if (!checkOnly) {
	const folder = resolve(".wrangler/imports", new Date().toISOString().replaceAll(":", "-"));
	mkdirSync(folder, { recursive: true });
	const sql = importSql(data);
	const filename = resolve(folder, "import.sql");
	writeFileSync(filename, sql, { mode: 0o600 });
	writeFileSync(resolve(folder, "manifest.json"), JSON.stringify(summary, null, 2));
	let result: unknown;
	if (remote) {
		if (process.env.CLOUDFLARE_ENV)
			throw new Error("Remote import requires the production Wrangler configuration");
		const child = Bun.spawn(
			[
				"bun",
				"x",
				"wrangler",
				"d1",
				"execute",
				"geekhub-db",
				"--config",
				"wrangler.jsonc",
				"--remote",
				"--file",
				filename,
				"--json",
				"--yes",
			],
			{ stdout: "pipe", stderr: "pipe" },
		);
		const [out, error, code] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);
		if (code) throw new Error(error || out);
		// Wrangler's remote file importer writes upload progress even with --json.
		result = { exitCode: code, output: out };
	} else {
		mkdirSync(".wrangler/state", { recursive: true });
		result = await executeLocalSql(".wrangler/state", sql);
	}
	writeFileSync(resolve(folder, "result.json"), JSON.stringify(result, null, 2));
	console.log(`Imported successfully. Manifest: ${folder}/manifest.json`);
}
