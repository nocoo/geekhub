ALTER TABLE feeds ADD COLUMN auto_translate_content INTEGER NOT NULL DEFAULT 0
  CHECK (auto_translate_content IN (0, 1));
