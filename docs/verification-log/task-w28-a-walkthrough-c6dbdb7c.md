# task-w28-a — J1-J12 walkthrough @ c6dbdb7c (QUALIFYING)

Instrument-repair commit: `9bf312cf` (scripts/walkthrough/speaker.ts only,
this lane's worktree `task-w28-a`). Product sha measured: `c6dbdb7c`
(this worktree's branch point off `main`; `git diff --stat c6dbdb7c HEAD --
src app/src migrations package.json` is empty — the repair touched no
product-tree file, so the product sha the gate measures is unchanged from
the branch point).

## Instrument repair (Part 1)

`scripts/walkthrough/speaker.ts`'s DEC-244 deliverable-panel block
(previously :759-813) asserted `row.includes("version 2")` after a single
upload, justified by a comment claiming scripts/seed.ts's DEC-739 loop
pre-completes the ad hoc file_request assignment at version 1. That premise
is false: `adHocFileTaskTitle` is minted at runtime
(`` `Walkthrough ad hoc file task ${Date.now()}` ``, :719) and the task is
created + assigned within this same walkthrough run (:721-742) — no seed
loop ever touches it, so the single upload lands at version 1, not 2. This
reproduces the FAIL task-w27-c already recorded (`scripts/walkthrough/
speaker.ts:805`, same defect, product-stale since task-w26-f).

Rewrite (kept every prior passing assertion):
1. After the first upload, re-GET `/portal/tasks` and assert the version-1
   panel: `aria-label="Uploaded file"`, `walkthrough-bio-photo.jpg`,
   `version 1`, the `href="/portal/tasks/<id>/file"` link, `>Replace
   file<`, `<section aria-label="Comments">`, and a
   `<section aria-label="Version history">` with exactly one
   `chq-portal-version-num">v1<` row carrying the `chq-portal-flag-done`
   `Current` marker.
2. POST a second multipart upload to the same
   `/portal/tasks/${bioAssignmentId}/upload` endpoint (the panel's own
   Replace form target) with filename `walkthrough-bio-photo-v2.jpg`, same
   `chq_csrf` form field, same optional scraped `submissionId`; assert 302.
3. Re-GET `/portal/tasks` and assert the version-2 panel:
   `walkthrough-bio-photo-v2.jpg`, `version 2`, and a Version-history
   section listing both `v1` and `v2` rows with `Current` on the v2 row
   only.

The stale DEC-739 justification comment was deleted outright and replaced
with a comment citing the DEC-244 wave-28 amendment and explaining the lane
now creates both versions itself.

No file under `src/`, `app/src/`, `migrations/`, or `package.json` was
touched. No file under `scripts/` other than
`scripts/walkthrough/speaker.ts` was touched.

## Targeted tests (before the gate run)

- `npx tsc --noEmit` — clean, no output.
- `npx vitest run test/walkthrough-lib.test.ts
  test/walkthrough-stats-contract.test.ts` — 2 files, 51 tests, all PASS.
- `npm run build` — clean, worker + app bundles built.

## Environment setup

- `npx tsx scripts/ensure-dev-vars.ts` created `.dev.vars` from the
  example (DEC-296 default `PUBLIC_BASE_URL=http://localhost:8787`).
- Edited the gitignored `.dev.vars` to
  `PUBLIC_BASE_URL=http://localhost:8891` (this lane's reserved port) per
  the w26-f/w27-c lesson: a mismatched base URL makes the reset-link check
  refuse as off-origin — env, not product.
- `npm run predev` (tsx ensure-dev-vars + vite build) — clean.
- `npm run db:migrate` — all 40 migrations (0001-0039) applied clean.
- `npm run seed` — clean, 35 R2 objects seeded.
- `npx wrangler dev --port 8891` in background; `GET /` returned 200 on
  the first poll.

## Gate runs (Part 2) — two clean runs, both PASS

Run 1 (fresh migrate+seed, one walkthrough invocation):

  PASS producer  PASS review  PASS speaker  PASS public  PASS data  PASS scale

The three new/repaired speaker checks, verbatim from the log:

```
ok   GET /portal/tasks shows the DEC-244 deliverable panel at version 1 for the completed 'Walkthrough ad hoc file task 1786814782648' assignment
ok   replace-upload a second file onto the same file_request assignment (assert 302)
ok   GET /portal/tasks shows the DEC-244 deliverable panel at version 2 for the completed 'Walkthrough ad hoc file task 1786814782648' assignment
```

131 `ok` lines total, zero `FAIL` lines, final line `walkthrough OK`.

Run 2 (re-seeded once per task instructions, second walkthrough
invocation against the same server, fresh seed state):

  PASS producer  PASS review  PASS speaker  PASS public  PASS data  PASS scale

131 `ok` lines total, zero `FAIL` lines, final line `walkthrough OK`.

Both run transcripts captured in this worktree at
`.walkthrough-run1.log` / `.walkthrough-run2.log` (gitignored working
files, not committed — the counts and matched lines above are the
citable evidence).

## Per-area summary (both runs identical)

| Area     | Result |
|----------|--------|
| producer | PASS   |
| review   | PASS   |
| speaker  | PASS (repaired DEC-244 version-1/version-2 checks both green) |
| public   | PASS   |
| data     | PASS   |
| scale    | PASS   |

RESULT: PASS — both clean runs of the J1-J12 walkthrough pass all six
areas at product sha c6dbdb7c, including the three repaired DEC-244
deliverable-panel checks (version 1 panel, replace-upload, version 2
panel) that previously failed as recorded in task-w26-f/task-w27-c.

OPEN ITEMS: 0
