import { mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { assertMarker, executeLocalSql, seedSql } from "./seed";
import { verifyLocalBindings } from "./verify-test-bindings";

const tier = process.argv[2];
if (tier !== "l2" && tier !== "l3") throw new Error("Use run-tests.ts l2|l3");
const port = tier === "l2" ? 17005 : 27005;
const base = `http://127.0.0.1:${port}`;
try {
	await fetch(`${base}/api/live`, { signal: AbortSignal.timeout(500) });
	throw new Error(`Test port ${port} is already in use`);
} catch (error) {
	if (error instanceof Error && error.message.includes("already in use")) throw error;
}
mkdirSync(".wrangler/tests", { recursive: true });
mkdirSync(`test-results/${tier}`, { recursive: true });
const state = mkdtempSync(resolve(".wrangler/tests", `${tier}-`));
process.env.CLOUDFLARE_ENV = "local";
verifyLocalBindings(state);
const env: Record<string, string | undefined> = {
	...process.env,
	CLOUDFLARE_ENV: "local",
	GEEKHUB_TEST_STATE: state,
	GEEKHUB_TEST_URL: base,
	RESOURCE_ENV: "test",
};
delete env.CLOUDFLARE_API_TOKEN;
delete env.CLOUDFLARE_API_KEY;
delete env.CLOUDFLARE_ACCOUNT_ID;
delete env.NO_COLOR;
delete env.FORCE_COLOR;
let server: ReturnType<typeof Bun.spawn> | undefined;
let marked = false;
try {
	for (const file of readdirSync("migrations")
		.filter((file) => file.endsWith(".sql"))
		.sort())
		await executeLocalSql(state, readFileSync(`migrations/${file}`, "utf8"));
	await executeLocalSql(
		state,
		"CREATE TABLE _test_marker(key TEXT PRIMARY KEY, value TEXT); INSERT INTO _test_marker VALUES ('env','test');",
	);
	marked = true;
	await assertMarker(state);
	await executeLocalSql(state, await seedSql());
	const log = openSync(`test-results/${tier}/server.log`, "w");
	server = Bun.spawn(
		["node", "node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port)],
		{ env, stdout: log, stderr: log },
	);
	const started = Date.now();
	while (true) {
		if (server.exitCode !== null)
			throw new Error(readFileSync(`test-results/${tier}/server.log`, "utf8"));
		try {
			const response = await fetch(`${base}/api/session`, { signal: AbortSignal.timeout(1000) });
			const session = (await response.json()) as { local?: boolean };
			if (response.ok && session.local === true) break;
		} catch {
			/* Wait for this process's local Worker and migration to become ready. */
		}
		if (Date.now() - started > 30_000)
			throw new Error(`Local Worker did not become ready. See test-results/${tier}/server.log`);
		await Bun.sleep(200);
	}
	console.log(`${tier.toUpperCase()}: local Worker at ${base}, isolated SQLite at ${state}`);
	const test = Bun.spawn(
		tier === "l2" ? ["bun", "tests/http/reader.ts"] : ["bun", "x", "playwright", "test"],
		{ env, stdout: "inherit", stderr: "inherit" },
	);
	const code = await test.exited;
	if (code) throw new Error(`${tier.toUpperCase()} failed with exit ${code}`);
} finally {
	if (server) {
		server.kill("SIGTERM");
		await Promise.race([server.exited, Bun.sleep(5000)]);
		if (server.exitCode === null) {
			server.kill("SIGKILL");
			await server.exited;
		}
	}
	if (marked) {
		await assertMarker(state);
		rmSync(state, { recursive: true });
	}
}
