-- Discard fabricated AI cache from earlier local development sessions.
-- Original articles, reading states and results from real models are retained.
UPDATE articles
SET summary = NULL, translated_title = NULL, translated_description = NULL,
    translated_content = NULL, ai_model = NULL
WHERE ai_model = 'local-mock';
