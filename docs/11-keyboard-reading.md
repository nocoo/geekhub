# Keyboard reading position

J/K (and list-focused arrow keys) place the selected row's center at 38.2% of the
visible article list, leaving 61.8% below for upcoming articles. Native smooth
scrolling retargets on repeated navigation; the target is clamped at the beginning
and end of the list. Reduced-motion preferences use immediate positioning.

Only keyboard navigation uses this alignment. Mouse selection, history restoration
and background insertion retain their existing behavior. Hidden mobile lists do
not receive focus or scroll commands. Anchor maintenance avoids assigning an
unchanged scroll offset, which would cancel a running smooth scroll when read
status updates arrive.

Browser coverage exercises rapid J navigation, reverse K navigation, intermediate
animation positions, reduced motion, both list boundaries and mobile reading.
Existing history and background insertion flows remain regression checks.

Validation (2026-09-20): `bun run quality` passed typecheck, Biome, 187 unit tests,
108 isolated HTTP checks, 50 desktop/mobile browser flows, gitleaks and OSV.
Coverage: statements 99.72%, branches 97.93%, functions 100%, lines 99.92%.
The existing Vite bundle-size advisory remains. No production deployment.

The keyboard test creates and cleans up its own category and subscriptions so
reading every row does not consume other tests' unread fixtures. Manual validation
at `https://geekhub.dev.hexly.ai` measured a selected center ratio of 0.3814 with
keyboard focus retained. Evidence: [quality log](evidence/keyboard-reading/quality.log),
[manual measurement](evidence/keyboard-reading/manual.log) and
[browser screenshot](evidence/keyboard-reading/golden-position.png).
