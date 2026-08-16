# Eval findings — rebased 2026-08-15 (wave 50, task-w50-i)

Verified against `main`/HEAD `87cee8b9fec30d190f93156c99ddf7011b68bc92`
("scribe wave 50"), MEASURED_SHA `87cee8b9`, derived AT THIS TASK'S OWN
RUNTIME (DEC-069 wave-17/wave-37, DEC-358 rebase rule) by running, in
order: `git merge --no-edit main` (worktree cut directly from `main`'s
tip — reported "Already up to date"); `npx tsx scripts/ref-state.ts`;
`git for-each-ref --format='%(refname:short) %(objectname:short)'
refs/heads` (46 live branches) plus `git merge-base --is-ancestor <ref>
HEAD` for every one, run individually (never a `.git/refs/heads/*` glob,
never the `.git/packed-refs` `refs/heads/main` line). `ref-state`'s
receipt, verbatim: DEC-644 three-sha boundary — HEAD `87cee8b9`; newest
first-parent product-code-bearing sha `c6f5ab28ccf4c4a06096f95a460a66ad0be0687b`;
ancestors of HEAD: `main`, `manual-qa`, `task-custodian-w68-4`,
`task-w47-a`, `task-w47-g`, `task-w47-h`, `task-w48-a`, `task-w48-c`,
`task-w48-f`, `task-w50-e`, `task-w50-h`, `task-w50-i`, `task-w68-d`,
`task-w71-c`, `task-w71-d`, `task-w71-e`. NON-ancestors: `mail-rich-shape-fallback`,
`task-w17-i`, `task-w48-b`, `task-w48-d`, `task-w48-e`, `task-w48-g`,
`task-w49-a` through `-h`, `task-w50-a`, `task-w50-b`, `task-w50-c`,
`task-w50-d`, `task-w50-f`, `task-w50-g`, `task-w68-b`, `task-w68-c`,
`task-w68-e`, `task-w71-a`, `task-w72-a` through `-j`. **The pinned mandate
(`32921050`, wave 47/task-w47-h) is now confirmed an ancestor of HEAD** —
every wave-47 branch (`-a` through `-h`) landed since that pin; see the new
TIER 0 "Landed since the wave-47 boundary" subsection.

COMPACTION per DEC-358's rebase rule: the wave-47 header is REPLACED by
this one, not prepended (three waves stale: it predated wave 48's battery
sections and every wave-49 lane). No per-item citation is deleted, only
re-homed/compacted. Re-glob receipt (programmatic, this runtime): every
backtick-quoted file-path citation in this document (169 distinct paths)
was resolved against the working tree by exact path or, where a citation
uses a bare filename inside a list, by unique basename match; **all 169
resolved to a real file — zero false "exists" claims carried forward.**
No "does not exist" claim is currently carried in this document (the two
prior absence claims, `localhost:8799` and `TBD`, were themselves CLOSED
by wave-46/task-w46-f and are cited as closures, not re-asserted as
absences needing re-globbing).

**This wave's own addition — folding the wave-47/48 range in.** All seven
wave-45 CONFIRMED-DEFECT rows the wave-47 header carried as IN FLIGHT are
now CLOSED: every `task-w47-a`..`-g` owning branch is a confirmed ancestor
of this HEAD, and this task independently re-ran each item's falsifying
check against the live tree (not inherited) — see the new TIER 0
subsection below, which also folds in wave-48's three landed gate
sections (`0240` build+test+bundle, `0242` perf-smoke, `0244`
render-sweep) and reconciles `0240`'s two filed OPEN ITEMS against the
current tree. Wave 49's eight lanes and wave 50's non-scribe siblings are
NOT ancestors of this HEAD — named as OWNED-BUT-UNMERGED in IN FLIGHT
below, per this task's own boundary (a discharge status this lane did not
itself verify is never restated as closed).


## Structure of this document (decomposed, wave 52 — task-custodian-w52-5)

This file was a single 1022-line append-only log and a recurring merge-
conflict hotspot (four conflicts across waves). It is now an index; every
section that used to live inline here is its own file under
`docs/eval-findings/`, in reading order, so unrelated waves editing
different tiers no longer collide on the same file. No content moved
across a tier/section boundary and no line was deleted — this is a pure
split, verify against git history if a citation seems to have moved.

1. [`eval-findings/01-user-filed.md`](eval-findings/01-user-filed.md) — USER-FILED P1
2. [`eval-findings/02-standing-rules.md`](eval-findings/02-standing-rules.md) — Standing rules (still bind)
3. [`eval-findings/03-tier0-landed.md`](eval-findings/03-tier0-landed.md) — TIER 0: landed-since-boundary re-verifications
4. [`eval-findings/04-tier0-dismissed.md`](eval-findings/04-tier0-dismissed.md) — TIER 0 (continued): dismissed / stale / do-not-re-file
5. [`eval-findings/05-tier0-verification-render.md`](eval-findings/05-tier0-verification-render.md) — TIER 0 (continued): verification-log & render-sweep closures
6. [`eval-findings/06-in-flight.md`](eval-findings/06-in-flight.md) — IN FLIGHT: owned by a branch, do not re-file
7. [`eval-findings/07-tier1.md`](eval-findings/07-tier1.md) — TIER 1: open items
8. [`eval-findings/08-tier2.md`](eval-findings/08-tier2.md) — TIER 2: unverified, candidate for re-check
9. [`eval-findings/09-mobile-queue.md`](eval-findings/09-mobile-queue.md) — Mobile / phone queue

Any citation of the form `docs/eval-findings.md #N` or `docs/eval-findings.md
Section X` refers to content now living in one of the files above; the
mandate-item numbers and section letters embedded in the prose are
unchanged (grep `docs/eval-findings/*.md` for the item/section token).
