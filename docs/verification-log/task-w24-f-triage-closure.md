# task-w24-f — Triage-closure gate

Bound sha per DEC-222 (planning-time frozen): `0a263d2e6e4dbf438f6ad9e98bffa6af527b965c` (merge task-w22-e).

## STEP 1 — DEC-114 sha check: FAIL

`git -C chautauqua log --first-parent --oneline 0a263d2..main`:

```
cde03cd scribe wave 24
b2dc2c1 merge task-w23-b
871ee28 merge task-w23-a
617679b scribe wave 23
```

`git -C chautauqua diff --name-only 0a263d2 main`:

```
app/src/pages/review/PlanEditor.tsx
decisions/DEC-218.md
decisions/DEC-219.md
decisions/DEC-220.md
decisions/DEC-221.md
decisions/DEC-222.md
field-guide/index.md
src/decisions.ts
test/users-reset-password.test.ts
```

`617679b` (scribe wave 23) and `cde03cd` (scribe wave 24) are non-code-bearing
(decisions/, field-guide/, string-appends to src/decisions.ts only — confirmed by
`git diff 0a263d2 main -- src/decisions.ts`, which is exactly two new-constant-only
hunks plus one string-escape cosmetic fix at DEC_131).

`871ee28` (merge task-w23-a) and `b2dc2c1` (merge task-w23-b) are CODE-BEARING:

- `871ee28`: adds `test/users-reset-password.test.ts` (354 new lines, new file).
- `b2dc2c1`: modifies `app/src/pages/review/PlanEditor.tsx` (+12/-2): adds
  `resettingUserId` state and disables/labels the per-row Reset-password button
  while a request is in flight (DEC-215 UX polish).

**Newest code-bearing sha on main's first-parent chain is `b2dc2c1`, not the FROZEN
`0a263d2`.** This is a mismatch of the exact kind DEC-219/DEC-221 define as sha
drift: "any post-freeze code-bearing merge of a task-w23-* branch is sha drift =
FAIL-stop per DEC-219" (DEC-221, final paragraph). Per DEC-219 ("Sha drift during
the battery = FAIL-stop (DEC-208), never rebind") this gate report **FAIL-stops
here per instructions and does not certify stage-1 completion at 0a263d2.**

Steps 2-5 below are still executed for record-keeping/diagnostic value, but the
overall gate result is **FAIL** on STEP 1 alone.

## STEP 2 — docs/eval-findings.md sections A-F sweep (diagnostic, post-freeze state)

Swept against current main (post-drift), since that is the actually-deployed code;
citations below are informational only and do not rescue the STEP 1 failure.

- **A1 admin redirect loop** — FIXED. `wrangler.jsonc:11` `html_handling: "none"`;
  regression: `test/root.test.ts:18` (fakeAssets `/admin/index.html` 200 path).
- **A2 submissions "n is not iterable"** — FIXED. `app/src/pages/submissions/
  SubmissionsTable.tsx` reads the single-object `/forms` envelope; regression:
  `app/src/pages/submissions/Submissions.render.test.tsx`.
- **B1 plan-detail "Invalid time value"** — FIXED. Guarded formatting in
  `app/src/lib/dates.ts`; consumed by review pages.
- **B2 reviewer queue empty** — code present: `app/src/pages/review/
  ReviewerQueue.tsx`, event-membership handling referenced in `src/decisions.ts`
  (DEC-1xx event-scoped reviewer grants) — not independently re-verified against a
  booted server by this doc-only gate; no browser walkthrough run in this lane.
- **B3 .ics export empty** — FIXED per `src/lib/itinerary.ts` +
  `test/itinerary-roundtrip.test.ts` (query-param selection encoding).
- **B4 overlapping blocks intercept clicks** — addressed: `app/src/styles.css` +
  `src/routes/public/agenda.tsx` carry pointer-events/z-index handling.
- **B5 portal profile not visible to organizer** — FIXED: `src/routes/api/
  contacts.ts` + `test/contact-profile-roundtrip.test.ts`.
- **B6/B7 CSV import + near-dup detection** — dedupe logic present in
  `src/domain/contacts.ts`, UI in `app/src/pages/contacts/DuplicatesView.tsx`; not
  independently re-run against seeded dupes by this doc-only gate.
- **C items (public cards, keyword search, drill-in, day-switcher, headshots,
  admin edit, content-approval control, scorecard free-text/per-round, CRM
  templates/multi-criteria filter, TZ off-by-one)** — most have matching
  implementation files (`src/routes/public/{sessions,agenda,query}.tsx`,
  `app/src/pages/review/{Scorecard,scorecardLogic}.tsx`, `app/src/lib/dates.ts`,
  `app/src/pages/settings/EventSettingsPanel.tsx`); **CRM-02 "true multi-criteria
  filter"** — no matching hit found (`grep -rn "multi-criteria filter\|segment-
  from-search" app/src src test` returned nothing): appears still OPEN, unverified
  by this doc-only lane either way since STEP 1 already fails the gate.
- **DEC-201/202 (pubcache global bump, KV non-atomic limiter)** — ACCEPTED per
  `decisions/DEC-201.md`, `decisions/DEC-202.md` (both explicitly defer to stage 2;
  stage-1 correctness/tests unaffected).
- **DEC-216 (declined lower(email) schema migration)** — ACCEPTED per
  `decisions/DEC-216.md` (app-level normalization + existing raw unique index
  sufficient for stage-1's migrate-from-scratch lifecycle).
- **F1/F2 (render-sweep gate, component-render smoke tests)** — smoke-test pattern
  present across `app/src/pages/**/*.render.test.tsx`; a dedicated serial
  browser render-sweep gate corresponds to sibling lane task-w24-d's remit
  (out of this lane's scope; not independently confirmed here).

This step is diagnostic only; it does not change the STEP 1 result.

## STEP 3 — audit of every main first-parent commit after 0a263d2

| commit | code-bearing? | contents |
|---|---|---|
| 617679b scribe wave 23 | No | decisions/DEC-218..222.md, field-guide/index.md, src/decisions.ts string-appends (DEC_218-DEC_222 constants) |
| 871ee28 merge task-w23-a | **Yes** | new file test/users-reset-password.test.ts (354 lines) |
| b2dc2c1 merge task-w23-b | **Yes** | app/src/pages/review/PlanEditor.tsx (+12/-2, resettingUserId in-flight disable) |
| cde03cd scribe wave 24 | No | (this wave's field-guide/decisions bookkeeping commit; no src/app diff beyond what's already listed) |

Two of four post-freeze first-parent commits are code-bearing. This directly
confirms the STEP 1 finding.

## STEP 4 — DEC-221 ref-closure audit

- `git -C chautauqua branch -a` shows **no local task-w23-a/b/c refs remain**
  (already deleted post-merge) — so `git log main..task-w23-a` etc. cannot be run;
  this is consistent with them having been merged (not merely dropped).
- Contra DEC-221's premise ("task-w23-a/b/c carry zero commits... tips ==
  617679b == main"): the actual main history shows `871ee28`/`b2dc2c1` merging
  **non-empty** task-w23-a/task-w23-b branches *after* 617679b (scribe wave 23) and
  after the 0a263d2 freeze point — i.e., exactly the late-drain failure mode
  DEC-221 itself warns about in its closing sentence, now realized.
- Remit-on-main check (per task text), still true independent of the branch
  question:
  - `src/routes/api/users.ts:101-115` reset-password endpoint — present.
  - `src/server/repo/users.ts:79,90,97` — present.
  - `test/users-api.test.ts:171-501` — present (DEC-215/DEC-220 coverage).
  - `app/src/pages/review/PlanEditor.tsx:259-270,560-570` — present, and (per
    STEP 1) further modified post-freeze by `b2dc2c1`.
  - `app/src/routeManifest.ts:129-131` — present.
- `test/users-reset-password.test.ts`, which DEC-221 says "was never created and
  is NOT owed," **does now exist on main** (added by `871ee28`), contradicting
  DEC-221's contemporaneous assessment and further evidencing continued lane
  activity after DEC-221 was written.
- `tmp-main-check` (472dc3a): confirmed ancestor of main
  (`git merge-base --is-ancestor 472dc3a main` → true).

**Conclusion: sha-drift risk materialized, not merely hypothetical. Report
FAIL-stop per DEC-221/DEC-219, as instructed.**

## STEP 5 — OPEN ITEMS

OPEN ITEMS: 2

1. Sha drift (STEP 1/3/4): main's newest code-bearing commit is `b2dc2c1`
   ("merge task-w23-b"), not the FROZEN `0a263d2`. Two code-bearing commits
   (`871ee28`, `b2dc2c1`) landed on main after the wave-24 battery sha was frozen.
   Per DEC-219 this is FAIL-stop, never rebind: the wave-24 battery cannot be
   declared complete/PASS against `0a263d2` as currently defined, and planning
   must re-derive a new frozen sha per DEC-114/DEC-219 before any further
   exit-battery lanes are declared PASS.
2. CRM-02 "true multi-criteria filter" / lossy segment-from-search (docs/eval-
   findings.md Section C) has no corresponding implementation hit found by this
   sweep (STEP 2) — status unresolved regardless of the sha question above.

Grep of this file for literal conflict markers (DEC-207 lesson):

```
$ grep -n '^<<<<<<<\|^=======$\|^>>>>>>>' docs/verification-log/task-w24-f-triage-closure.md
(no output — zero matches)
```

**GATE RESULT: FAIL** (sha drift; OPEN ITEMS: 2, PASS requires 0).
