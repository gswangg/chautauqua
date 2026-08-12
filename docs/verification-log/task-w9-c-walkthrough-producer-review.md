# task-w9-c — walkthrough repair: producer + review @ 90c0002

DEC-412 assigns this lane exclusive ownership of `scripts/walkthrough/
producer.ts` and `scripts/walkthrough/review.ts` (two of the six DEC-412
areas; speaker+public and data+scale are owned by the other two wave-9
lanes). Worktree cut from `main` tip `90c0002` ("scribe wave 9"), branch
`task-w9-c`. Neither module was edited — running both areas against a
freshly booted local stack (own port, 8811 per the task) found both
already passing with no assertion mismatched against `docs/design/*.dc.html`
and no SPEC §9 J-bar miss, so DEC-412's repair policy was not invoked.

## Pre-check: DEC-407 anchor present

Confirmed `scripts/walkthrough/producer.ts:378` carries the DEC-407
re-pinned J2 deadline assertion (`/\bcloses\b/i`, not a full sentence of
chrome):

```
373:  assertTrue(
374:    "J2 submit page shows a deadline",
375:    /\bcloses\b/i.test(getBody),
376:    "expected a 'Call for papers · closes ...' deadline line",
377:  );
```

(Line numbers shifted slightly from DEC-407's `:378` citation — module has
grown since wave 8 — but the assertion itself is unchanged and present.)

## Boot

`npm ci` — no-op, `node_modules` present from worktree creation. `npm run
build` — clean (dual `tsc --noEmit` + `vite build`, 154 modules, no
errors). `rm -rf .wrangler/state`, `npm run db:migrate` — 17 migrations
applied clean (0000-0010, then 0012-0018; the 0011 gap is the
DEC-164-sanctioned numbering skip). `npm run seed` — clean, 8 objects put
into local R2 bucket `chautauqua-files`.

**Gotcha (env boot, not a code bug):** `.dev.vars` did not exist in this
fresh worktree. The task brief says "predev writes .dev.vars from
.dev.vars.example," but `predev` is an npm lifecycle hook that only fires
for `npm run dev` — the brief's own next line says to run `npx wrangler
dev --port 8811` directly, which bypasses `predev` entirely. Without
`.dev.vars`, `DEV_MODE` is unset, `shouldMountDevMailbox` (DEC-005,
`src/routes/dev/mailbox.tsx:23`) returns false, and `/dev/mailbox` 404s —
which `producer.ts`'s J2 claim-flow check depends on. Fixed by running
`npx tsx scripts/ensure-dev-vars.ts` before starting wrangler (writes
`.dev.vars` from the example) and editing `PUBLIC_BASE_URL` in the
resulting `.dev.vars` from the default `:8787` to `:8811` to match this
lane's port (DEC-296 note in the example file itself flags this). Wrangler
dev must be (re)started after `.dev.vars` changes — it does not hot-reload
env vars. Flagging for the scribe: any lane booting via `npx wrangler dev`
directly (not `npm run dev`) needs this same manual step.

Started `npx wrangler dev --port 8811` in the background. `GET /health`
→ 200. `GET /dev/mailbox` → 200 (confirms the env fix took).

## producer.ts

`npx tsx scripts/walkthrough/producer.ts --url http://localhost:8811`:

```
Running J1 (launch a CFP)...
  ok
Running J2 (public submit + claim) against devflow-conf-2027...
  ok
Running J3 (triage at volume) against devflow-conf-2027...
  ok
Seeding the >100-recipient overflow fixture...
  ok
Running J5 (compose: merge fields, cap, ICS, HTML escaping) against devflow-conf-2027...
  ok
Running DEC-175 authz probes (unauthenticated requests)...
  ok

producer walkthrough OK (J1, J2, J3, J5)
```

Exit 0. All of J1/J2/J3/J5 plus the DEC-175 unauthenticated-probe block
pass. No assertion changed, no product fix needed.

## review.ts

`npx tsx scripts/walkthrough/review.ts --url http://localhost:8811`:

```
ok: queue contains exactly the reviewer's assignment (no unassigned submissions)
ok: queue is sorted fewest-ratings-first
ok: the pre-rated submission (1 rating) is not ordered ahead of an unrated (0-rating) peer
ok: anonymized submission detail has no speaker-identifying fields (raw payload check)
ok: scorecard round-trips numeric rating, dropdown, and free text
ok: max-evaluations cap rejects the overflow evaluation
ok: reviewer GET of admin plan settings -> 403
ok: reviewer GET of plan results -> 403
ok: second-org organizer fetching this plan's queue -> 404/403 (DEC-039)
ok: second-org organizer fetching this plan's results -> 404/403 (DEC-039)
ok: DEC-175 reviewer GET of an out-of-scope submission's review detail -> 404 (not 403)
ok: DEC-175 out-of-scope detail probe is not 403 (existence-hiding, not authz-denial)
ok: DEC-175 reviewer PUT evaluation for an out-of-scope submission -> 404 (not 403)
ok: DEC-175 out-of-scope evaluation probe is not 403 (existence-hiding, not authz-denial)
ok: progress reflects the main reviewer's full completion
ok: progress reflects the second reviewer's partial completion (laggard)
ok: remind sends only to the laggard reviewer
ok: remind writes an email_log row for the laggard, none for the completed reviewer
ok: results are sorted by weighted aggregate score descending
ok: results CSV downloads with a row per result (plus header)

review walkthrough: OK (all checks passed)
```

Exit 0 (19/19 checks, including both DEC-175 out-of-scope-reviewer
existence-hiding probes). All checks pass. No assertion changed, no
product fix needed.

**Note on a transient flake:** the very first `review.ts` attempt this
session failed with a wrangler `d1 execute --local` "internal error"
(`internal error; reference = mtf5nnfc5r3jvn65h7vj9rv4`) inside
`ensureSecondOrg`'s `execFileSync` call — an infrastructure-level SQLite
contention error from the local D1 file, not an assertion failure or a
copy/behavior mismatch. Re-running immediately succeeded, and a full
clean re-migrate + re-seed + fresh server boot + sequential producer-then-
review run (the run recorded above) also succeeded on the first try. Not
a DEC-412 repair-policy case (nothing to re-pin, nothing to fix in
`src/`) — noted here only as a possible harness flake for a future lane
to watch for, not treated as a finding.

## Assertions changed this task

None. Both areas already pass; DEC-412's repair procedure (re-pin
copy-only assertions or fix product code against SPEC §9) was not
triggered.

## Product fixes this task

None.

## Cleanup

`wrangler dev --port 8811` process tree killed (all PIDs under the
`npm exec wrangler dev --port 8811` tree, including the respawned
`workerd` child) after the run. `lsof -i :8811` confirmed empty.

## OPEN ITEMS: 0

## RESULT: PASS (producer.ts exit 0, review.ts exit 0, both at
`main` tip `90c0002`; no assertions changed, no product code touched;
DEC-407's `/\bcloses\b/i` re-pin confirmed still present and passing.)
