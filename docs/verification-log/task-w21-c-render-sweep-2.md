# 2026-08-10 task-w21-c — render-sweep @ 6807b67

Full detail for the `## 2026-08-10 task-w21-c — render-sweep @ 6807b67` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

DEC-208 wave-21 completion battery lane (render-sweep, DEC-144/
DEC-206/DEC-208), bound to FROZEN sha `6807b67` with the DEC-206 hard
drift-stop.

**DEC-114 sha check.** Walked `main`'s HEAD back from `9b3b875`
("scribe wave 21") through `78bb286` ("scribe wave 20"): every commit
in that span (`9b3b875`, `d413da6`, `7d9f140`, `8da1d2a`, `076e0a8`,
`d35cd68`, `2416c76`, `1ff4b3e`, `3106e5c`, `ba0db9f`, `d1c13d2`,
`edb5a52`, `92f8d4d`, `78bb286`) has a first-parent diff (per DEC-114)
that touches only `docs/verification-log.md`, `decisions/**`, or pure
string-constant appends to `src/decisions.ts` (verified by inspecting
the `src/decisions.ts` diff content for `9b3b875` and `78bb286`
directly — both add only `export const DEC_2xx = "...";` lines, no
other files touched by either). No commit in this span is code-bearing
per the DEC-114 exclusion set. Newest code-bearing sha = `6807b67`,
matching this task's FROZEN binding. No drift — proceeded.

**DEC-203 precondition greps**, all present in the worktree (branched
from `main` at `9b3b875`, code-identical to `6807b67` per the sha
check above): `src/routes/api/users.ts:57`
`record.email.trim().toLowerCase()`; `src/server/repo/users.ts:54`
`lower(${schema.user.email})` in the lookup query; `src/index.ts`
imports `accountRoutes` from `./routes/account` and mounts it via
`app.route("/", accountRoutes)`; the welcome-email text in
`src/routes/api/users.ts` reads "Sign in at /login with the temporary
password your organizer will share with you; you can change it at
/account/password after signing in" — no password value interpolated.
No precondition miss.

**Confirm-else-run.** A full-heading match for `render-sweep @
6807b67` already exists on main's ledger: `## 2026-08-10 task-w20-d —
render-sweep @ 6807b67` (lines ~7205-7303 of the pre-append ledger),
recorded `RESULT: PASS — 31/31 swept routes green, zero
console/page errors; manifest coverage gap for /account/password noted
and compensated with manual curl evidence (anonymous 302 to
/login)`. Per DEC-208's confirm-else-run carve-out (a late-draining
full-heading `task-w20-<x> — <scope> @ 6807b67` PASS section already
on main's ledger may be confirmed and cited instead of re-run), this
lane confirms that section rather than re-running the gate. The
section's own DEC-114 sha check and DEC-203 precondition greps were
independently re-verified above at this lane's own worktree HEAD and
agree with the cited section's findings.

**OPEN ITEMS: 1** — carried forward from the cited `task-w20-d`
section: `app/src/routeManifest.ts` does not enumerate `/account` or
`/account/password` (DEC-200), so the automated render-sweep gate does
not exercise the authenticated password-change form render; only the
anonymous-redirect case (302 to `/login`) was manually spot-checked in
the cited section. Out of scope for this verification-only lane to
fix; recommend a future task add the route to the manifest.

**RESULT: PASS — confirmed via existing `task-w20-d — render-sweep @
6807b67` full-heading section on main (31/31 swept routes green);
manifest coverage gap for `/account/password` carried forward as
OPEN ITEMS: 1**
