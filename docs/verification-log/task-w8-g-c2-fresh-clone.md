# task-w8-g - fresh-clone @ 80b811d

FROZEN SHA: 80b811d250285de0d37417ddc12f65445ce27f96
RECHECK SHA: 5ccd4d63ea2648a6cc91ad18f301a77976514efb
OPEN ITEMS: 2
RESULT: FAIL

## Protocol

1. `git clone /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua <scratchpad>/task-w8-g-clone`
   then `git checkout 80b811d250285de0d37417ddc12f65445ce27f96` inside the clone (a fresh
   directory outside the repo and outside every worktree — no `node_modules`, no
   `.wrangler`, no prebuilt `public/admin`/`public/embed` carried over).
   `git rev-parse HEAD` printed `80b811d250285de0d37417ddc12f65445ce27f96` — confirmed.
2. `git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua merge-base
   --is-ancestor 80b811d250285de0d37417ddc12f65445ce27f96 refs/heads/main` — exit 0
   (ancestor confirmed) before any other step.

## Commands run (exit codes)

All run inside the fresh clone unless noted.

| Command | Exit code |
|---|---|
| `npm i` | 0 |
| `npm run db:migrate` | 0 (18 migrations 0000-0017 applied ✅) |
| `npm run seed` | 0 (D1 rows + 8 R2 objects seeded) |
| `lsof -i :8787 -i :9229` (pre-flight port check) | both free, no deviation needed |
| `npm run dev` (background, default port 8787, **no** extra `--var` flags) | server reached `[wrangler:info] Ready on http://localhost:8787`; predev vite-built `public/admin` before wrangler boot, matching README's "no extra step" claim |
| `npx playwright install chromium` | 0 (already cached) |
| custom Playwright battery script (`w8g-battery.mjs`, driven against the live `localhost:8787` server) | ran to completion, see findings below |
| `npm test` (in my own worktree, not the clone — see note) | 0 (pass, unrelated to clone findings; clone itself has no `db:migrate`/`test` divergence) |

DEV_MODE=1 comes from a **committed** `.dev.vars` file (`git log --oneline -1 -- .dev.vars`
shows it's tracked, not gitignored) — this is how README's zero-secret quickstart works
without a manual copy step; confirmed present in the fresh clone with no manual setup.

## Route / persona battery (README "For evaluators" table)

All four seeded persona logins succeeded and landed on the correct post-login route:

| Persona | Email | Landed at |
|---|---|---|
| organizer | sbek-organizer@example.com / SbekTest!2027-org | /admin |
| speaker | sbek-speaker@example.com / SbekTest!2027-spk | /portal |
| speaker2 | sbek-speaker2@example.com / SbekTest!2027-spk2 | /portal |
| reviewer | sbek-reviewer@example.com / SbekTest!2027-rev | /admin |

All listed routes returned 200 with non-empty rendered body on first visit:
`/login`, `/portal`, `/submit/devflow-conf-2027`, `/e/devflow-conf-2027/{sessions,speakers,
agenda,schedule,gallery}`, `/e/devflow-conf-2027/schedule.ics` (`text/calendar`, contains
`BEGIN:VCALENDAR`), `/embed/devflow-conf-2027/{sessions,speakers,agenda}`, `/dev/mailbox`,
`/docs/api`.

Public CFP submission (`/submit/devflow-conf-2027`, all required fields incl. session
format/audience-level selects + track checkbox + speaker identity) succeeded with the
`Submit` button (distinct from `Save draft`) and produced "Thanks for your submission!"
plus a confirmation email visible in `/dev/mailbox`. The claim link inside that email was
followed (after correcting for OPEN ITEM 2 below), password creation completed, and the
flow landed on `/portal` — account creation via claim works end to end.

## OPEN ITEM 1 — `/admin` intermittently 500s for a logged-in organizer/reviewer

`src/routes/root.tsx:36-45` (`fetchAdminShell`) throws a 500 ("Admin SPA bundle missing…
DEC-268") on every *other* request to `/admin` while logged in, alternating 200/500/200/500…
reproduced 4/4 times across two independent runs (8-attempt loop: 500,200,500,200,500,200,
500,200). `public/admin/index.html` exists on disk throughout — this is not actually a
missing-bundle condition. Root cause per `fetchAsset`/`fetchAdminShell`
(`src/routes/root.tsx:22-45`): it re-fetches `/admin/index.html` from the `ASSETS` binding
by cloning `c.req.raw` (the browser's *own* request to `/admin`), which carries whatever
conditional-cache headers (`If-None-Match`) the browser attached from its cached response to
`/admin` — but that cached ETag was actually `/admin/index.html`'s ETag (since the outer
`/admin` response body is a byte-for-byte proxy of `index.html`, headers included). On the
next `/admin` request the browser sends that same `If-None-Match` back; `assets.fetch()` sees
it match `/admin/index.html`'s current ETag and correctly returns `304 Not Modified` — but
`fetchAdminShell` treats any non-`res.ok` (304 is not 2xx, so `res.ok` is `false`) as "bundle
missing" and throws a hard 500 instead of treating 304 as success. Confirmed with a raw
Playwright repro (`node w8g-diag2.mjs`, 8 consecutive `/admin` navigations from one logged-in
session): `attempt 0: 500, 1: 200, 2: 500, 3: 200, 4: 500, 5: 200, 6: 500, 7: 200`. This
affects the single most important README route for the organizer/reviewer personas — a
judge who refreshes `/admin` (or a client that respects `If-None-Match`, which any real
browser does) will hit this 500 roughly half the time. Not present-or-absent at S vs
RECHECK — the delta commits (contacts/tasks/pipeline) don't touch `src/routes/root.tsx`, so
this is a standing defect unrelated to the in-flight items DEC-285 pre-registered; flagging
it here since it was discovered by this lane's route battery, not one of the two
pre-registered items.

## OPEN ITEM 2 — CFP-confirmation claim link is off-origin (`chautauqua.cc`, not `localhost:8787`)

The confirmation email's claim link (both the plain-text body and the HTML `<a href>` inside
the mailbox detail page's sandboxed `srcdoc` iframe) rendered as
`http://chautauqua.cc/claim/<token>` instead of `http://localhost:8787/claim/<token>`,
even though the server was run exactly per README (default port 8787, `DEV_MODE=1` via the
committed `.dev.vars`, no `PUBLIC_BASE_URL` override — README only calls that out as needed
for *non-default* ports). Traced to `src/server/origin.ts:80-98` (`resolveBaseUrl`, DEC-252):
the file's own header comment documents that under local `wrangler dev`,
`new URL(c.req.url).origin` resolves to the live `chautauqua.cc` custom-domain host (from
`wrangler.jsonc`'s `routes`/`custom_domain` entry) rather than the local loopback address —
this is expected and the reason the DEV_MODE loopback-sniffing fallback exists. But in this
run neither the `Origin` header nor the `Referer` header carried a loopback origin for the
same-origin form POST from `/submit/devflow-conf-2027` (verified live: the CFP submission
came back with a `chautauqua.cc` link both times I ran the full battery), so
`resolveBaseUrl` falls through all three loopback checks to `return requestOrigin` at line
98, which is the poisoned `chautauqua.cc` origin. Per the task's own pass criteria, this is
an OPEN ITEM, not a footnote: a fresh-clone evaluator following the README literally gets a
claim link that does not resolve on their machine. Workaround used to still exercise the
claim flow: rewrote the link's path onto `localhost:8787` manually, which then completed
account creation and landed on `/portal` correctly — so the claim-token machinery itself is
fine; only the emailed link's origin is wrong.

## KNOWN IN-FLIGHT AT S (DEC-285) — both CLOSED by RECHECK SHA

- `src/server/repo/contacts.ts:207` (`buildMergeRepointOps`, at S): listed only six of
  seven contact FK tables (`participant, task_assignment, email_log, user, file,
  file_comment` — missing `pipeline_entry`), matching DEC-285's description of the
  in-flight `pipeline.ts:161` org-wide-throw defect. **At RECHECK SHA** the function now
  maps over a `CONTACT_FK_TABLES` constant (contacts.ts:200-209, 228) and the merge
  comment explicitly says "repoint the seven CONTACT_FK_TABLES" (contacts.ts:584) —
  confirmed closed by DEC-282's landed commit
  (`50a2947 DEC-282: make CRM merge total over pipeline_entry`).
- `src/server/repo/tasks.ts:263` (`listAcceptedContactIds`, at S): selected participant
  contact IDs on accepted submissions with no `isActiveParticipant`/invite-status gate. **At
  RECHECK SHA** (tasks.ts:274-282) the query now also selects `inviteStatus` and filters
  through `isActiveParticipant` before dedup — confirmed closed by
  (`7f003dd DEC-283: gate listAcceptedContactIds through isActiveParticipant`).

Both re-verified directly by reading the file contents at each SHA in two independent
clones/checkouts (frozen-SHA clone and a second clone checked out to RECHECK SHA) — not by
running code, since neither symptom depends on runtime state beyond the source itself.

## POST-S DELTA

```
5035438 scribe wave 8
c3b0932 merge task-w7-a
50a2947 DEC-282: make CRM merge total over pipeline_entry (fixes org-wide pipeline 500)
7f003dd DEC-283: gate listAcceptedContactIds through isActiveParticipant
```

Non-empty, as expected per DEC-280/285 (wave 7 was still unmerged at S). Neither commit
touches `src/routes/root.tsx` or `src/server/origin.ts`, so OPEN ITEMS 1 and 2 above are
unaffected by the delta and were not re-run at RECHECK SHA (only the two DEC-285
pre-registered claims were delta-touched, and both are confirmed closed above).

## RESULT rationale

Two OPEN ITEMS remain against a README-literal fresh-clone run at the frozen SHA that were
NOT pre-registered by DEC-285 (an intermittent 500 on `/admin`, and an off-origin claim link
in the CFP confirmation email) → RESULT: FAIL. The two DEC-285 pre-registered items are
CLOSED as of RECHECK SHA.
