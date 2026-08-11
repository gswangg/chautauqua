# task-w4-f - fresh-clone bootstrap @ e522a6f

DEC-264/DEC-257 evidence lane: the ONE gate in this campaign that has never
run the README Quickstart against a truly cold checkout — no swarm
`node_modules`, no `.wrangler` state, no hand-written `.dev.vars`, no
non-default port. Read-only w.r.t. the product repo; the only artifact this
task produced there is this file. Work happened entirely in a `git clone`
of the repo taken OUTSIDE the repo tree, at
`/private/tmp/claude-501/.../scratchpad/fresh-clone` (deleted after this
run), driven by a real Playwright chromium via the `playwright`
devDependency, with driver scripts living only in that clone's `.scratch/`
(never committed).

Per DEC-264, no `FROZEN SHA:` line — this is evidence, not a freeze.

## Step 1: git clone

```
$ git clone /Users/.../Projects/chautauqua fresh-clone
Cloning into 'fresh-clone'...
done.
$ git rev-parse --short HEAD
e522a6f
```

Matches `main` at task start (`git -C chautauqua rev-parse --short main` ->
`e522a6f`). No `node_modules`, `.wrangler`, or `.dev.vars` carried over
(verified: `app/dist` and `public/admin` did not exist pre-build, see below).

## Step 2: README Quickstart VERBATIM

`npm i` -> "added 423 packages... 9 vulnerabilities (6 moderate, 3 high)" —
no install errors.

`npm run db:migrate` -> ran `wrangler d1 migrations apply chautauqua
--local`, applied all 16 migrations (0000-0015) cleanly, all rows show `✅`.

`npm run seed` -> completed, ending with `seed-r2: put 8 object(s) into
local R2 bucket 'chautauqua-files'`. No errors.

`npm run dev` (default port, NO extra `--var` flags, no secrets): port 8787
was free (`lsof -nP -iTCP:8787 -sTCP:LISTEN` returned nothing before start —
no polling needed). Output:

```
> predev
> tsx scripts/ensure-dev-vars.ts
ensure-dev-vars: created .dev.vars from .dev.vars.example
> dev
> wrangler dev
...
env.DEV_MODE ("(hidden)")                                   Environment Variable      local
...
[wrangler:info] Ready on http://localhost:8787
```

`.dev.vars` (auto-created by the `predev` hook from `.dev.vars.example`,
which is itself checked in) contains only `DEV_MODE=1` — no secrets present,
consistent with the zero-secret Stage-1 requirement. No non-default-port
deviation was needed; the inspector-port flag was NOT used.

## Step 3-5: driven walkthrough (real chromium via Playwright)

Chromium was already installed for the `playwright` devDependency
(`npx playwright install chromium` was a no-op). Driver logic lives in
`.scratch/drive.ts`, `.scratch/repro-headers.ts`, `.scratch/repro-resolve.ts`,
and `.scratch/claim-flow.ts` inside the clone (deleted with it, never
committed to any repo).

### All four seeded persona logins (README "For evaluators" table)

All four logins succeed and land where expected:

- `sbek-organizer@example.com` / `SbekTest!2027-org` -> lands at `/admin`
  (session established) but see OPEN ITEM #1 below — the admin SPA itself
  is unreachable.
- `sbek-reviewer@example.com` / `SbekTest!2027-rev` -> lands at `/admin`,
  same OPEN ITEM #1.
- `sbek-speaker@example.com` / `SbekTest!2027-spk` -> lands at `/portal`,
  200, renders correctly (dashboard, "My Submissions" table with seeded
  `SES-031`, etc.).
- `sbek-speaker2@example.com` / `SbekTest!2027-spk2` -> lands at `/portal`,
  200, renders correctly.

All four README-listed credentials are correct as documented.

### OPEN ITEM #1 (most severe): the admin SPA is completely unreachable on a literal Quickstart run — every `/admin` route 404s

The README's Quickstart (`npm i && npm run db:migrate && npm run seed &&
npm run dev`) never builds the admin SPA's static bundle. `npm run build`
runs `vite build --config app/vite.config.ts`, which writes to
`app/vite.config.ts`'s `outDir: '../public/admin'` — and `wrangler.jsonc`'s
assets binding serves from `directory: "public"`. On a fresh clone, `public/`
contains only `.gitkeep`; `app/dist` and `public/admin` do not exist until
either `npm run build` or `npm run dev:app` (vite build --watch, framed in
the README purely as "while iterating on the admin SPA") has been run.
Neither is part of the Quickstart's four listed commands.

Result: every direct navigation to `/admin` or any `/admin/*` path returns
HTTP 404 (via `src/routes/root.tsx`'s `fetchAsset(c, "/admin/index.html")`,
which 404s because `public/admin/index.html` doesn't exist) and fires a
browser console error `Failed to load resource: the server responded with a
status of 404 (Not Found)`. Observed for every route in the README's "For
evaluators" table under Admin SPA, plus every J1-J6/J8-J12 admin-console
screen reachable only through `/admin`:

```
VISIT organizer route http://localhost:8787/admin/overview -> 404
VISIT organizer route http://localhost:8787/admin/submissions -> 404
VISIT organizer route http://localhost:8787/admin/submissions/forms -> 404
VISIT organizer route http://localhost:8787/admin/speakers -> 404
VISIT organizer route http://localhost:8787/admin/content -> 404
VISIT organizer route http://localhost:8787/admin/agenda -> 404
VISIT organizer route http://localhost:8787/admin/contacts -> 404
VISIT reviewer route http://localhost:8787/admin/review -> 404
```

(Note: the reviewer's actual in-SPA landing route is `/review`, not
`/admin/review` — app/src/App.tsx mounts `ReviewPage` at nav path
`/review/*` — but this distinction is moot: bare `/admin` itself already
404s server-side for BOTH personas before any client-side router code can
even load, since `public/admin/index.html` doesn't exist. Login itself
succeeds and sets a session cookie; it's purely the static-asset bundle
that's missing.)

This means J1, J3, J4, J5, J6, J8, J9, J11, J12 — every job whose "Screen(s)"
column in the README points at `Admin -> ...` — are unreachable end to end
on a literal fresh-clone Quickstart run. Only J2 (public CFP submission), J7
(speaker portal), and J10 (public pages) are reachable, because those are
server-rendered routes independent of the Vite-built SPA bundle.

The README should either (a) add `npm run build` (or `npm run dev:app`) as a
required Quickstart step before `npm run dev`, or (b) have `predev`/`dev`
build the admin bundle automatically. As written, "For evaluators" promises
`/admin` works after the four listed commands; it does not.

### Public CFP submission form end to end (J2)

`/submit/devflow-conf-2027` -> 200, renders. Filled locked fields by their
actual `name` attributes (confirmed via `curl`, not guessed — form fields
use a `field__<id>` convention, e.g. `field__title`, `field__description`,
`field__first_name`, `field__last_name`, `field__email`; a `trackIds`
checkbox group is also required and undocumented as such by any visible
label text beyond "Select at least ..."). After checking a track and
selecting the required "Session format"/"Audience level" dropdowns, clicking
the real `Submit` button (there is a second, decoy-adjacent `Save Draft`
button with `formaction=".../save-draft"` and no `formnovalidate` on the
real one — the two are easy to conflate) produced:

```
Thanks for your submission!We've emailed a confirmation for
"w4f evidence talk 1786464676949" to the address you provided.
Create a password to track your submission
```

Confirmed end to end, no console/page errors on this route.

### OPEN ITEM #2 (severe): every emailed absolute link is off-origin — `chautauqua.cc`, not `localhost:8787` — even though DEC-252's loopback-header fallback saw genuinely loopback headers

The confirmation email's claim link rendered by `/dev/mailbox` for the CFP
submission above:

```
$ curl -s http://localhost:8787/dev/mailbox/lyuh4rguely2zo3ej7my
...
http://chautauqua.cc/claim/4MXvIjsLhwVN9jG84DEpsam59Jvw1Xf4r7ZEadfkN2E
...
<a href="http://chautauqua.cc/claim/4MXvIjsLhwVN9jG84DEpsam59Jvw1Xf4r7ZEadfkN2E">
```

Both the text and HTML bodies use `http://chautauqua.cc`, an off-origin
absolute link per this task's assertion — an OPEN ITEM, not a footnote.
`https://chautauqua.cc/claim/<token>` is a LIVE production deployment
(confirmed: `curl -o /dev/null -w '%{http_code}' https://chautauqua.cc/claim/<token>`
-> `410`, not a connection failure) — an evaluator who clicks the emailed
link from a fresh-clone local dev session is sent off their machine entirely,
to a real deployed site where the token predictably doesn't resolve.

This reproduced identically for a second, independent submission driven
through the real browser (`.scratch/repro-headers.ts`), where the captured
outgoing POST headers were:

```
POST http://localhost:8787/submit/devflow-conf-2027
{
  "origin": "http://localhost:8787",
  "referer": "http://localhost:8787/submit/devflow-conf-2027",
  ...
}
```

i.e. both `Origin` and `Referer` ARE loopback on the real request — exactly
the case `src/server/origin.ts`'s `resolveBaseUrl()` precedence (DEC-252)
claims to handle via its `DEV_MODE === "1"` loopback-header fallback. Yet
the resulting claim link still resolved to `chautauqua.cc`. Isolated
`resolveBaseUrl()` directly (`.scratch/repro-resolve.ts`, same function, no
app scaffolding) against the four combinations of
`{requestUrl: loopback|chautauqua.cc} x {DEV_MODE: "1"|unset}`:

```
requestUrl=http://localhost:8787/submit/devflow-conf-2027 DEV_MODE=1 -> http://localhost:8787
requestUrl=http://localhost:8787/submit/devflow-conf-2027 DEV_MODE=undefined -> http://localhost:8787
requestUrl=https://chautauqua.cc/submit/devflow-conf-2027 DEV_MODE=1 -> http://localhost:8787
requestUrl=https://chautauqua.cc/submit/devflow-conf-2027 DEV_MODE=undefined -> https://chautauqua.cc
```

only the last combination (chautauqua.cc request URL AND DEV_MODE unset)
reproduces the observed bug — meaning that at the moment the mailer built
this specific claim link, either (a) `wrangler dev`'s route-shadowing (from
`wrangler.jsonc`'s `routes: [{pattern: "chautauqua.cc", custom_domain:
true}]`) rewrote/stripped the `Origin`/`Referer` headers themselves before
the Worker's Hono handler saw them (not just `c.req.url`, which
`origin.ts`'s own doc comment already anticipates being route-shadowed) —
the captured headers above were read at the Playwright/network layer, not
inside the Worker, so this remains consistent — or (b) `env.DEV_MODE` was
not `"1"` in that specific request's handler despite `/dev/mailbox` (same
strict `env.DEV_MODE === "1"` check, `shouldMountDevMailbox`) being
reachable in the same server process. Root-causing further requires
instrumenting the running Worker, which is out of scope for this read-only
evidence lane; the reproducible, load-bearing fact is: on an unmodified
fresh clone, on the default port, with zero manual flags, the emailed claim
link is wrong.

This is not a broken claim token: substituting `localhost:8787` for
`chautauqua.cc` in the same link (`.scratch/claim-flow.ts`) works end to
end — claim page loads (200), password creation form submits, and lands at
`/portal` showing the just-submitted talk under "My Submissions" (ref
`SES-031`, status "Under review"). The defect is scoped entirely to the
origin/host resolution, not the claim mechanism.

The public `/e/devflow-conf-2027/schedule.ics` calendar export was also
checked directly (`curl`); its body is a near-empty `VCALENDAR` (no `VEVENT`
blocks — the seeded event has no agenda-scheduled sessions) so it contains
no absolute links to assert on either way; not an OPEN ITEM, just noted for
completeness (this is a seed-data/agenda-building fact, unrelated to J9
which is exercised elsewhere).

### Remaining public routes (README table, J10)

All 200, no console/page errors observed:

```
VISIT public route from README table http://localhost:8787/e/devflow-conf-2027/sessions -> 200
VISIT public route from README table http://localhost:8787/e/devflow-conf-2027/speakers -> 200
VISIT public route from README table http://localhost:8787/e/devflow-conf-2027/agenda -> 200
VISIT public route from README table http://localhost:8787/e/devflow-conf-2027/schedule -> 200
VISIT public route from README table http://localhost:8787/e/devflow-conf-2027/gallery -> 200
VISIT public route from README table http://localhost:8787/embed/devflow-conf-2027/sessions -> 200
VISIT public route from README table http://localhost:8787/docs/api -> 200
VISIT public route from README table http://localhost:8787/e/devflow-conf-2027/schedule.ics -> 200
```

## What the README literally promises vs. what happened

The README's Quickstart promises: "This installs dependencies, applies
migrations..., seeds a fully-populated demo event ..., and starts `wrangler
dev`" and then, under "For evaluators", lists `/admin` as the "Admin SPA
(organizer/reviewer console)" route with no caveat. In fact, after running
exactly those four commands with no deviation: the admin SPA is 100%
unreachable (OPEN ITEM #1), and every emailed link (at minimum the CFP
confirmation's claim link, checked directly; `src/routes/comms.ts` and
`src/routes/api/contacts.ts` call the same `resolveBaseUrl()` for other
emailed links per the earlier `grep`, so the same defect likely affects
onboarding-task/notification emails too, though those specific email types
weren't triggered in this run) points off-machine to a live production host
rather than the local server the evaluator is actually running (OPEN ITEM
#2). Both are load-bearing, reproducible defects that only a genuinely cold,
default-port bootstrap surfaces — consistent with why this evidence lane
exists.

## OPEN ITEMS: 2

1. `/admin` and every `/admin/*` route 404 after the literal 4-command
   README Quickstart (missing `npm run build` / `npm run dev:app` step to
   populate `public/admin`) — blocks all organizer/reviewer console access
   (J1, J3, J4, J5, J6, J8, J9, J11, J12 admin-console portions).
2. Emailed absolute links (confirmed for the CFP confirmation/claim link;
   `resolveBaseUrl()` is shared by `src/routes/comms.ts` and
   `src/routes/api/contacts.ts` too) resolve to `http://chautauqua.cc`
   (a live, off-machine production deployment returning 410 for the token)
   instead of `http://localhost:8787`, despite the real browser request
   carrying loopback `Origin`/`Referer` headers that DEC-252's
   `resolveBaseUrl()` precedence is documented to accept as a fallback. The
   underlying claim mechanism itself is correct once the host is corrected
   by hand.

RESULT: FAIL
