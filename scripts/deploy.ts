import { readFileSync } from "node:fs";
import { APP_VERSION } from "../src/shared/version";

const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--secrets-file" || !args[1]))
	throw new Error("Usage: bun run deploy [--secrets-file <production secrets JSON or .env>]");
if (
	process.env.CLOUDFLARE_ENV ||
	process.env.GEEKHUB_TEST_STATE ||
	process.env.RESOURCE_ENV === "test"
)
	throw new Error(
		"Deploy requires the production environment; local and test Workers must never be deployed",
	);
if (
	config.name !== "geekhub" ||
	config.vars.ENVIRONMENT !== "production" ||
	!config.vars.CF_ACCESS_AUD ||
	!config.d1_databases[0]?.database_id
)
	throw new Error("Complete the production Worker, Access and D1 configuration before deployment");

// Apply schema first so the new Worker never sees a missing table or column.
for (const command of [
	[
		"bun",
		"x",
		"wrangler",
		"d1",
		"migrations",
		"apply",
		"geekhub-db",
		"--remote",
		"--config",
		"wrangler.jsonc",
	],
	["bun", "run", "build"],
	["bun", "x", "wrangler", "deploy", "--tag", `v${APP_VERSION}`, ...args],
]) {
	const child = Bun.spawn(command, { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
	if (await child.exited) throw new Error(`Deployment stopped: ${command.join(" ")}`);
}
