/**
 * Database availability flag for E2E tests.
 *
 * Tests that depend on a live Supabase instance read this flag and
 * skip themselves when the DB is unreachable (e.g. in CI without a
 * locally provisioned Supabase). The run-api-e2e.sh script probes
 * Supabase before launching tests and exports SUPABASE_AVAILABLE.
 *
 * When unset, defaults to "true" to preserve local-dev behavior where
 * the script already verified availability.
 */
export const DB_AVAILABLE =
  (process.env.SUPABASE_AVAILABLE ?? "true").toLowerCase() === "true";
