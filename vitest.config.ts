import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"cloudflare:workers": new URL("./tests/unit/cloudflare-runtime.ts", import.meta.url).pathname,
		},
	},
	test: {
		include: ["tests/unit/**/*.test.{ts,tsx}"],
		environment: "node",
		restoreMocks: true,
		unstubGlobals: true,
		coverage: {
			provider: "v8",
			include: ["src/shared/**/*.ts", "src/worker/**/*.ts", "src/web/lib/**/*.ts"],
			reporter: ["text", "json-summary", "html"],
			thresholds: { statements: 95, branches: 95, functions: 95, lines: 95 },
		},
	},
});
