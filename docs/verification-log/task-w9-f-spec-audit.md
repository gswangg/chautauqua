# task-w9-f — spec-audit gate detail

DEC-176/177/178 rebound battery, spec-audit lane, log-only (no code
changes; this task appends only to `docs/verification-log.md` and this
file). Fresh worktree of `main`.

## STEP 1 — frozen sha S

DEC-178 defines S as "the 'merge task-w9-a' commit" per DEC-114
first-parent walk. `main`'s harness-closure lane at branch time actually
landed under the branch/commit name `task-w8-a` (`52dd2b2` "w8-a:
harness-closure lane — DEC-173/174/175 walkthrough fixes + authz
probes", merged at `38860f9` "merge task-w8-a") rather than a literally
named `task-w9-a` — a naming artifact of this wave's renumbering (per
the field guide's recurring "first-campaign sections reuse task-wN-*
names" pattern), not a functional discrepancy: `38860f9`'s content is
exactly DEC-178's described sole code-bearing lane (scripts/** only,
DEC-173/174/175). Sibling gate `task-w9-b` (`9dc26d6`, already on this
main history before this worktree was cut) independently derived and
used the same `S=38860f9` for its build+test gate, and the merged
`task-w8-c` walkthrough section already on `main`
(`docs/verification-log.md`, "## 2026-08-10 task-w8-c — walkthrough @
38860f9") ran its 6-module walkthrough against this same sha. Adopting
`S = 38860f9`, consistent with all sibling gates in this battery.

`git merge-base --is-ancestor 2dd2f33 38860f9` — exit 0, confirms
descent from the required DEC-129/139 base.

## STEP 2 — DEC-177/178 precondition greps (all present at S)

| Anchor | File | Present? |
|---|---|---|
| `DEC-167` | `src/domain/contacts.ts` | yes (1) |
| `ICS_ORGANIZER_EMAIL` | `src/mail/ics.ts` | yes (1) |
| `unknown track id` | `src/routes/api/forms.ts` | yes (1) |
| `anonymized === false` | `src/server/repo/files.ts` | yes (1) |
| `openDate` | `app/src/pages/review/PlanEditor.tsx` | yes (3) |
| `FORM_TASK_FIELD_SPECS` | `scripts/seed.ts` | yes (3) |
| `DEC-173` | `scripts/walkthrough/public.ts` | yes (1) |
| `DEC-173` | `scripts/walkthrough/speaker.ts` | yes (1) |
| `DEC-174` | `scripts/seed.ts` | yes (1) |
| `DEC-175` | `scripts/walkthrough/producer.ts` | yes (7) |
| `DEC-175` | `scripts/walkthrough/speaker.ts` | yes (9) |
| `DEC-175` | `scripts/walkthrough/review.ts` | yes (7) |

No miss — proceeding to the gate (not `RESULT: FAIL — precondition`).

## STEP 3 — delta scope, `git diff 64ec7de..38860f9 --stat`

43 files changed (1992 insertions, 280 deletions). Classified every
non-merge commit in `64ec7de..38860f9` by whether it touches anything
outside `docs/verification-log.md`, `docs/verification-log/*`,
`docs/eval-findings.md`, `field-guide/index.md`, `decisions/*.md`:

Code-bearing (all expected, none unexpected):
- `129a8e8` DEC-167 contact-merge full-profile (`src/domain/contacts.ts`,
  `src/server/repo/contacts.ts` + tests) — task-w6-a
- `e0a98a7` DEC-170 reviewer file scoping (`src/routes/files.ts`,
  `src/server/repo/files.ts` + test) — task-w6-c
- `29b6a78` DEC-169 forms track validation (`src/routes/api/forms.ts` +
  test) — task-w6-d
- `796215b` DEC-168 ICS METHOD/ORGANIZER/ATTENDEE (`src/mail/ics.ts`,
  `src/routes/comms.ts`, `src/routes/public/index.tsx` + tests) —
  task-w6-e
- `33d271d` DEC-171 review SPA wire-name fix (`app/src/pages/review/*` +
  render tests) — task-w6-b (pre-wave, folded in ahead of the w6 merges)
- `9f5adba` DEC-172 seed backing forms (`scripts/seed.ts`,
  `app/src/routeManifest.ts` + test) — task-w6-f
- `52dd2b2` DEC-173/174/175 harness closure (`scripts/seed.ts`,
  `scripts/walkthrough/{producer,public,review,speaker}.ts`) —
  task-w9-a's scripts/**-only closure lane (see STEP 1 naming note)

Bookkeeping/scribe (decisions/*.md, field-guide/index.md,
src/decisions.ts registry appends only — expected per DEC-002/012):
`7d18e7e` scribe wave 6, `466f45b` scribe wave 7, `5d3acae` scribe wave
8, `a8a4785` scribe wave 9.

Log-only (docs/verification-log* content only, previously-scheduled
wave-5 battery sections that happened to land in this sha range because
their branch tips postdate `64ec7de`): `f369590`/`979ce2b` task-w5-b,
`9a3ae89`/`6d956a7` task-w5-e, `599731e`/`409050f` task-w5-d, `6cf694b`/
`44b0b00` task-w5-c, `d53f926`/`fbea59e` task-w5-f, `96f0f42`/`5ee31ae`
task-w5-g (carried-forward triage-closure), and older `fa663f5`/
`20db90c` task-w4-g/task-w4-d entries whose tips also postdate
`64ec7de` in first-parent order. `docs/verification-log/
task-w5-b-build-test.md` is rewritten (not appended) by `f369590`, but
this is that task's own re-run of its own per-task detail file (a
docs/verification-log/task-w5-b-*.md re-run naturally supersedes its
own prior content); the append-only invariant (DEC-015) is about the
shared `docs/verification-log.md`, which only gained new `##` sections
in this range — confirmed no section in `docs/verification-log.md` was
edited or removed, only appended.

Confirmed: the only code-bearing changes in `64ec7de..38860f9` are the
six wave-6 fix lanes (task-w6-a..f, DEC-167..172) plus task-w9-a's
scripts/**-only closure (DEC-173/174/175). No unexpected code-bearing
change found — no open item from this step.

## STEP 4 — re-audit

- **README quickstart vs package.json vs SPEC §8**: README `## Quickstart`
  lists `npm i`, `npm run db:migrate`, `npm run seed`, `npm run dev`,
  matching SPEC.md §8's `npm i && npm run db:migrate && npm run seed &&
  npm run dev` verbatim (same four commands, same order) and matching
  `package.json`'s `scripts` block (`db:migrate`, `seed`, `dev` all
  present with those exact names). `npm test` and
  `npm run gate:render-sweep` in README also match `package.json`
  script names exactly. Conforms.
- **README evaluator credentials vs docs/fixtures/sample-data.json**:
  README's "For evaluators" table (organizer/speaker/speaker2/reviewer
  emails + passwords) is byte-for-byte identical to
  `docs/fixtures/sample-data.json`'s `email`/`password` fields (lines
  30-31, 36-37, 48-49, 56-57): `sbek-organizer@example.com` /
  `SbekTest!2027-org`, `sbek-speaker@example.com` / `SbekTest!2027-spk`,
  `sbek-speaker2@example.com` / `SbekTest!2027-spk2`,
  `sbek-reviewer@example.com` / `SbekTest!2027-rev`. Conforms.
- **`.github/workflows/ci.yml` jobs**: `build-and-test`, `perf-smoke`,
  `walkthrough` (DEC-063), `render-sweep` (DEC-166) all present as
  top-level jobs. Conforms.
- **SPEC §9 four invariants → tests**: all four in-tree at S and
  unchanged since (`git diff 38860f9..HEAD` on README.md/package.json/
  .github/workflows/ci.yml is empty, so this worktree's checkout of
  these files is identical to S):
  - close-date lock → `test/edit-lock.test.ts` (46 lines) +
    `test/submit-core.test.ts` (210 lines)
  - speaker isolation → `test/task-file-access.test.ts` (134 lines)
  - hidden-speaker exclusion → `test/headshot-gate.test.ts` (125 lines)
  - decision-never-auto-emails → `test/spec9-invariants.test.ts` (70
    lines)
  All five files exist and are non-trivial. Conforms.

## STEP 5 — DEC-167..172 regression coverage (all present, cited)

- **DEC-167** (contact-merge full-profile): `test/contacts.test.ts:139`
  `"fills phone/bio/headshotUrl from duplicate when primary is blank
  (DEC-167)"` and `:156` `"keeps primary's phone/bio/headshotUrl when
  both are populated (DEC-167)"`.
- **DEC-168** (ICS ORGANIZER/ATTENDEE + METHOD split with fail-loud
  guards): guard code at `src/mail/ics.ts:158-161` — `if (opts.method
  === "REQUEST" && !opts.attendee) throw ...` /
  `if (opts.method === "PUBLISH" && opts.attendee) throw ...` — exercised
  by `test/compose-ics.test.ts` (imports `ICS_ORGANIZER_EMAIL`, builds
  organizer/attendee options) and `test/mail.test.ts`.
- **DEC-169** (forms track validation): `test/forms-api.test.ts:229`
  `"rejects an unknown track id"`.
- **DEC-170** (reviewer file access plan-scoped, anonymized-plan
  exclusion): `test/reviewer-file-access.test.ts` — assigned vs.
  cross-track vs. anonymized-only-plan fixtures (lines 18-48) drive
  scoping assertions for `ASSIGNED_REVIEWER`.
- **DEC-171** (review SPA wire shapes / `openDate` handling): `app/src/
  pages/review/Review.render.test.tsx:8,39,56,150` (explicit NULL/typed
  `openDate` cases per DEC-146) and
  `app/src/pages/review/Scorecard.render.test.tsx:25`.
- **DEC-172** (form-kind backing forms): `test/seed.test.ts:292`
  `"gives every form-kind onboarding task a non-null form_id whose
  form's title matches and whose fields mirror FORM_TASK_FIELD_SPECS"`
  and `:328` (render-sweep manifest `TASK_ASSIGNMENT_ID` pinning).

No missing test found for any of DEC-167..172 — no open item from this
step.

## STEP 6 — build + test

- `npm run build` (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json &&
  vite build --config app/vite.config.ts`): PASS, 0 errors, vite build
  produced its usual asset set (131 modules transformed, entry
  `index-Dtj2KjKK.js` 180.16 kB / gzip 58.90 kB).
- `npm test --silent`: PASS. **151 test files / 1332 tests**, 0
  failures, 15.45s. Matches sibling `task-w9-b`'s independently-recorded
  count (151 files / 1332 tests) at the same S.

## Result

No genuine gap found in any step.

OPEN ITEMS: 0

RESULT: PASS
