# 2026-08-10 task-w20-d — render-sweep @ 6807b67

Full detail for the `## 2026-08-10 task-w20-d — render-sweep @ 6807b67` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

DEC-206 seventh-generation battery lane (render-sweep, DEC-144/
DEC-139), bound to FROZEN sha `6807b67` per DEC-206 with a hard
drift-stop (no rebinding on drift).

**DEC-114 sha check.** Worktree branched from `main` at `78bb286`
("scribe wave 20"). `git diff --stat 6807b67 78bb286` shows only
`decisions/DEC-205.md`, `decisions/DEC-206.md`, `field-guide/
index.md`, and `src/decisions.ts` (2 lines: the `DEC_205`/`DEC_206`
constant strings) changed since `6807b67` — no `src/`, `app/src/`,
`scripts/`, `test/`, or migration changes. Per DEC-205's own text
("newest code-bearing sha = 6807b67"), the newest code-bearing sha is
`6807b67`, matching this task's FROZEN binding. No drift — proceeded.

**DEC-203 precondition greps**, all present: `src/routes/api/
users.ts:57` `record.email === "string" ? record.email.trim()
.toLowerCase() : ""`; `src/server/repo/users.ts:54` `lower(${schema
.user.email})` in the lookup query; `src/index.ts` imports
`accountRoutes` from `./routes/account` and mounts it via `app.route
("/", accountRoutes)`; the welcome-email text in `src/routes/api/
users.ts` (`generatePassword`/`hashPassword` flow) never includes the
one-time password in the emailed copy — it reads "Sign in at /login
with the temporary password your organizer will share with you; you
can change it at /account/password after signing in" (password value
is returned only in the API JSON response for organizer-side reveal,
consistent with DEC-200). No precondition miss.

**Dedupe check.** No prior ledger section matches the full heading
`render-sweep @ 6807b67` — proceeded with a fresh run (homonym guard:
dead `task-w19-*`/`task-w20-*` sections `@ 8c7f479` do not carry this
suffix and were not cited or reused).

**Execution.** In-worktree run (not a fresh detached worktree, but
verified code-identical to `6807b67` above): `npm ci --prefer-offline
--no-audit --no-fund --silent` (node_modules already present, skipped
per guard), `npm run build` (tsc + app tsc + vite build) clean.
`rm -rf .wrangler`, `npm run db:migrate` (13/13 migrations applied
clean), `npm run seed` (535 statements + 8 R2 assets) both succeeded
as a state sanity check; `npm run gate:render-sweep` was then run
separately with a second `rm -rf .wrangler` first, since the gate
script performs its own internal migrate+seed cycle against a fresh
`.wrangler/state` and the two migrate+seed passes conflict (UNIQUE
constraint on `pipeline_entry`) if run back to back against the same
state — this is a gate-script property, not a code defect, and no
product code was touched. `.dev.vars` was never read or printed;
`ensure-dev-vars.ts` created it internally from `.dev.vars.example`.
The gate self-allocated its own local port (58178 this run, per
DEC-189(5), not 8951/8952), logged in as organizer/reviewer/speaker
via the real `/login` form with seeded credentials, and walked every
`app/src/routeManifest.ts` entry.

**Result table:** all 31 routes PASS (organizer: /admin/overview,
/admin/submissions, /admin/submissions/forms, /admin/submissions/
seed_submission_0001, /admin/speakers, /admin/content, /admin/agenda,
/admin/comms, /admin/contacts, /admin/settings, /admin/review,
/admin/review/plans/new, /admin/review/plans/
seed_evaluation_plan_0001, .../progress, .../results, /admin/*;
reviewer: /admin/review, /admin/review/plans/
seed_evaluation_plan_0001, .../submissions/seed_submission_0002;
speaker: /portal, /portal/submissions/seed_submission_0001, .../edit,
/portal/profile, /portal/tasks, /portal/tasks/
seed_task_assignment_0001/form; public: /e/devflow-conf-2027/sessions,
.../speakers, .../gallery, .../agenda, .../schedule, /submit/
devflow-conf-2027) — zero console/pageerror events collected across
all routes.

**Coverage gap — `/account/password`.** `src/routes/account.tsx`
(DEC-200) is new since the last verified sweep. `app/src/
routeManifest.ts` is a static, hand-enumerated list (documented as
derived from `App.tsx`/`Review.tsx`/`src/routes/portal/*`/
`public.tsx`/`public/submit.tsx`) and does **not** include any
`/account*` entry — `grep -n "account" app/src/routeManifest.ts`
returns no matches. The sweep therefore does **not** cover `/account/
password`. Per this task's instructions the script was not edited;
instead, compensating manual evidence was collected: with a standalone
`wrangler dev` booted on port 58311 against the same seeded local
state, `curl -s -o /dev/null -w "status=%{http_code}
redirect=%{redirect_url}\n" http://localhost:58311/account/password`
returned `status=302 redirect=http://localhost:58311/login`, and the
raw response (`curl -i`) showed `HTTP/1.1 302 Found` /
`Content-Length: 0` / `Location: /login` — a clean anonymous redirect
to `/login` with no error body, which is the expected render for an
unauthenticated GET of a session-gated account route. This is
compensating evidence only, not a substitute for the automated sweep;
the manifest gap itself remains open (see below).

**OPEN ITEMS: 1** — `app/src/routeManifest.ts` does not include
`/account` or `/account/password`, so the automated render-sweep gate
does not exercise DEC-200's new account routes (authenticated
password-change form render is unverified by this gate; only the
anonymous-redirect case was manually spot-checked). Recommend a future
task add `/account/password` (organizer/reviewer/speaker role,
authenticated) to the manifest — out of scope for this verification-
only lane to fix.

**RESULT: PASS — 31/31 swept routes green, zero console/page errors;
manifest coverage gap for `/account/password` noted and compensated
with manual curl evidence (anonymous 302 to /login)**
