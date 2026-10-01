DROP TABLE fetch_logs;
DROP INDEX feeds_due;
ALTER TABLE feeds DROP COLUMN refresh_minutes;
ALTER TABLE feeds DROP COLUMN next_fetch_at;
ALTER TABLE feeds DROP COLUMN failure_count;
