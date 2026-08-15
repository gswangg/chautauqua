## 2026-08-15 task-w37-d — walkthrough-preflight @ 494b6c01

QUALIFYING

DEC-644 three-sha boundary: HEAD `494b6c01` (branch base, "scribe wave 37");
newest first-parent product-code-bearing sha `3a041507` ("merge
task-w35-c", confirmed via `git log --first-parent -- src app/src
migrations package.json`); live `task-w3*` refs checked with `git
merge-base --is-ancestor <ref> 494b6c01`: `task-w37-b`, `task-w37-e`, and
`task-w36-f` confirm as ancestors; `task-w37-a` and `task-w37-c` do NOT
(both still running/committed-unmerged at the time of this check, per
wave-37 field-guide note "A BRANCH MINUTES OLD AT ITS BASE IS RUNNING, NOT
DEAD" — not re-filed as dead scope here).

Frozen wave (scripts/**, test/**, docs/** only per this task's brief) —
adds a PUBLIC_BASE_URL / --url origin pre-flight to
`scripts/walkthrough.ts` (helpers in `scripts/walkthrough-lib.ts`:
`extractPublicBaseUrl`, `baseUrlMismatch`, `formatBaseUrlMismatchMessage`,
tested in `test/walkthrough-lib.test.ts`). This catches the same failure
mode that cost two prior walkthrough gates a full run each
(docs/verification-log/index/0163-2026-08-15-task-w26-f-walkthrough-73f380f2.md,
docs/verification-log/index/0190-2026-08-15-task-w36-b-walkthrough-f5783479.md)
in five seconds instead of forty steps in — it does NOT fix the underlying
product gap, which is filed below as an OPEN ITEM per this task's brief
("FILE THE PRODUCT GAP, do not fix it").

OPEN ITEM (product gap, not touched — `src/server/origin.ts` is off-limits
for this frozen-wave task): `resolveBaseUrl` (`src/server/origin.ts:104-133`)
applies DEC-296's dev-loopback exception only when a loopback origin is
observable ON THE REQUEST — via `firstLoopbackCandidate`
(`src/server/origin.ts:152-163`), which checks only the request URL
origin, the `Origin` header, and `Referer`. A scripted fetch against
`wrangler dev` under wrangler.jsonc route shadowing presents none of the
three, so a gitignored `.dev.vars` loopback `PUBLIC_BASE_URL` default
(e.g. `.dev.vars.example`'s `http://localhost:8787`) wins outright even
when the operator is actually running the server on a different
per-worktree port, poisoning every mailed absolute link (e.g.
`/claim/<token>`) for the duration of that mismatch. The new pre-flight in
`scripts/walkthrough.ts` catches this before the walkthrough spawns any
module, but a human (or a differently-invoked scripted client) hitting the
API directly without running the walkthrough's pre-flight first is still
exposed. Owner: wave-38 lane. Candidate fix directions (not evaluated
here, out of scope): teach `wrangler dev`'s scripted-fetch callers to send
a loopback `Origin`/`Referer` header, or widen
`firstLoopbackCandidate`/`resolveBaseUrl` under an explicit dev-only
signal that doesn't depend on request headers at all.

RESULT: PASS (pre-flight helpers added and unit-tested; targeted battery
green) — product gap named above remains OPEN, not fixed by this task.
OPEN ITEMS: 1
