ALTER TABLE feeds ADD COLUMN auto_fetch_content INTEGER NOT NULL DEFAULT 0
  CHECK (auto_fetch_content IN (0, 1));
