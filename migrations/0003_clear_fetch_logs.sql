-- New code uses an in-memory cache. Keep the empty table for the old Worker
-- during deployment; repeat this deletion after rollout to remove late writes.
DELETE FROM fetch_logs;
