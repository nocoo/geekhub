# Feed reading automation

Subscriptions can automatically fetch the full article when opened. The option
defaults off and is persisted as `feeds.auto_fetch_content` by migration
`0006_feed_auto_fetch_content.sql`. Apply this migration before deploying dependent
code. Local previews use the migrated local database; no production deployment is
part of this change.

The reading flow runs extraction before full translation. Extraction does not
require AI configuration. Successful extraction replaces the RSS body and clears
old summaries/translations; translation then runs against the saved full body.
Cached full articles and translations are reused. Extraction failures preserve
the existing body, block automatic translation and offer the existing inline
manual retry. Automatic attempts are limited to one per article per reader
session to avoid retry loops. Late results update the originating article's cache
without replacing the currently selected article.

Successful extraction also clears the translation attempt guard. Enabling
extraction after an earlier translation therefore regenerates the invalidated
translation even when the fetched body happens to match the RSS body exactly.

Automatic extraction uses the existing `/api/articles/:id/full` endpoint with
`{ "automatic": true }`; requests without a body remain supported. Activities are
recorded in the existing extraction category without a toast.

Add/edit subscription forms share four accessible switch rows: title/description
translation, full extraction, full translation, and inclusion in global refresh.
Each has a label and associated description, aligned controls, and wrapping copy.

Validation covers persisted defaults and updates, ordered extraction/translation,
failure/manual retry, navigation during requests, cache reuse, activity logs,
desktop/mobile layout, and accessible names/descriptions.

Final validation (2026-09-20): `bun run quality` passed typecheck, Biome, 191 unit
tests, 109 isolated HTTP checks, 52 desktop/mobile browser flows, gitleaks and OSV.
Coverage: statements 99.72%, branches 97.97%, functions 100%, lines 99.92%.
The existing Vite bundle-size advisory remains. Manual HTTPS checks at 1440,
390 and 320 px found no overflow; every switch measured 44 px and aligned right.
Local migration `0006` applied successfully; production remains unchanged.

Evidence: [quality log](evidence/feed-automation/quality.log),
[manual measurements](evidence/feed-automation/manual.log),
[desktop](evidence/feed-automation/desktop.png),
[mobile](evidence/feed-automation/mobile.png),
[320 px](evidence/feed-automation/narrow-320.png).
