## 2026-08-15 task-w50-b — J1-J12 persona walkthrough @ 87cee8b9

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

STEP 0 (DEC-069 w50, identical procedure to task-w50-a). `git merge
--no-edit main` inside the worktree reported "Already up to date" (worktree
was branched from `main` tip `87cee8b9` moments earlier). `npx tsx
scripts/ref-state.ts` receipt (verbatim):

```
DEC-644 three-sha boundary: HEAD `87cee8b9fec30d190f93156c99ddf7011b68bc92`;
newest first-parent product-code-bearing sha
`c6f5ab28ccf4c4a06096f95a460a66ad0be0687b`; every live ref (`main`,
`manual-qa`, `task-custodian-w68-4`, `task-w47-a`, `task-w47-g`,
`task-w47-h`, `task-w48-a`, `task-w48-c`, `task-w48-f`, `task-w49-f`,
`task-w49-g`, `task-w50-a`, `task-w50-b`, `task-w68-d`, `task-w71-c`,
`task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD via `git
merge-base --is-ancestor`. NON-ancestor refs (NOT confirmed via `git
merge-base --is-ancestor`): `mail-rich-shape-fallback`, `task-w17-i`,
`task-w48-b`, `task-w48-d`, `task-w48-e`, `task-w48-g`, `task-w49-a`,
`task-w49-b`, `task-w49-c`, `task-w49-d`, `task-w49-e`, `task-w49-h`,
`task-w68-b`, `task-w68-c`, `task-w68-e`, `task-w71-a`, `task-w72-a`,
`task-w72-b`, `task-w72-c`, `task-w72-d`, `task-w72-e`, `task-w72-f`,
`task-w72-g`, `task-w72-h`, `task-w72-i`, `task-w72-j`.
```

Individually re-checked `task-w49-a` via `git merge-base --is-ancestor
task-w49-a HEAD` on a 10-attempt ~30s-spaced bounded poll; the poll ran to
4 attempts (all `no`) before the shell tool's own 2-minute timeout cut the
loop short. `git merge main` re-run afterward still reported "Already up
to date" (no new commits landed on `main` during the poll window), so the
straggler set is unchanged from the receipt above. Per DEC-358 w49 this is
named rather than re-polled to exhaustion: `task-w49-a`, `task-w49-b`,
`task-w49-c`, `task-w49-d`, `task-w49-e`, `task-w49-h` remain non-ancestor
of `main`/HEAD at measurement time.

MEASURED_SHA = `87cee8b9` (`git rev-parse --short HEAD` after the last
sync; unchanged by the poll since no merge occurred).

Full detail: none (docs-only summary below is sufficient per the task
brief's "detail doc optional").

Ran the DEC-069 required section-2 six-area persona walkthrough inside one
acquisition of `/tmp/chq-test.lock` via `sh scripts/with-test-lock.sh sh -c
'./scratch-heavy.sh'` (the wrapper script, itself product-inert, ran and
was deleted before commit): `npm run build` (public/admin/ is gitignored,
so this runs first per DEC-268) -> `npm run db:migrate` -> `npm run seed`
-> `.dev.vars` created locally (gitignored, matching
`.dev.vars.example`: `DEV_MODE=1`, `PUBLIC_BASE_URL=http://localhost:8787`
— none existed in the worktree, and without it `wrangler.jsonc`'s
non-loopback `PUBLIC_BASE_URL` (`https://chautauqua.cc`) would not match
the loopback origin the walkthrough was pointed at, so the walkthrough's
own pre-flight would refuse the mismatch) -> `npx wrangler dev --port
8787` (backgrounded, held inside the same lock acquisition) -> polled
`http://localhost:8787/` until ready -> `npm run walkthrough -- --url
http://localhost:8787` -> server killed afterward, still inside the lock.
Single run, no retries.

Summary quoted verbatim (all six DEC-089/DEC-062 areas ran in fixed order
producer -> review -> speaker -> public -> data -> scale, per
scripts/walkthrough-lib.ts:15):

```
Summary:
  FAIL producer
  PASS review
  PASS speaker
  PASS public
  PASS data
  PASS scale

walkthrough FAILED
```

Per-area PASS/FAIL:
- producer: FAIL. Verbatim failure line: `FAILED: J1 open submit page has
  the submission form` / `expected the submission form once the window is
  open`, assertion at `scripts/walkthrough/producer.ts:350-353`. Root
  cause traced to `scripts/walkthrough/producer.ts:341-343`, which PATCHes
  the form's `openDate` to `Date.now() - 60_000` — a raw epoch-ms
  *instant* 60s in the past. Per `src/lib/submit-core.ts:28-34` and
  `src/lib/timezone.ts:103-121`, `openDate`/`closeDate` are DAY LABELS
  (UTC midnight of the intended calendar day), not instants:
  `dayLabelToYmd` extracts only the UTC calendar date from the given ms
  value and `dayLabelStartInstant` expands that date to event-local
  00:00. The seed event's timezone is `America/Los_Angeles`
  (`scripts/seed.ts:383`, UTC-7 in August). This walkthrough ran at
  `2026-08-16T01:19:28Z`: `Date.now() - 60_000` still falls on UTC day
  `2026-08-16`, so the derived openDate resolves to LA-local midnight of
  that day = `2026-08-16T07:00:00Z` — over 5.5 hours AFTER the actual
  `now` used for the `formWindowState` comparison, so the gate correctly
  (per its own DAY LABEL contract) still reads `not_yet_open`. This
  reproduces deterministically in the ~7-hour UTC window before LA
  midnight catches up to the current UTC day (roughly 00:00-07:00 UTC)
  and is silent for the rest of the day — the same clock/day-label
  mismatch class already adjudicated as a TEST DEFECT, NOT A PRODUCT
  REGRESSION for `test/spec9-invariants.test.ts:131` (DEC-522 w49 field
  guide finding), here reproduced in a second, previously-unfiled
  location (`scripts/walkthrough/producer.ts:342`). Per DEC-453/DEC-069
  w50 this frozen lane files, not fixes, and does not touch `scripts/`.
- review: PASS (`PASS review`, all 20 checks incl. DEC-175 existence-hiding
  and DEC-039 cross-org 404/403 pairs).
- speaker: PASS (`PASS speaker`).
- public: PASS (`PASS public`).
- data: PASS (`PASS data`).
- scale: PASS (`PASS scale`; `PASS step1`..`PASS step6` against 110 fresh
  contacts, bulk accept of 110 ids in 91ms, email-log unchanged, exactly-once
  re-accept, purge-refresh probe all held).

Named row — authenticated `GET /admin` SPA-shell assertion: ABSENT.
`scripts/walkthrough/producer.ts` contains exactly one `/admin` fetch,
at line 1065 (`const adminRes = await fetch(\`${BASE_URL}/admin\`, {
redirect: "manual" })`), asserted at line 1066 against the *anonymous*
302 (`DEC-175 unauthenticated GET /admin`). A repo-wide grep of
`scripts/walkthrough/*.ts` and `scripts/walkthrough.ts` for
`/admin`-adjacent SPA-shell assertions (`"/admin"`, `` /admin` ``, "SPA
shell", "Admin SPA", "bundle missing") found no second occurrence and no
authenticated-session GET of `/admin` anywhere in the walkthrough. `git
log --oneline --all -- scripts/walkthrough/producer.ts` shows no
wave-49 branch touching this file, so per DEC-358 w49 there is no existing
owner to name; this is filed here as a new gap rather than re-filed under
a nonexistent branch. docs/clarifications.md:26 calls the admin UI the
priority surface, so the walkthrough currently never renders it under an
authenticated session — a gate covering the priority surface only at the
anonymous-redirect layer.

RESULT: FAIL — producer area fails at product sha `87cee8b9` (test
defect in `scripts/walkthrough/producer.ts:342`, day-label/instant
mismatch, not a product regression; frozen wave per this task's brief,
docs/** only, no product or scripts/ edits made). All other five areas
pass.
OPEN ITEMS: 2
1. `scripts/walkthrough/producer.ts:342` feeds a raw instant
   (`Date.now() - 60_000`) as `openDate` where `formWindowState`
   (`src/lib/submit-core.ts:35`) requires a DAY LABEL — fails
   deterministically in the pre-LA-midnight UTC window (owner: wave-51
   lane; fix by passing a DAY-LABEL instant, e.g. UTC midnight of
   yesterday, matching the DEC-522 pattern already applied elsewhere).
2. No walkthrough module asserts that an authenticated `GET /admin`
   renders the SPA shell — only the anonymous 302 at
   `scripts/walkthrough/producer.ts:1065-1066` is covered (owner:
   wave-51 lane; no existing wave-49 branch claims this scope).
