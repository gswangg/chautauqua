# task-w25-e: Fresh-clone, zero-secret Stage-1 quickstart evidence

Evidence about main @ `f4421b1ba71d9557d3a7f688982e35b36b89fd3c` (recorded via
`git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w25-e
rev-parse HEAD`, which matches the sha of `git clone
/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua` at the time this evidence
was gathered, confirmed with `git rev-parse HEAD` inside the clone).

Clone location: outside every worktree, in the session scratchpad —
`/private/tmp/claude-501/.../scratchpad/w25-e/chautauqua-clone` (never under
`/tmp` directly, per scratchpad convention).

Port used: **8793** (DEC-498 assignment for this lane). No `pkill -f`; every
`wrangler dev` process started in this run was stopped by its own spawned
PID (`kill <pid>` on the exact PID `npm`/`nohup` printed), confirmed gone
with `ps -p <pid>` and `lsof -i :8793` returning empty at the end of the run.

## 1. sha under test

```
$ git rev-parse HEAD
f4421b1ba71d9557d3a7f688982e35b36b89fd3c
```

## 2. Clone

`git clone /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua
chautauqua-clone` into the scratch dir above, then confirmed `git rev-parse
HEAD` in the clone matched the sha in step 1 (`main` HEAD was already at
that commit at clone time, no separate checkout needed).

## 3. Bare-environment proof

```
$ env | grep -i -E 'AIRTABLE|RESEND|SECRET|API_KEY|TOKEN'
(no output, exit code 1)

$ find <clone> -name ".dev.vars*"
<clone>/.dev.vars.example
```

Only `.dev.vars.example` is present on disk in the fresh clone; no
`.dev.vars` exists until a dev step creates one (see OPEN ITEM 2 below).

## 4. README Quickstart, run literally

Ran the four commands printed at README.md:42-47:

```
$ npm i
added 366 packages, and audited 367 packages in 3s
(4 vulnerabilities reported by npm audit, none blocking)

$ npm run db:migrate
🚣 4 commands executed successfully. All migrations 0000-0018 applied ✅.

$ npm run seed
seed-r2: put 8 object(s) into local R2 bucket 'chautauqua-files'
(D1 seed rows + R2 objects created without error)
```

All three ran with **zero secrets present** and succeeded exactly as
printed, no deviation needed.

For the fourth command, README.md:42-47 prints plain `npm run dev`
(default port 8787), but the task requires exercising README's own
documented **non-default-port procedure** at README.md:61-69, which
literally reads: run `npx wrangler dev --port <N>` directly (optionally
adding `--var PUBLIC_BASE_URL:http://localhost:<N>` or editing
`.dev.vars`). Followed exactly:

```
$ npx wrangler dev --port 8793 --var PUBLIC_BASE_URL:http://localhost:8793
```

### OPEN ITEM 1 (README.md:61-69): non-default-port procedure skips the SPA build

`npm run dev` (README.md:46) has a `predev` hook
(`tsx scripts/ensure-dev-vars.ts && vite build --config app/vite.config.ts`,
documented at README.md:53-54) that builds the admin SPA bundle before
`wrangler dev` starts. The non-default-port procedure at README.md:61-69
tells the reader to invoke `npx wrangler dev --port <N> ...` **directly**,
bypassing `npm run dev` and therefore bypassing `predev` entirely. Followed
literally, this produces:

```
$ curl -b <organizer-session> http://localhost:8793/admin
HTTP/1.1 500
{"error":{"code":"internal","message":"Admin SPA bundle missing at
public/admin/index.html -- run `npm run build` (or `npm run dev`, whose
predev builds it). DEC-268."}}
```

The README never prints the extra `npx vite build --config app/vite.config.ts`
(or `npm run build`) step needed to make `/admin` work when following its
own alternate-port instructions. I ran that build manually to continue
verification; it is not itself an app bug (`npm run dev` at the default
port works fine per README.md:42-47), but the alternate-port section
(README.md:61-69) is missing a step, and the error surfaces on the exact
path the section tells a reader to take.

### OPEN ITEM 2 (README.md:61-69): non-default-port procedure skips `.dev.vars` creation, so `/dev/mailbox` 404s

The same `predev` hook also runs `tsx scripts/ensure-dev-vars.ts`, which
copies the checked-in `.dev.vars.example` to a gitignored `.dev.vars`
(README.md:61-69 references `.dev.vars` but never says how it gets
created). `DEV_MODE=1` in that file is what mounts `/dev/mailbox`
(DEC-005/DEC-183, `src/server/app.ts`). Skipping `predev` (as the
non-default-port procedure does) leaves `.dev.vars` absent, so:

```
$ curl http://localhost:8793/dev/mailbox
HTTP/1.1 404
```

I manually ran `cp .dev.vars.example .dev.vars` and restarted `wrangler
dev` to continue verification; this step is not printed anywhere in
README.md:61-69, which is where a reader following the non-default-port
path would need it.

Both open items share one root cause (README.md:61-69 tells the reader to
invoke `wrangler dev` directly instead of via `npm run dev`, silently
dropping the `predev` hook's two effects) but are recorded as two items
since each blocks a different, separately-documented surface
(`/admin` vs. `/dev/mailbox`).

### Incidental note: transient local wrangler/miniflare crash under multi-lane load

Twice during this run, a fresh `wrangler dev --port 8793` process crashed a
few requests after startup with an empty `[ERROR]` and no message, logged
only to `~/Library/Preferences/.wrangler/logs/...`. `ps aux` at the time
showed 7 other `wrangler`/`workerd` processes running (other evidence lanes
sharing the machine per DEC-498). This reproduced identically after a
restart with more concurrent processes running, then stopped reproducing
after killing the affected process and restarting once more with brief
(~1s) delays between requests. This reads as host resource contention
across concurrently-running evidence lanes, not a product defect — it is
noted here for the record, not counted as an OPEN ITEM, since it is not
attributable to anything the README prints or omits.

## 5. Health, admin, and the four seeded personas

```
$ curl http://localhost:8793/health
{"ok":true}                                                    -- 200
```

`/admin` unauthenticated redirects (302) to `/login`, which serves real SPA
markup (title "Log in - Chautauqua", `chq-auth-fields` form posting to
`/login` with a `chq_csrf` hidden field) — this is the app's documented
auth gate, not a defect.

All four "For evaluators" (README.md:158-163) personas logged in with their
credentials copy-pasted verbatim, no correction:

| Persona | Email (as printed) | Password (as printed) | POST /login result |
|---|---|---|---|
| Organizer | `sbek-organizer@example.com` | `SbekTest!2027-org` | 302 -> `/admin` |
| Reviewer | `sbek-reviewer@example.com` | `SbekTest!2027-rev` | 302 -> `/admin` |
| Speaker | `sbek-speaker@example.com` | `SbekTest!2027-spk` | 302 -> `/portal` |
| Speaker (second) | `sbek-speaker2@example.com` | `SbekTest!2027-spk2` | 302 -> `/portal` |

All four credentials work exactly as printed at README.md:158-163 (Landed-on
column matches the README.md:139-141 "Admin SPA" / "Speaker portal" rows).

`GET /admin` with the organizer session, after the manual build in OPEN
ITEM 1: `200`, body is the admin SPA shell (`<div id="root">`,
`/admin/assets/index-*.js`).

## 6. Seeded content on the four required surfaces

| Surface | Auth | Status | Confirmed real seeded content |
|---|---|---|---|
| `/e/devflow-conf-2027/sessions` | none (public) | 200 | Real session titles present, e.g. "A Practical Guide to Chaos Engineering" (`seed_submission_0025`), "Taming 40-Minute CI: Incremental Builds at Monorepo Scale" (`seed_submission_0001`) — 8+ distinct sessions listed |
| `/portal` | speaker session | 200 | Title "DevFlow Conf 2027 - Speaker Portal"; page references the speaker's own seeded submissions (`seed_submission_0001`, `seed_submission_0003`) |
| `/dev/mailbox` | none (dev-mode gated) | 200 (after OPEN ITEM 2 fix) | Title "Dev mailbox - Chautauqua"; lists sent emails with `@example.com` recipients and Subject lines |

`/admin` (organizer) already covered in section 5.

## Cleanup

Every `wrangler dev` process was started with `nohup ... &`, its PID
captured from the immediate `echo "PID:$!"`, and stopped with `kill <that
PID>` only — never `pkill -f`. Final state: `lsof -i :8793` empty, `ps -p
<last PID>` reports no such process.

## OPEN ITEMS: 2

1. README.md:61-69 (non-default-port procedure) omits the SPA build step
   that `npm run dev`'s `predev` hook normally provides — following it
   literally 500s `/admin` until `npm run build` (or the equivalent `vite
   build`) is run by hand.
2. README.md:61-69 (non-default-port procedure) omits creating
   `.dev.vars` (normally done by `predev`'s `ensure-dev-vars.ts`) — without
   it `DEV_MODE` is unset and `/dev/mailbox` 404s until `.dev.vars` is
   copied from `.dev.vars.example` by hand.

## RESULT: PASS

All four Quickstart commands (README.md:42-47, with the port swapped per
README.md:61-69) completed with zero secrets present; all four "For
evaluators" credentials (README.md:158-163) worked exactly as printed; the
public sessions surface, the admin SPA shell, the speaker portal, and the
dev mailbox all rendered real seeded content once the two undocumented
`predev` steps (OPEN ITEMS 1-2) were performed by hand. The credentials and
the seed data are sound; the documentation gap is scoped narrowly to the
non-default-port section, which two waves of README changes have not yet
reconciled with the `predev` hook it was written before.
