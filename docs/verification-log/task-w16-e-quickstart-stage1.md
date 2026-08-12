# task-w16-e — zero-secrets fresh-checkout quickstart + evaluator-package fidelity (DEC-448)

LOG-ONLY, no source file changed. Verifies SPEC.md:44-45's hard rule for the
first time by running the *literal* README quickstart from a clean worktree
checkout, with **no** `cp .dev.vars.example .dev.vars` and no bare `npx
wrangler dev` — the two shortcuts every prior walkthrough had silently used
instead, which bypass the `predev` (`scripts/ensure-dev-vars.ts`) mechanism
SPEC.md:44-45 relies on to make setup zero-step.

Worktree: `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w16-e`
(branch `task-w16-e`, forked from `main`).

## 1. Fresh checkout, no `.dev.vars`, literal quickstart

`ls -a` immediately after `git worktree add` (before any npm command):

```
.  ..  .dev.vars.example  .git  .github  app  decisions  docs  field-guide
LICENSE  migrations  package-lock.json  package.json  public  README.md
scripts  src  test  tsconfig.json  vitest.config.ts  wrangler.jsonc
```

No `.dev.vars` present. `.gitignore` line 9 is `.dev.vars` (untracked; `git
ls-files | grep -x '\.dev\.vars'` returns nothing after the run below, too —
`predev` creates it locally but it's never staged).

Ran, in order, exactly:

```
npm ci --prefer-offline --no-audit --no-fund   # substituted for `npm i` — reproducible install, same effect
npm run db:migrate
npm run seed
npm run dev
```

(Task instructions specify `npm ci`; README's quickstart itself says `npm
i` — both install from `package-lock.json` with no extra steps, so this is
not a drift worth flagging.)

- `npm ci`: **PASS** — installed 366 packages clean.
- `npm run db:migrate`: **PASS** — all 19 `migrations/*.sql` files (0000-0018)
  applied ✅ against local D1 with zero manual setup.
- `npm run seed`: **PASS** — `scripts/seed.ts` + `wrangler d1 execute
  --file=.seed.sql` + `scripts/seed-r2.ts` all completed, seeding
  `devflow-conf-2027` and uploading 8 R2 objects (headshots + a resource
  file), no secrets required.
- `npm run dev`: **PASS**. Console output:
  ```
  > predev
  > tsx scripts/ensure-dev-vars.ts && vite build --config app/vite.config.ts

  ensure-dev-vars: created .dev.vars from .dev.vars.example
  ...
  > dev
  > wrangler dev
  Using secrets defined in .dev.vars
  Your Worker has access to the following bindings:
  Binding                          Resource               Mode
  env.KV (...)                     KV Namespace           local
  env.EMAIL (unrestricted)         Send Email             local
  env.DB (chautauqua)              D1 Database            local
  env.FILES (chautauqua-files)     R2 Bucket              local
  env.ASSETS                       Assets                 local
  env.MAIL_FROM_EMAIL (...)        Environment Variable   local
  env.MAIL_FROM_NAME (...)         Environment Variable   local
  env.DEV_MODE ("(hidden)")        Environment Variable   local
  env.PUBLIC_BASE_URL ("(hidden)") Environment Variable   local
  [wrangler:info] Ready on http://localhost:8788
  ```
  `predev` printed the exact required string `ensure-dev-vars: created
  .dev.vars from .dev.vars.example`, then built the admin SPA bundle
  automatically, before `wrangler dev` started. All required bindings (DB,
  FILES, ASSETS, KV, DEV_MODE, PUBLIC_BASE_URL) present. `ls -a` confirmed
  `.dev.vars` now exists locally, still untracked by git.

**Environment note (not a product defect):** the server bound to port 8788,
not the README's stated default 8787, because a concurrent sibling
worktree's `wrangler dev` (task-w16-d, an unrelated swarm worker running in
parallel) already held 8787. `.dev.vars`'s `PUBLIC_BASE_URL` still read
`http://localhost:8787` (the `.dev.vars.example` default), so the emailed
claim link's origin didn't match the port this instance actually served on
— exactly the scenario the README's own "Dev: migrations"-adjacent
`PUBLIC_BASE_URL` paragraph (`If you run wrangler dev on a non-default
port...`) already documents and warns about. Confirmed this is purely
swarm-concurrency contention, not a bug: the `/claim/<token>` route itself
returned 200 when hit on the real bound port (8788), and no single, isolated
fresh checkout (the actual quickstart scenario) would hit this.

## 2. Stage-1 mail surface, end to end, no secret present

- Fetched `GET /submit/devflow-conf-2027` → 200, scraped the double-submit
  CSRF cookie/hidden-field pair the page emits.
- `POST /submit/devflow-conf-2027` with a full multipart submission (title
  "Quickstart Verification Talk", speaker "Wave Sixteen"
  `wave16e-verify@example.com`, track `seed_track_0001`) → **200**, on-screen
  confirmation: `Submitted` flag, body text `We've emailed a confirmation for
  "Quickstart Verification Talk" to the address you provided.` **PASS**.
- `GET /dev/mailbox` → 200, new entry listed for `wave16e-verify@example.com`.
  Opened it (`GET /dev/mailbox/<id>`): both **Text body** and **HTML body**
  (rendered in a sandboxed `<iframe srcdoc>`) present and correct —
  ```
  Hi Wave Sixteen,

  We received your submission "Quickstart Verification Talk" for DevFlow Conf 2027.

  http://localhost:8787/claim/KFgVJlegKxbWjHBBPTKY3CldVDx9k_P0fvkoHi_eX68
  ```
  HTML body wraps the same content in `<p>` tags with the link as an `<a
  href>`. The portal-claim link is absolute (`http://localhost:8787/...`);
  confirmed the corresponding path resolves against this server directly:
  `GET http://localhost:8788/claim/KFgVJlegKxbWjHBBPTKY3CldVDx9k_P0fvkoHi_eX68`
  → 200 (port swapped 8787→8788 only because of the sibling-worktree port
  contention noted above — same worker, same D1). **PASS**.
- Calendar-invite email: logged in as the seeded organizer
  (`sbek-organizer@example.com` / `SbekTest!2027-org`) via the real `/login`
  form (double-submit CSRF), then queried a scheduled submission
  (`seed_submission_0001`, present in `schedule_slot`) and called `POST
  /api/v1/events/seed_event_0001/compose/send` with
  `{"subject":"...","bodyText":"...","submissionIds":["seed_submission_0001"],"attachIcs":true}`
  (JSON CSRF header `x-chq-csrf: 1`) → 200, `{"sent":1,"failed":[]}`. Opened
  the resulting mailbox entry: **"Download calendar invite"** link present,
  pointing at `/dev/mailbox/<id>/ics`. `GET` on that route → 200,
  `Content-Type: text/calendar; charset=utf-8`,
  `Content-Disposition: attachment; filename="chq-seed_submission_0001.ics"`.
  Body parses as a well-formed `VCALENDAR`/`VEVENT` (`BEGIN:VCALENDAR` ...
  `SUMMARY`/`LOCATION`/`ORGANIZER`/`ATTENDEE` ... `END:VEVENT`/`END:VCALENDAR`),
  `UID:chq-seed_submission_0001@chautauqua`. Re-sent the same submission's
  invite a second time (simulating a reschedule/resend); the new mailbox
  entry's `.ics` carried the **same UID** (`chq-seed_submission_0001@chautauqua`)
  with `SEQUENCE` correctly bumped 0→1 — UID is stable per RFC 5545 semantics.
  **PASS**.
- `email_log` row: `GET /api/v1/events/seed_event_0001/email-log?to=wave16e-verify@example.com`
  (as the logged-in organizer) → 200, returned the exact row (id
  `c5audkadjbv44ldhrmve`, `provider: "dev"`, `status: "sent"`, full
  `bodyText`/`bodyHtml`, matching the dev-mailbox rendering byte-for-byte).
  **PASS**.

## 3. No operator secret required anywhere in stage 1

- `src/server/context.ts:50-60` (`makeMailer`): selects `DevSinkMailer`
  whenever `env.EMAIL` is absent **or** `isDevMode(env)` is true (DEC-434:
  `.dev.vars`'s `DEV_MODE=1`, which `ensure-dev-vars.ts` always writes on a
  fresh checkout). Confirmed by the running server: the console listed
  `env.EMAIL (unrestricted) — local` (a Miniflare-simulated binding, not a
  real credential) and `DEV_MODE ("(hidden)")`; every send in step 2 went to
  `/dev/mailbox`, `provider: "dev"` — never attempted a real send.
  `EmailBindingMailer` (the stage-2 path) is only reachable when `env.EMAIL`
  is truthy **and** `isDevMode` is false, and even then it throws only if
  `MAIL_FROM_EMAIL` is unset while a real `EMAIL` binding is configured — a
  stage-2-only branch that never executes on a plain `npm run dev`.
- `src/sync/airtable.ts:111-113` (`runAirtableSync`): `if (!token || !baseId)
  return null; // integration not configured — off, not an error`. Grepped
  the whole tree for `AIRTABLE_TOKEN`/`AIRTABLE_BASE_ID` — only
  `src/server/env.ts` (optional fields on `Bindings`), `src/sync/airtable.ts`
  (the guarded sync itself), and `src/decisions.ts:195` (DEC-190, recording
  the item CLOSED for stage 1). No other code path references either var,
  so nothing throws or silently degrades in their absence — the sync simply
  doesn't run (verified there is no cron-log entry for it in this session;
  the cron itself doesn't fire locally per wrangler's own warning:
  "Scheduled Workers are not automatically triggered during local
  development").
- No secret literal committed: `.dev.vars` is absent from `git ls-files`
  (only `.dev.vars.example` and `scripts/ensure-dev-vars.ts` are tracked);
  `.gitignore:9` covers `.dev.vars`. `wrangler.jsonc`'s `vars` block contains
  only `MAIL_FROM_EMAIL`/`MAIL_FROM_NAME` (a sender identity, not a
  credential — the actual Cloudflare Email Service auth is the binding
  itself, provisioned out-of-repo in stage 2). No API keys/tokens found
  anywhere in `docs/fixtures/sample-data.json` or `scripts/seed.ts`.
  **PASS** on all counts.

## 4. Evaluator package fidelity (SPEC.md:365-366)

Every URL in README's "For evaluators" table, hit against the freshly
seeded, freshly migrated local server (no restart, same session as above):

| Route | HTTP |
|---|---|
| `/admin` | 302 (redirect to `/login` — correct, unauthenticated) |
| `/login` | 200 |
| `/portal` | 302 (redirect to `/login` — correct, unauthenticated) |
| `/submit/devflow-conf-2027` | 200 |
| `/e/devflow-conf-2027/sessions` | 200 |
| `/e/devflow-conf-2027/speakers` | 200 |
| `/e/devflow-conf-2027/agenda` | 200 |
| `/e/devflow-conf-2027/schedule` | 200 |
| `/e/devflow-conf-2027/schedule.ics` | 200 |
| `/e/devflow-conf-2027/gallery` | 200 |
| `/dev/mailbox` | 200 |
| `/docs/api` | 200 |

All resolve. `/embed/<event-slug>/<surface>` (also listed in the table) was
spot-checked separately in prior waves' render-sweep gates; not re-verified
here since the table-walk's purpose is credential/URL fidelity, and this
route needs a `<surface>` value the table doesn't literally spell out.

Persona credentials — posted the real `/login` HTML form (double-submit
CSRF) for each of the four rows in README's persona table, verbatim as
listed:

| Persona | Email | Password | POST /login → | Redirects to |
|---|---|---|---|---|
| Organizer | `sbek-organizer@example.com` | `SbekTest!2027-org` | 302 | `/admin` ✓ |
| Reviewer | `sbek-reviewer@example.com` | `SbekTest!2027-rev` | 302 | `/admin` ✓ |
| Speaker | `sbek-speaker@example.com` | `SbekTest!2027-spk` | 302 | `/portal` ✓ |
| Speaker (second) | `sbek-speaker2@example.com` | `SbekTest!2027-spk2` | 302 | `/portal` ✓ |

All four credentials log in verbatim as documented, land on the "Lands on" /
implied landing screen README specifies. **No drift found between README
text and the seed** for any of the twelve evaluator-table routes or the four
persona rows.

## Summary

| # | Check | Result |
|---|---|---|
| 1 | Fresh checkout, no `.dev.vars`, literal quickstart (`npm ci`/`db:migrate`/`seed`/`dev`) | PASS |
| 2 | Full stage-1 mail surface (CFP submit → confirmation email text+html+portal link, calendar-invite `.ics` download + stable UID, `email_log` API) | PASS |
| 3 | Zero operator secrets anywhere (mailer selection, Airtable sync gating, no committed secret) | PASS |
| 4 | Evaluator-package fidelity (README URLs + all 4 persona credentials) | PASS |

**No stage-1 defect found.** SPEC.md:44-45's zero-secrets quickstart claim
holds under the literal instructions, tested for the first time without the
`cp .dev.vars.example .dev.vars` / bare `npx wrangler dev` shortcuts DEC-448
flagged as never having been exercised. The only anomaly observed (emailed
link port not matching the bound port) is a swarm-concurrency artifact from
a sibling worktree's `wrangler dev` already holding the default port 8787,
not a defect in a real single-user fresh checkout — and it is the exact
scenario the README already documents a remedy for
(`PUBLIC_BASE_URL`/`--var PUBLIC_BASE_URL:...`).
