import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.GEEKHUB_TEST_URL;
if (!baseURL || process.env.RESOURCE_ENV !== "test" || new URL(baseURL).hostname !== "127.0.0.1")
	throw new Error("Run Playwright through bun run test:l3; isolated local Worker required.");
export default defineConfig({
	testDir: "tests/browser",
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
	outputDir: "test-results/l3/browser",
	timeout: 30_000,
	use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
	projects: [
		{
			name: "desktop",
			use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
		},
		{ name: "mobile", use: { ...devices["Pixel 7"] } },
	],
});
