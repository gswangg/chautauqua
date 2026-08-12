# 2026-08-10 task-w19-e — triage-closure @ 8c7f479

Full detail for the `## 2026-08-10 task-w19-e — triage-closure @ 8c7f479` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

STEP 1 (DEC-114 sha derivation): worktree cut from `main` tip `9038b5c`
("scribe wave 19") — `git show --stat 9038b5c` touches only
`decisions/DEC-135.md`, `field-guide/index.md`, and a pure trailing
`export const DEC_135 = "..."` string-constant append to
`src/decisions.ts` (verified via `git show 9038b5c -- src/decisions.ts`)
— bookkeeping per DEC-114's exclusion set. Walking first-parent back,
`8c7f479` ("merge task-w18-c") is the newest code-bearing sha: `git show
--stat 8c7f479` touches `src/routes/public/submit.tsx` +
`test/submit-hidden-file-field.test.ts` (product code). `git
merge-base --is-ancestor 675219f 8c7f479` → **true** (DEC-129 satisfied).

STEP 2 (DEC-135 behavioral preflight of DEC-130..133, all four markers
confirmed present in-tree, not just void-import lines):
- DEC-130: `src/domain/schedule.ts:36` defines `findConflicts`, and
  `autoSchedule`'s incremental placement loop (comment at line 121-122)
  builds occupancy indexes instead of re-running `findConflicts` over
  the full trial set per candidate — marker present.
- DEC-131: `src/mail/ics.ts:39-47` `escapeText` normalizes `\r\n`->`\n`
  and lone `\r`->`\n` *before* backslash/`;`/`,`/`\n` escaping — marker
  present.
- DEC-132: `src/routes/public/submit.tsx:474-479` file-upload loop is
  gated `if (cleaned[field.id] !== "pending") continue;`, and
  `cleaned[field.id]` only reaches `"pending"` for fields that pass
  `isVisible` (line 415 skip-if-hidden) during validation — hidden
  fields never get uploaded/persisted — marker present.
- DEC-133: `src/server/repo/submissions/status.ts:207-210` computes
  `missing = requested.filter(id => !foundIdSet.has(id))` and throws
  `ApiError("invalid", ...)` naming the missing ids *before* the bulk
  status mutation — marker present.

All four markers present -> proceeding to full triage (no FAIL-and-stop).

STEP 3 sweep:
(a) `docs/eval-findings.md` re-read: "Round 1 ... fully dispositioned.
Zero open findings remain in this file." No open items.
    `docs/verification-log.md` sections citing a sha S with
    `git merge-base --is-ancestor 675219f S` true: all such sections
    (`task-w15-*`, `task-w16-*`, `task-w17-a`, `task-w17-b`) cite
    `675219f` exactly and end `OPEN ITEMS: 0` / `RESULT: PASS` — but
    per DEC-134 every `@ 675219f` gate section is now VOID (wave-18
    reopened code); they are cited here only as historical confirm
    chain, not as current evidence. DEC-129 homonym guard applied: the
    earlier `## task-w16-e — triage-closure @ 5692a6d` (line 294,
    first-campaign) and `## task-w4-e`/`task-w5-*`/`task-w7-*`/
    `task-w8-*`/`task-w11-*`/`task-w12-*`/`task-w13-*` sections all
    cite pre-`675219f` shas — excluded from consideration, no live
    directives found in any (all their own RESULT lines are PASS,
    already closed at the time).
(b) Commits `675219f..8c7f479` first-parent classified: `472dc3a`,
    `ef788c2`, `2280419` (w15 g/h/j), `067a5cc`, `3ef7403`, `cfab488`,
    `5916788`, `334dc4e`, `40c49f6`, `42db9f9` (w16 scribe+a-e),
    `36351c9`, `4a9a74f`, `cf8154c` (w17 scribe+a/b) — all bookkeeping
    (docs/decisions/field-guide/verification-log only, confirmed by
    prior sections' own stat output and independently spot-checked
    here). `7162750` (scribe wave 18) bookkeeping. `b5532df`
    (merge task-w18-b, ics.ts), `3627020` (merge task-w18-a,
    schedule.ts), `9f51825` (merge task-w18-d, status.ts), `8c7f479`
    (merge task-w18-c, submit.tsx) — all four code-bearing, matching
    DEC-130..133 fixes exactly, no other code-bearing commits found.
(c) Dedicated tests run directly in this worktree:
    `npx vitest run test/schedule.test.ts test/ics-crlf-escaping.test.ts
    test/status-bulk-full-match.test.ts test/submit-hidden-file-field.test.ts`
    (submit-visibility test name confirmed via `git show --stat
    8c7f479`) -> **4 files / 23 tests, ALL PASS**, 0 failures. Full
    build (`npm run build`) and full suite (`npm test --silent`) also
    run clean: **113 files / 1076 tests, ALL PASS**, 0 failures — no
    fixes required, log-only run per DEC-077/135.
(d) Reviewer concern re commit `db8bcdb` (DEC-121 "test patched to
    pass") re-confirmed CLOSED: `test/portal-edit-speaker-locked-route.
    test.ts:122-124` asserts `expect(call[1]).toBe("s1")`,
    `expect(call[2]).toBe("c1")`, and reads `cleaned` from `call[3]` —
    real positional-argument assertions against the 5-arg
    `saveSubmissionEdits` signature, not a stubbed/loosened check.
    Not reopened.
(e) DEC-127 six-marker spot check (spec-audit scope, no sibling
    `task-w19-*` build+test/walkthrough/perf-smoke/spec-audit section
    present yet on `main` at this sha — spot-verified directly, no
    live server needed): `src/routes/tasks.ts:235-236` (DEC-120
    cross-org contactIds guard), `src/server/repo/portal-edit.ts:
    120-125` (DEC-121 locked-field prefill-from-contact), `src/routes/
    comms.ts:30,303,337` (`requireFullMatch` DEC-122 full-set guard),
    `src/routes/review.ts:222-226` (DEC-123 criteria/scale
    immutability once evaluations exist), `src/forms/validate.ts:8`
    (`MAX_TEXT_LENGTH`, DEC-124), `scripts/perf-seed.ts:271-275`
    (`kind: "rating"` discriminant) — all six present, no drift from
    prior sections' evidence. No live-server spot-check was needed
    (build+test alone plus targeted tests fully covered the four
    review-lens defects); port 8883 not used.

No unresolved PRODUCT defects found. No merge-ordering races encountered
(this worktree's `main` tip already includes all four w18 merges).

OPEN ITEMS: 0

RESULT: PASS
