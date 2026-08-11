# task-w11-g - fresh-clone @ d89a16f

FROZEN SHA: d89a16f0045c987255fcff13aaef69171054190f
WAVE-10 GATE: PASS
OPEN ITEMS: 0
RESULT: PASS
RECHECK SHA: n/a

## POST-S DELTA

```
$ git log --oneline d89a16f0045c987255fcff13aaef69171054190f..refs/heads/main -- src app migrations scripts test
(empty)
```

## Gate detail (DEC-303 seven-item WAVE-10 CONTENT GATE, checked at S in a
detached `git worktree add --detach` scratch dir, `git merge-base
--is-ancestor $S refs/heads/main` confirmed both before and after the
fresh-clone run)

- G1 `src/routes/root.tsx:47` — `if (!res.ok && res.status !== 304) {` — PRESENT
- G2 `.dev.vars.example:6` — `PUBLIC_BASE_URL=http://localhost:8787` AND
  `src/server/origin.ts:107,114,123` — `firstLoopbackCandidate` — PRESENT
- G3 `src/routes/public/index.tsx:55` — `c.header("Cache-Control", "no-store");`
  on the `publicNotFound` (non-200) path — PRESENT
- G4 `src/routes/agenda.ts:140` `parseBoundedInt`, `src/routes/agenda.ts:133`
  `gridMin: { min: 1, max: 480 },` — PRESENT
- G5 `src/server/repo/attribution.ts:40` —
  `isNull(schema.participant.titleAtTime)` — PRESENT
- G6 `src/routes/api/forms.ts:217-218` (`cascade = c.req.query("cascade") ===
  "1"`, 409 when dependents exist and `!cascade`) + `src/server/repo/forms.ts`
  cascade delete implementation (DEC-300) — PRESENT
- G7 `src/routes/api/events.ts:223` — `name: "General"` at event/track create
  — PRESENT

All seven present at S on first read; no polling loop needed.

## Scope (DEC-257): fresh clone, README-verbatim, port 8787 exclusively

Cloned `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua` at
S into a scratch directory OUTSIDE the repo tree (no carried-over
node_modules, .wrangler, or .dev.vars — verified empty before `npm i`).
Followed README.md's Quickstart section literally, in order, on the default
port with no `--var` flags and zero secrets:

1. `npm i` — 423 packages installed clean (9 pre-existing npm audit
   advisories, unrelated to this task's scope — not a README-verbatim
   defect).
2. `npm run db:migrate` — all 18 hand-authored `migrations/*.sql` files
   (0000-0017) applied successfully against local D1 (both the initial-run
   and the `--remote`-less confirmation pass wrangler prints).
3. `npm run seed` — seeded the demo event (`devflow-conf-2027`) and uploaded
   8 R2 objects (submission files, resource, headshots) with no errors.
4. `npm run dev` — `predev` built the admin SPA bundle first (DEC-268, no
   extra step needed on a clean clone), then `wrangler dev` started with
   `Ready on http://localhost:8787` — the DEFAULT port, no `--var` override
   passed. `.dev.vars` was created from `.dev.vars.example` by the predev
   hook and is byte-identical to the tracked template (`DEV_MODE=1`,
   `PUBLIC_BASE_URL=http://localhost:8787`) — the README's Quickstart
   `.dev.vars.example` / `PUBLIC_BASE_URL` paragraph (lines 37-45) is
   VERBATIM TRUE on this clean clone.

No inspector-port deviation was needed (9229 was free) — README followed
with zero deviations.

### Persona logins (real chromium via Playwright, `npx playwright install
chromium`)

All four seeded personas, credentials taken verbatim from the README's "For
evaluators" table (no credential mismatch found):

| Persona | Email | Landed on |
|---|---|---|
| Organizer | sbek-organizer@example.com | /admin |
| Speaker | sbek-speaker@example.com | /portal |
| Speaker (second) | sbek-speaker2@example.com | /portal |
| Reviewer | sbek-reviewer@example.com | /admin/review |

(The reviewer session logged one benign browser console 403 for an
organizer-only sub-resource fetched speculatively by the admin SPA shell
before the reviewer-scoped view finished mounting; final landing page and
content were correct — not counted as an OPEN ITEM.)

### Evaluator route table (organizer session unless public/no-login)

Every route in the README's "For evaluators" table returned 200 (the
`.ics` calendar export triggers a same-origin file download in a real
browser, so it was fetched via `page.request.get` rather than `page.goto`
to observe its status without invoking the OS download UI — still the same
origin, same port, same session):

/admin, /login, /portal, /submit/devflow-conf-2027,
/e/devflow-conf-2027/{sessions,speakers,agenda,schedule,schedule.ics,gallery},
/embed/devflow-conf-2027/sessions, /dev/mailbox, /docs/api — all 200.

### Public CFP submission as a stranger

Cleared all cookies (unauthenticated stranger context), loaded
`/submit/devflow-conf-2027`, filled the default form's required fields
(title, description, session format, audience level, one track, first
name, last name, email — a fresh, non-fixture email
`stranger-w11g-<timestamp>@example.com`), and clicked the real "Submit"
button (distinct from "Save draft", which has `formaction=".../save-draft"`
and was NOT the one asserted). Landed back on
`/submit/devflow-conf-2027` (200) with a new confirmation email generated.

### /dev/mailbox and the claim link

`/dev/mailbox` listed a new message row addressed to the stranger's email
with subject/link `/dev/mailbox/<id>`. Opened it: the message body's only
absolute http(s) link is `http://localhost:8787/claim/<token>` (appears
twice in the rendered page — once in an HTML-rendered body, once inside an
escaped plain-text fallback preview of the same message — both instances
are the identical `localhost:8787` URL). **HARD ASSERTION MET**: every
absolute http(s) link in the rendered /dev/mailbox message body resolves to
`localhost:8787` — no `chautauqua.cc` or other off-origin link found. This
was the exact defect DEC-296 fixed (task-w8-g OPEN ITEM 2); confirmed fixed
on a genuinely clean clone with no `--var` override.

### Claim -> account creation -> /portal

Navigated to the claim link, filled the password field(s) on the claim
page, submitted, and landed on `/portal` (200) — full stranger CFP
submission -> confirmation email -> claim -> account creation -> portal
flow works end-to-end with zero secrets and zero extra flags.

## Result

No off-origin links, no missing/incorrect README credentials, no step
requiring a secret, README Quickstart prose verbatim true. Wrangler dev
server was stopped cleanly at the end of the run (`pkill -f "wrangler
dev"`, confirmed port 8787 free). RESULT: PASS, OPEN ITEMS: 0.
