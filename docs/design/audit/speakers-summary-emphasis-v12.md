# Speakers head-summary emphasis (DEC-730 wave-33 fix)

Tier 0 fix. Task w33-e. Verified against `main` at wave 33.

## What the pack draws

`docs/design/Chautauqua Speakers.dc.html`:

- **:57** (desktop landing, rest state) — `12 accepted · <strong style="color:#1B1D17">3 overdue</strong>`. The resting clause ("12 accepted") carries no weight. The whole exception clause — numeral AND noun together — is `<strong>` and inked (`#1B1D17`).
- **:140** (390 landing, rest state) — same shape, same weight split.
- **:264** (Roster · 390, caption "Add or import a speaker") — `12 accepted · 2 not claimed`, entirely plain. No `<strong>` at all.
- **:469** (caption at :442 "Speakers · search found nothing", "Filtered · names the excluding facet") — `12 accepted · 3 overdue`, entirely plain. The page has already spent its emphasis budget on the `EmptyState` heading.
- **:563** (caption at :549 "Speakers · a write failed", "Optimistic rollback, said out loud") — `12 accepted · 3 overdue`, entirely plain. The page has already spent its emphasis on the rollback banner's own bold title (`Marcus Okafor's headshot task did not change`).

## The two registers this fix draws

1. **Grid/onboarding-landing register** (`OnboardingGrid.tsx`, head summary only, `:1009-1030`-ish): resting clause plain, exception clause (`{overdue} overdue`) wrapped in ONE `<strong className="chq-speakers-summary-exception">`. The class — never the `<strong>` element — is suppressed when the page has already spent its emphasis: a filtered zero-row result (`:469`) or a mounted `pendingFailure` rollback banner (`:563`). Both conditions are read off state `OnboardingGrid` already holds (`gridRead.data`, `hasActiveNarrowing(filters)`, `visibleRows.length`, `pendingFailure`) — no new state, no new fetch.
2. **Roster drill-in register** (`RosterPanel.tsx:474`): no emphasis at all, matching `:264`.

## What the tree did before this fix

- `OnboardingGrid.tsx:1017` (pre-fix): `<strong>{counts?.speakers ?? 0}</strong> accepted &middot; <strong>{counts?.overdue ?? 0}</strong> overdue` — weight on the RESTING accepted numeral, and weight on the overdue NUMERAL only (not the noun) — the inverse of the pack's rule on both axes.
- `RosterPanel.tsx:474` (pre-fix): both clauses `<strong>`-wrapped; the frame draws neither bold.
- `.chq-summary` (`app/src/styles.css:433`) is muted 13px — the pre-fix `<strong>` was bold-but-muted, never reaching the frame's ink colour either.

## What this fix builds

- `OnboardingGrid.tsx` head summary (`:1009-1030`-ish only): plain resting clause; ONE `<strong>` node, always mounted, wrapping `{overdue} overdue`; its `chq-speakers-summary-exception` class conditional on `!summaryExceptionSuppressed`.
- `RosterPanel.tsx:474`: both `<strong>` wrappers dropped.
- `app/src/pages/speakers/speakers.css`: `.chq-speakers-summary-exception { color: var(--chq-ink); }` declared at TOP LEVEL (not inside a phone `@media` block) — `:57` is a desktop frame, so the mandate's phone-only carve-out does not apply here; a phone-only rule would leave the desktop landing frame wrong. `var(--chq-ink)` is `#1b1d17`, the same value the frame's inline `color:#1B1D17` names (DEC-383: no colour literal). This is the ONE desktop-affecting rule in this commit.

## Contention

- `v12m-w31-a` (unmerged, 1 commit ahead of `main` at time of writing) adds `app/src/pages/speakers/Speakers.frame390.render.test.tsx`, which verbatim-cites frame line 140 at its own `:145` and asserts `textContent` only — unaffected by this fix (textContent is unchanged: `"12 accepted · 3 overdue"`).
- `v12m-w25-e` touches `OnboardingGrid.tsx:658` (`optimisticOverride`) — a different region of the same file; this fix does not touch it.

## Desktop pins re-verified (textContent-only, unaffected)

- `app/src/pages/Speakers.desktop-frame-verdicts.render.test.tsx:129-130`
- `app/src/pages/Speakers.frame-verdicts.render.test.tsx:161-163`
- `app/src/pages/speakers/OnboardingGrid.render.test.tsx:2174`
- `app/src/pages/speakers/OnboardingGrid.filteredEmpty.w5t.render.test.tsx`
