import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"cloudflare:workers": new URL("./tests/unit/cloudflare-runtime.ts", import.meta.url).pathname,
		},
	},
	test: {
		allowOnly: false,
		passWithNoTests: false,
		include: ["tests/unit/**/*.test.{ts,tsx}"],
		environment: "node",
		restoreMocks: true,
		unstubGlobals: true,
		coverage: {
			provider: "v8",
			include: ["src/shared/**/*.ts", "src/worker/**/*.ts", "src/web/lib/**/*.ts"],
			reporter: ["text", "json-summary", "html"],
			thresholds: { statements: 90, lines: 90, functions: 90, branches: 85 },
		},
	},
});
