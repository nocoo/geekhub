/**
 * E2E Setup — Constants and preload configuration.
 *
 * Does NOT start any servers. Server lifecycle is managed by
 * scripts/run-api-e2e.sh exclusively.
 */

/** Base URL of the Next.js dev server running for E2E */
export const BASE_URL =
  process.env.E2E_BASE_URL ?? "http://127.0.0.1:13000";

/** Base URL of the mock server for external dependencies */
export const MOCK_URL =
  process.env.MOCK_SERVER_URL ?? "http://127.0.0.1:14000";

/** AI settings pointing to mock OpenAI */
export const MOCK_AI_SETTINGS = {
  enabled: true,
  provider: "openai",
  apiKey: "test-key-not-real",
  baseUrl: `${MOCK_URL}/v1`,
  model: "gpt-4o-mini",
} as const;
