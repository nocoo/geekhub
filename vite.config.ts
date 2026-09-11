import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { verifyLocalBindings } from "./scripts/verify-test-bindings.ts";

const testState = process.env.GEEKHUB_TEST_STATE;
if (testState) verifyLocalBindings(testState);

export default defineConfig({
	cacheDir: testState ? `${testState}/vite-cache` : "node_modules/.vite",
	plugins: [
		react(),
		tailwindcss(),
		cloudflare({
			viteEnvironment: { name: "worker" },
			persistState: { path: testState ?? ".wrangler/state" },
			remoteBindings: false,
			inspectorPort: false,
			config: testState
				? (config) => ({ vars: { ...config.vars, RESOURCE_ENV: "test" } })
				: undefined,
		}),
	],
	server: {
		host: "127.0.0.1",
		port: 7005,
		strictPort: true,
		allowedHosts: ["geekhub.dev.hexly.ai"],
		watch: {
			ignored: [
				"**/.wrangler/**",
				"**/coverage/**",
				"**/test-results/**",
				"**/playwright-report/**",
				"**/docs/evidence/**",
				"**/archieve/**",
			],
		},
	},
	build: { sourcemap: true },
});
