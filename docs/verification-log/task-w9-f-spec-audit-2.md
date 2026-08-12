# 2026-08-10 task-w9-f — spec-audit @ 38860f9

Full detail for the `## 2026-08-10 task-w9-f — spec-audit @ 38860f9` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

Wave-9 exit-gate battery (DEC-069/176/177/178 rebinding), spec-audit
lane, log-only (no code changes). Fresh worktree cut from `main` tip
`25e81f9` ("merge task-w8-c").

**S derivation**: DEC-178 names S "the 'merge task-w9-a' commit"; on
this main history the harness-closure lane actually landed under the
branch/commit name `task-w8-a` (`52dd2b2`/`38860f9`) rather than a
literally-named `task-w9-a` — a wave-renumbering naming artifact, not a
functional discrepancy (its content is exactly DEC-178's described
sole code-bearing lane: scripts/**-only, DEC-173/174/175). Sibling
gate `task-w9-b` independently derived and used this same
`S=38860f9`; the already-merged `task-w8-c` walkthrough section ran
its 6/6-module walkthrough against this same sha. Adopted `S=38860f9`
for consistency across the battery. `git merge-base --is-ancestor
2dd2f33 38860f9` — exit 0.

All twelve DEC-177/178 precondition greps present at S (six w6
anchors: DEC-167 in contacts.ts, ICS_ORGANIZER_EMAIL in ics.ts,
"unknown track id" in forms.ts, "anonymized === false" in files.ts,
openDate in PlanEditor.tsx, FORM_TASK_FIELD_SPECS in seed.ts; plus
closure anchors: DEC-173 in walkthrough/public.ts + speaker.ts, DEC-174
in seed.ts, DEC-175 in walkthrough/producer.ts + speaker.ts +
review.ts) — no miss, gate proceeds.

Delta scope `git diff 64ec7de..38860f9 --stat` (43 files, +1992/-280):
every non-merge commit in range classified; the only code-bearing
changes are the six wave-6 fix lanes (task-w6-a..f, DEC-167/168/169/
170/171/172) plus task-w9-a's scripts/**-only closure (DEC-173/174/
175, commit `52dd2b2`). Everything else in range is either scribe
bookkeeping (decisions/*.md, field-guide/index.md, src/decisions.ts
registry appends — task-w6/7/8/9 scribe commits) or wave-5 battery
verification-log entries whose branch tips postdate `64ec7de` in
first-parent order (task-w5-b/c/d/e/f/g, task-w4-d/g carried forward).
`docs/verification-log/task-w5-b-build-test.md` is rewritten by
`f369590`, but that is task-w5-b's own per-task detail file being
superseded by its own re-run — the shared `docs/verification-log.md`
itself only gained new sections in this range, no append-only (DEC-015)
violation. No unexpected code-bearing change found.

Re-audit: README quickstart (`npm i`/`db:migrate`/`seed`/`dev`) matches
`package.json` scripts and SPEC.md §8 verbatim; README's evaluator
credential table matches `docs/fixtures/sample-data.json`'s
email/password fields byte-for-byte (organizer/speaker/speaker2/
reviewer); `.github/workflows/ci.yml` still carries `build-and-test`,
`perf-smoke`, `walkthrough` (DEC-063), and `render-sweep` (DEC-166) as
top-level jobs; SPEC §9's four invariants each map to an existing,
non-trivial test file (close-date lock: test/edit-lock.test.ts +
test/submit-core.test.ts; speaker isolation: test/task-file-access.
test.ts; hidden-speaker exclusion: test/headshot-gate.test.ts;
decision-never-auto-emails: test/spec9-invariants.test.ts). These
files (README/package.json/ci.yml) are unchanged between S and this
worktree's HEAD (`git diff 38860f9..HEAD` on them is empty).

W6-fix regression coverage: all six of DEC-167..172 have an in-tree
test — DEC-167 test/contacts.test.ts:139,156; DEC-168 fail-loud
METHOD/ATTENDEE guards at src/mail/ics.ts:158-161 exercised by
test/compose-ics.test.ts + test/mail.test.ts; DEC-169 test/forms-api.
test.ts:229 "rejects an unknown track id"; DEC-170 test/reviewer-file-
access.test.ts (assigned/cross-track/anonymized-only fixtures); DEC-171
app/src/pages/review/Review.render.test.tsx (explicit null/typed
openDate cases) + Scorecard.render.test.tsx:25; DEC-172 test/seed.
test.ts:292,328 (FORM_TASK_FIELD_SPECS-backed form_id + render-sweep
TASK_ASSIGNMENT_ID pinning). No missing test found.

`npm run build`: PASS, 0 tsc errors, vite build clean (131 modules,
entry 180.16 kB / gzip 58.90 kB). `npm test --silent`: PASS, **151
test files / 1332 tests**, 0 failures, 15.45s — matches sibling
task-w9-b's independently-recorded count at the same S.

Full detail: `docs/verification-log/task-w9-f-spec-audit.md`.

OPEN ITEMS: 0

RESULT: PASS
