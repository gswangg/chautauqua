## 2026-08-15 task-w27-g — TIER-1 fidelity re-check @ ceda66f2 [DIAGNOSTIC]

INVALIDATED BY: app/src/**, src/routes/**, docs/design/**

Walked all 15 clauses from `docs/eval-findings.md` TIER 1's
VERIFIED-OPEN-NOT-RECHECKED list against current `main` and the vendored
pack (`docs/design/*.dc.html`, `docs/design/README.md`,
`docs/design/DESIGN-RULINGS.md`), one quoted `path:line` from the tree and
one from the vendored side per clause. 10 CLOSED-AT-TIP (tree already
matches, or a binding `decisions/` amendment supersedes the original
clause — participation-panel-420, write-failed-banner, upload-reject-modal,
templates-grid-overlap, plan-editor-draft-footer, duplicated-results-head,
content-status-band-full-bleed, active-filter-ink-chip, add-track-tertiary,
saved-embed-anatomy), 4 UNQUOTABLE (no line in the vendored pack ever
stated the rule — speaker-detail-grid/theads, underlined-initials,
blue-avatars, eight-item-Settings-remainder — the last because its only
source, `fidelity-gate8/09-settings.md`, is a `chautauqua-research` file
not vendored anywhere in this tree, so DEC-976's "a claim without a quoted
line is a rumour" applies), 1 OPEN. Full per-clause citations:
`docs/verification-log/task-w27-g-fidelity-recheck-ceda66f2.md`.

Also recorded: the duplicated `data-label` phone-table CSS pattern
(`app/src/pages/comms/comms.css:997-1003` vs `:1036-1042`) is two
independent table classes that happen to share a hand-written technique,
not one shared vocabulary class with two callers — no divergence-risk
coupling exists between them (see detail doc for the quoted declarations).

OPEN ITEMS: 1 — "speakers toolbar right-cluster":
`docs/design/README.md:350` states the admin Speakers toolbar's right
cluster is a `[List | Grid]` view toggle;
`app/src/pages/speakers/GridFilters.tsx` renders only a search input and a
task-status select, and no view-mode toggle exists anywhere in
`app/src/pages/speakers/` (grep for "List | Grid"/"viewMode" returns
nothing). Not superseded, not satisfied — carries forward as a genuine
OPEN item, no longer VERIFIED-OPEN-NOT-RECHECKED.

RESULT: 10 CLOSED-AT-TIP, 4 UNQUOTABLE (deleted, not carried), 1 OPEN.
14 of the 15 stale clauses this task's brief listed are resolved off the
tier-1 open list this wave; only "speakers toolbar right-cluster" remains
a live gap for a future wave to own.

