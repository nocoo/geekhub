-- Add auto_translate flag to feeds table
ALTER TABLE feeds
ADD COLUMN auto_translate BOOLEAN DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN feeds.auto_translate IS 'Automatically translate articles for this feed';
