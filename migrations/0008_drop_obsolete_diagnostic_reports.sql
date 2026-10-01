DELETE FROM feed_diagnostics
WHERE report IS NOT NULL AND (
  json_type(report, '$.feed.contentEntries') IS NULL
  OR EXISTS (
    SELECT 1 FROM json_each(report, '$.candidates')
    WHERE json_type(value, '$.inspection.contentEntries') IS NULL
  )
);
