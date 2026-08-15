## 2026-08-15 task-w40-b — walkthrough @ 14db7b30

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

DEC-644 three-sha boundary (STEP 0, DEC-069 w40): `git merge --no-edit main`
reported "Already up to date" (HEAD `14db7b30` = tip of `main` = "scribe
wave 40"). `npm run ref-state` confirmed every live ref (`main`,
`manual-qa`, `task-custodian-w68-4`, `task-w39-e`, `task-w40-a`,
`task-w40-b`, `task-w40-c`, `task-w68-d`, `task-w71-c`, `task-w71-d`,
`task-w71-e`) an ancestor of HEAD via `git merge-base --is-ancestor`;
newest first-parent product-code-bearing sha `ed5c679e`. The only local
`task-w39-*` ref is `task-w39-e` (`cc77ed76`), separately confirmed an
ancestor of HEAD via `git merge-base --is-ancestor cc77ed76... HEAD` ->
`ANCESTOR_OK`. No non-ancestor `task-w39-*` refs remained, so no
re-merge/re-check loop was needed. MEASURED_SHA = `14db7b30` (HEAD before
this task's own commit).

Full detail: docs/verification-log/task-w40-b-walkthrough-14db7b30.md

Ran the DEC-069 required section-2 persona walkthrough inside one
acquisition of the default `/tmp/chq-test.lock` (DEC-644): `db:migrate` ->
`seed` -> `predev` -> set `PUBLIC_BASE_URL=http://localhost:8811` in the
gitignored `.dev.vars` (per scripts/walkthrough.ts's w37-d pre-flight,
precedented local config, not a product edit) -> `wrangler dev --port
8811 --var PUBLIC_BASE_URL:http://localhost:8811` -> polled
`/login` until ready -> `npm run walkthrough -- --url http://localhost:8811`
-> killed the server. The lock was contended by concurrent wave-40 lanes
(`task-w40-c`, `task-w40-d` build/bundle/perf jobs) at acquisition time;
waited for it rather than stealing it. Single run, no retries needed —
`.dev.vars`'s `PUBLIC_BASE_URL` was set to the correct port before the
server ever booted, so no origin-mismatch abort occurred (unlike
docs/verification-log/index/0163-2026-08-15-task-w26-f-walkthrough-73f380f2.md
and docs/verification-log/index/0190-2026-08-15-task-w36-b-walkthrough-f5783479.md).

Summary quoted verbatim (all six DEC-089/DEC-062 areas ran in fixed order
producer -> review -> speaker -> public -> data -> scale, per
scripts/walkthrough-lib.ts:15):

```
Summary:
  PASS producer
  PASS review
  PASS speaker
  PASS public
  PASS data
  PASS scale

walkthrough OK
```

Per-area detail (zero FAIL lines anywhere in the transcript):
- producer: ran first (seeds the event other areas depend on); summary
  line PASS producer.
- review: all 21 checks passed, including the DEC-175 existence-hiding
  pairs (reviewer probing an out-of-scope submission gets 404 not 403) and
  the DEC-039 cross-org 404/403 checks.
- speaker: all checks passed (portal, onboarding tasks incl. DEC-111
  self-healed form tasks, DEC-244 deliverable versioning + comment
  threads incl. the MAX_COMMENT_BODY_LENGTH re-render case, DEC-070 invite
  flow, DEC-108 invite_status visibility gate, DEC-175 cross-speaker IDOR
  probes).
- public: all J9 (agenda scheduling, overlap detection, auto-schedule)
  and J10 (public surfaces, embeds, schedule.ics, DEC-274 hidden-
  participant gate, DEC-108 invite-visibility gate) checks passed.
- data: all J11 (contacts, CSV import, segments, bulk email + cap,
  dashboard stats) and J12 (bearer tokens, exports, cross-org 404,
  /docs/api) checks passed.
- scale: all 6 steps passed against 110 fresh contacts/submissions —
  bulk accept of 110 ids in 83ms, email-log unchanged (no auto-email on
  bulk status change), exactly-once re-accept, purge-refresh probe.

RESULT: PASS — all six walkthrough areas pass at product sha `14db7b30`
(no product edits made; frozen wave per this task's brief, docs/** only).
OPEN ITEMS: 0
