# task-w4-b — walkthrough @ c211d4c

DEC-250 freeze check: `git diff --name-only c211d4c HEAD` (worktree created
from `main` at `19b6214`, "merge task-w4-e") shows drift only in
allow-listed paths — `decisions/DEC-250.md`, `decisions/DEC-251.md`,
`field-guide/index.md`, `src/decisions.ts`, plus sibling exit-battery
verification docs already merged from other w4 lanes
(`docs/verification-log/task-w4-a-build-test.md`,
`task-w4-c-perf-smoke.md`, `task-w4-d-render-sweep.md`,
`task-w4-e-spec-audit.md`). No product drift; battery proceeds. (Note:
this walkthrough was actually executed earlier in a worktree that was
externally removed/pruned mid-task before the commit landed; the server
run and all findings below are from that execution against the
product code at the c211d4c-equivalent state — confirmed byte-identical
product code, since the only drift between that run and this
recreated worktree is the same allow-listed set plus other already-merged
w4 verification docs, none of which touch `src/`, `scripts/`, or
`wrangler.jsonc`.)

Setup: fresh worktree branch `task-w4-b` off `main`; `rm -rf .wrangler`;
`npm ci`; `npm run build` (tsc x2 + vite build, clean); `npm run db:migrate`
(15 migrations applied); `npm run seed`; `npx tsx scripts/ensure-dev-vars.ts`
(created `.dev.vars` from `.dev.vars.example`, contents never read/printed
per DEC-187); `npx wrangler dev --port 8971` backgrounded, `GET /` returned
200.

`npm run walkthrough -- --url http://localhost:8971` (canonical run — halts
at the first failing module, per `scripts/walkthrough.ts`'s
`spawnSync`/`process.exitCode` design) was run first and reproduced below
verbatim. To fill in the per-module table for this report, the remaining
five modules were then also invoked individually against the same running
server (`npx tsx scripts/walkthrough/<area>.ts --url http://localhost:8971`,
same fixed order producer -> review -> speaker -> public -> data -> scale).

## Per-module result

- producer: **FAIL** (J1 ok; J2 fails on claim-link GET)
- review: PASS (20/20 checks ok, incl. w3-d QueueItem.submissionId repair)
- speaker: PASS (76/76 checks ok, incl. DEC-244 portal deliverable-panel
  steps at speaker.ts:660-748)
- public: PASS (29/29 checks ok, J9/J10)
- data: PASS (21/21 checks ok, J11/J12)
- scale: **FAIL** (steps 1-5 pass; step 6 fails on the identical claim-link
  GET)

## FAIL output verbatim — producer (canonical `npm run walkthrough` run)

```
> walkthrough
> tsx scripts/walkthrough.ts --url http://localhost:8971

Running J1->J12 walkthrough against http://localhost:8971
Order: producer -> review -> speaker -> public -> data -> scale

--- producer ---
Running J1 (launch a CFP)...
  ok
Running J2 (public submit + claim) against devflow-conf-2027...
FAILED: J2 GET claim link
  expected status 200, got 410
  body: This link is invalid or has expired.
WALKTHROUGH FAILED at producer
```

## FAIL output verbatim — scale (individual re-run)

```
Running step 1 (110 fresh contacts + submissions + participants)...
PASS step1 (110 fresh contacts + submissions + speaker participants)
Running step 2 (one bulk accept, 110 ids)...
PASS step2 (one bulk POST, 110 ids, updated=110)
Running step 3 (onboarding task_assignments for a sample of fresh contacts)...
PASS step3 (onboarding task_assignments exist for 5 sampled fresh contacts)
Running step 4 (re-accept is exactly-once)...
PASS step4 (re-POST identical bulk request: assignment counts unchanged, exactly-once)
Running step 5 (no auto-email on status change)...
PASS step5 (dev mailbox message count unchanged by bulk accept)
Running step 6 (purge-refresh probe)...
FAILED: step6: GET claim link
  expected status 200, got 410
  body: This link is invalid or has expired.
```

## Root-cause diagnosis (verification-only — no product-code edits made)

Both failures are the *same* underlying issue, isolated with a minimal
repro script hitting the running local server directly:

- The public-submit confirmation page builds its claim link as
  `${new URL(c.req.url).origin}/claim/${claimToken}`
  (`src/routes/public/submit.tsx:540-546`).
- `wrangler.jsonc` declares
  `"routes": [{ "pattern": "chautauqua.cc", "custom_domain": true }]`
  (production deploy config, committed as part of stage-2 wiring, present
  well before the DEC-250 freeze).
- Under local `wrangler dev`, with that `routes` entry present, the Worker
  observes `c.req.url` with origin `http://chautauqua.cc` even though the
  client is connecting to `http://localhost:8971` — confirmed by direct
  `curl`/`fetch` repro (fresh server, first request, no other state):
  the confirmation page's rendered claim `href` is
  `http://chautauqua.cc/claim/<token>` and the local wrangler dev request
  log never shows a `GET /claim/...` line for that token at all, because
  the walkthrough client (using the link exactly as rendered, same as a
  real browser/email client would) follows it to the real, live
  `chautauqua.cc` production deployment instead of the local dev server.
  `chautauqua.cc` is a real, DNS-resolving, already-deployed instance of
  this same app (per field guide: "Human committed stage-2 ... on main"),
  which coincidentally serves an identical-looking 410
  "This link is invalid or has expired." page for the (nonexistent, on
  that deployment) token — masking the fact that the request never
  reached the intended local server/local KV.
- This is a genuine STAGE 1 invariant gap ("code must run with NO secrets
  present... never add code requiring an external account" / local-first
  dev): under plain `wrangler dev --port 8971` (exactly the command this
  battery is specified to run), speaker-facing claim links leak to a live
  external host rather than staying local. It is not fixable from a
  verification-only lane (no product-code or config edits permitted here);
  flagging for a follow-up task to either drop the `routes`/`custom_domain`
  entry from local dev, or make link-origin derivation dev-mode aware
  (e.g. prefer a `PUBLIC_BASE_URL` env var / request Host header over
  `custom_domain` route inference) so `wrangler dev` never emits links to
  the real production domain.

## OPEN ITEMS: 2

1. producer module J2 fails: claim link built from `new URL(c.req.url).origin`
   resolves to the production `chautauqua.cc` custom-domain route under
   local `wrangler dev` instead of `localhost:8971`, per diagnosis above.
2. scale module step 6 fails on the identical claim-link mechanism.

RESULT: FAIL — 4/6 modules pass cleanly (review, speaker, public, data —
146 individual checks, all ok); producer and scale both fail at the same
root cause: claim links generated during local `wrangler dev` resolve to
the live `chautauqua.cc` production custom-domain route (from
`wrangler.jsonc`'s `routes`/`custom_domain` config) rather than
`localhost:8971`, so the walkthrough's claim-link GET is answered by the
real external deployment (410) instead of the local server. This is a
real local-dev/STAGE-1-invariant gap, not an artifact of this
verification run; no product-code or config changes were made in this
verification-only lane.
