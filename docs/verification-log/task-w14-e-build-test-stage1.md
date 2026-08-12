# task-w14-e: build/test and dependency-advisory closure (post-wave-13 tree)

Tree: clean checkout of `main` @ `2a089445270e5e733532bb33a934ba5734c337e5` ("scribe wave 14"),
worktree `task-w14-e`. `git status --short` empty before and after (no drift from the exercised
commands below — all state lives under gitignored `.wrangler/state`).

## 1. Build

```
npm ci --prefer-offline --no-audit --no-fund --silent   # clean node_modules, exit 0
npm run build   # tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts
```

Result: **PASS**, both `tsc --noEmit` passes produced no output (0 errors), `vite build` succeeded
(154 modules transformed, built in 705ms). Wall time for the full `npm run build` invocation:
**8.10s** (`14.95s user 0.82s system 194% cpu 8.100 total`).

SPA main-entry gz size: `public/admin/assets/index-BSzgTq9I.js` = **183.82 kB raw / 59.95 kB gz**
— well under the 300KB gz budget (20% of budget).

## 2. Tests

```
npm test --silent   # vitest run
```

Result: **PASS** — 271 test files, 2245 tests, all green, 0 failures.

```
 Test Files  271 passed (271)
      Tests  2245 passed (2245)
   Start at  04:17:51
   Duration  24.33s (transform 5.47s, setup 0ms, collect 66.84s, tests 29.22s, environment 13.93s, prepare 17.18s)
```
(`npm test --silent` wall time: 24.765s total per the `time` wrapper.)

No red tests — nothing to repair under DEC-431. Both DEC-431-relevant suites are present and
passed as-is on this tree: `test/render-sweep-contrast.test.ts` (12 tests) and
`test/render-sweep-lib.test.ts` (56 tests, confirmed via a targeted re-run:
`npx vitest run test/render-sweep-lib.test.ts` → 56/56 passed). No flipped constant contradicted
an assertion in either file, so there is nothing to attribute or repair for this wave.

Several tests print expected stderr from intentionally-simulated mailer failures (DEC-238 class
1/2 taxonomy tests: `comms-send-mailer-failure`, `contacts-bulk-email-mailer-failure`,
`tasks-due-reminders-mailer-failure`, `tasks-remind-now-mailer-failure`,
`users-create-mailer-failure`) — these are asserted-expected console output from the test's own
injected `Error: simulated provider rejection/outage`, not failures.

## 3. DEC-429 dependency-advisory pass

`npm audit --json` on this tree: `{"info":0,"low":0,"moderate":2,"high":2,"critical":0,"total":4}`,
grouped into 4 named packages. Classified below, each exactly once, by `npm ls <pkg>` walking the
dependency graph to its consumer(s):

- **form-data@4.0.5** (via `jsdom@25.0.1`, a `devDependency`) — HIGH,
  GHSA-hmw2-7cc7-3qxx (CRLF injection via unescaped multipart field/filename). **devDependency-only.**
  `jsdom` is a Vitest/Testing-Library-only DOM shim used exclusively in the `test`/render smoke
  suites (`app/src/**/*.render.test.tsx`) run under `vitest run`; it is never imported by
  anything under `src/**` (the Worker) or `app/src/**` non-test code, never bundled by
  `vite build` into `public/admin/assets/*`, and never present in the deployed Worker's module
  graph (`src/index.ts` has no transitive import path to `jsdom` or `form-data`). It cannot reach
  the deployed Worker.

- **lodash@4.17.21** (via `@testing-library/jest-dom@6.6.3`, a `devDependency`) — HIGH
  (GHSA-r5fr-rjxr-66jc, `_.template` code injection) + 2x MODERATE (GHSA-f23m-r3pf-42rh,
  GHSA-xxjr-mmjv-4gpg, prototype pollution via `_.unset`/`_.omit`). **devDependency-only.**
  `@testing-library/jest-dom` supplies vitest/jest DOM matchers (`toBeInTheDocument`, etc.) used
  only in `*.render.test.tsx` files' `expect()` calls; it is not imported by any non-test source
  file and is not part of the `vite build` output or the Worker bundle. Cannot reach the deployed
  Worker.

- **react-router@6.30.4** (transitive dep of `react-router-dom@6.30.4`, itself a `devDependency`
  in `package.json` at line 35) — MODERATE, GHSA-wrjc-x8rr-h8h6 (open redirect via backslash in
  `<Link>`/`useNavigate`) + GHSA-337j-9hxr-rhxg (arbitrary constructor injection via
  `deserializeErrors()` in SSR hydration, N/A — this app does no SSR/hydration, it's a pure CSR
  SPA served as static assets). **Runtime dependency (browser-side, not Worker-side).**
  `react-router-dom` is imported directly by `app/src/App.tsx` and most `app/src/pages/*.tsx`
  files and IS bundled by `vite build` into `public/admin/assets/index-*.js`, which the Worker
  serves as a static asset and end-users execute in-browser. It never runs inside the Worker's V8
  isolate (the Worker's own `src/index.ts` module graph has no import of `react-router-dom`), so
  it cannot affect server-side authz/data-scoping, but its code does ship to and execute in
  browsers as part of the production admin/portal SPA — the open-redirect surface (GHSA-wrjc-x8rr)
  is real for that context (requires attacker-controlled backslash-prefixed URL reaching a `<Link
  to>`/`navigate()` call, which this app's routes construct internally rather than from unsanitized
  user input, but the library-level fix is still a legitimate hardening item). A fix costs a
  `react-router-dom` bump to `>=7.18.0` (major version bump, v6->v7): would require re-verifying
  every `useNavigate`/`<Route>`/`<Routes>` call site across `app/src/pages/**` and
  `app/src/App.tsx` against v7's API surface (data-router APIs, loader/action patterns are
  optional but route-matching and `<Link>`/`useNavigate` signatures may shift) plus a re-run of
  the full render-smoke suite; out of scope for this log-only build/test wave — flagged for a
  scoped dependency-bump task.

- **react-router-dom@6.30.4** (direct `devDependency`, package.json line 35, `^6.28.0`) —
  MODERATE, GHSA-jjmj-jmhj-qwj2 (open redirect leading to XSS, range `>=6.30.2 <=6.30.4` — this
  exact installed version is in-range). **Runtime dependency (browser-side, not Worker-side)** —
  same classification and cost as `react-router` above (it's the direct dependency that pulls in
  `react-router`; the fix is the same single `react-router-dom` major bump to `>=7.18.0`).

All 4 advisories classified exactly once; none carried forward unclassified.

## 4. Stage-1 hard rule proof (SPEC.md:42-46) — `wrangler dev` boots with no secrets beyond `.dev.vars`

`.dev.vars` does not exist in the repo (gitignored); it was materialized locally from the
committed `.dev.vars.example` (via `scripts/ensure-dev-vars.ts`, which `npm run predev` runs
automatically, and which `test/wrangler-config.test.ts` also exercises) — contents:
`DEV_MODE=1`, `PUBLIC_BASE_URL=http://localhost:8787`. No `AIRTABLE_TOKEN`, `EMAIL` secret, or
`MAIL_FROM_EMAIL` override is present anywhere in `.dev.vars`/`.dev.vars.example`; `MAIL_FROM_EMAIL`
in `wrangler.jsonc`'s `vars` block (`hello@chautauqua.cc`) is a non-secret plaintext var, not a
credential.

Ran `npm run db:migrate` (applies all 18 migrations cleanly) then `npm run dev` (= `wrangler dev`,
after the `predev` vite build). Booted clean:

```
Using secrets defined in .dev.vars
env.EMAIL (unrestricted)  Send Email  local
env.DEV_MODE ("(hidden)")  Environment Variable  local
[wrangler:info] Ready on http://localhost:8787
```

Route checks (`curl -s -o /dev/null -w "%{http_code}"`):

| route | status | note |
|---|---|---|
| `/admin` | 302 → `/login` | expected: unauthenticated admin shell redirects to login (auth gate reachable, no crash) |
| `/portal` | 302 → `/login` | same, portal shell |
| `/dev/mailbox` | 200 | dev mailbox route mounts (DEV_MODE=1 per DEC-183) |
| `/submit/<unknown-slug>` | 404 `Event not found.` | clean handled 404, not a 500 — route logic runs |
| `/submit/<real-slug>` | 200 | after `npm run seed`, hit `/submit/devflow-conf-2027` (seeded event slug) for a full-path 200 confirmation |

Confirmed via `src/server/context.ts:makeMailer` that the boot/request path only reads
`env.MAIL_FROM_EMAIL` inside the `env?.EMAIL && !env.DEV_MODE` branch — with `DEV_MODE=1` set,
that branch never executes, so `MAIL_FROM_EMAIL` is never read at runtime in dev; it falls through
to `DevSinkMailer`. `AIRTABLE_TOKEN` is read only in `src/sync/airtable.ts` (an explicit sync
action, never invoked from the boot/request path for `/admin`, `/submit/<slug>`, `/portal`, or
`/dev/mailbox`) and is absent from `wrangler.jsonc` entirely, so it is `undefined` — no read of a
credential value occurs anywhere in the exercised boot/request path.

Verified no stray secrets: `.dev.vars` (gitignored, git-untracked) contains only `DEV_MODE` and
`PUBLIC_BASE_URL`, both non-secret. Server process killed after verification
(`pkill -f "wrangler dev"`); `git status --short` in the worktree remained empty throughout (D1/R2
local state lives under gitignored `.wrangler/state`).

## 5. Open items for the ledger

- FAIL-unowned: none. Build and full test suite are green on this tree; nothing to attribute.
- PENDING-OWNED: `react-router`/`react-router-dom` moderate advisories (GHSA-wrjc-x8rr-h8h6,
  GHSA-337j-9hxr-rhxg, GHSA-jjmj-jmhj-qwj2) — a v6→v7 major bump, scoped task, not owned by any
  landed DEC in this wave. No branch assigned; flagged here for planner triage.

## 6. Test/build byproducts (not committed)

`npm run db:migrate` and `npm run seed` were run locally in this worktree purely to exercise the
`wrangler dev` boot-path proof in step 4; both operate on gitignored `.wrangler/state` and left no
tracked-file diff (`git status --short` confirmed empty before commit).
