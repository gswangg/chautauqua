# task-w5-h: fresh-checkout build/test verification (post-redesign)

LOG-ONLY exit gate per DEC-384. This file records observations only; no
product, test, style, script, or config file was modified while
producing it.

Frozen main SHA at worktree creation: `cb51138f1554ce3d6d9ef2007a63d756b9702a06`
(branch `task-w5-h`, worktree at
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w5-h`).

Purpose: confirm SPEC.md section 0's stage-1 hard rule — "a fresh
checkout with no secrets present is a fully working app" — still holds
now that the redesign has added self-hosted binary fonts
(`public/fonts/*-var.woff2`) and fourteen stylesheets.

Preconditions verified before running anything:
- No `.dev.vars` present at worktree creation (only `.dev.vars.example`
  was tracked).
- No environment variables matching `cloudflare|wrangler|api_key|secret`
  present in the shell (`env | grep -iE ...` returned nothing).

## Commands, in order

### 1. `npm ci --prefer-offline --no-audit --no-fund`
Exit status: **0**
Output (tail): `added 366 packages in 4s`. No errors, no warnings of note.

### 2. `npm run build`
Exit status: **0**
Runs `tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts`.
Full output included two Vite informational (non-error) lines that are
worth recording verbatim, since they touch the exact font assets this
gate is checking:

```
/fonts/FamiljenGrotesk-var.woff2 referenced in /fonts/FamiljenGrotesk-var.woff2 didn't resolve at build time, it will remain unchanged to be resolved at runtime

/fonts/Figtree-var.woff2 referenced in /fonts/Figtree-var.woff2 didn't resolve at build time, it will remain unchanged to be resolved at runtime
```

This is expected: the fonts are referenced via absolute `/fonts/...`
URLs in CSS (self-hosted, served from `public/fonts/` at runtime by the
Workers Assets binding, not bundled by Vite), so Vite correctly leaves
them unresolved at build time. Build completed: `✓ built in 3.29s`
(admin SPA chunks all rendered), no error-level output.

### 3. `npm test`
Exit status: **0**
Result: `Test Files 244 passed (244)` / `Tests 2060 passed (2060)`.
Duration 63.04s. Only stderr content was React Router v7 future-flag
deprecation warnings (pre-existing, non-fatal, unrelated to this task).

### 4. `npx wrangler d1 migrations apply chautauqua --local`
Exit status: **0**
All 19 migrations (`0000_secret_matthew_murdock.sql` through
`0018_w18_scale_indexes.sql`) applied/confirmed with ✅ status, executed
against `.wrangler/state/v3/d1` (local only, no `--remote` flag used, no
Cloudflare account needed).

### 5. `npm run seed`
Exit status: **0**
Seeded D1 rows and put 8 objects into the local R2 bucket
`chautauqua-files` (`seed-r2: put 8 object(s) into local R2 bucket
'chautauqua-files'`). All operations targeted `local` resource location;
no remote/account access attempted.

### 6. `npm run dev` (backgrounded, then probed)
Exit status: server started cleanly, `Ready on http://localhost:8787`.
Wrangler printed the standard local-binding table (KV, EMAIL send-email
binding, D1, R2, ASSETS, plus env vars `MAIL_FROM_EMAIL`,
`MAIL_FROM_NAME`, `DEV_MODE`, `PUBLIC_BASE_URL`) — all `local` mode, no
external account or API key involved. Note: the `predev` script
(`scripts/ensure-dev-vars.ts`) auto-created `.dev.vars` from
`.dev.vars.example` before `vite build` ran; its two entries
(`DEV_MODE`, `PUBLIC_BASE_URL`) are non-secret local dev toggles, not
credentials — consistent with "no secrets present" since nothing in
`.dev.vars.example` requires an external account.

## Route probes (dev server up, via `/usr/bin/curl -s -o /dev/null -D -`)

| Path | Status | Content-Type |
|---|---|---|
| `/health` | 200 | `application/json` |
| `/` | 200 | `text/html; charset=UTF-8` |
| `/login` | 200 | `text/html; charset=UTF-8` |
| `/e/devflow-conf-2027/sessions` | 200 | `text/html; charset=UTF-8` |
| `/submit/devflow-conf-2027` | 200 | `text/html; charset=UTF-8` |
| `/dev/mailbox` | 200 | `text/html; charset=UTF-8` |
| `/fonts/FamiljenGrotesk-var.woff2` | 200 | `font/woff2` |
| `/fonts/Figtree-var.woff2` | 200 | `font/woff2` |

The two woff2 font routes — the load-bearing check for the whole
redesign, since a 404 there is invisible to every existing test suite
(no test fetches static font assets over HTTP) — both resolved 200 with
correct `font/woff2` content-type, served by the Workers Assets binding
from `public/fonts/`.

Dev server was killed after probing; no server left running.

## OPEN ITEMS

None found. No defect, gap, or unexpected condition was observed in any
of the six commands or eight route probes above. (Per DEC-384 this gate
is LOG-ONLY: had a defect been found, it would be recorded here by
name/file:line rather than fixed in this lane.)

## RESULT: PASS

All six commands exited 0; all eight route probes returned 200 with the
expected content-type, including the font pair. SPEC.md section 0's
stage-1 hard rule holds for this checkout of the redesigned app: a
fresh checkout with no `.dev.vars`/secrets present, run through
`npm ci` → `npm run build` → `npm test` → migrations → seed → `npm run
dev`, is a fully working app, fonts and stylesheets included.

## RECHECK SHA

`cb51138f1554ce3d6d9ef2007a63d756b9702a06` — unchanged from the frozen
SHA recorded at worktree creation. Confirmed via
`git -C <worktree> rev-parse HEAD` immediately before writing this file.

## POST-S DELTA

`git status --short` immediately before staging this file showed no
output (clean tree — build/test/migrate/seed/dev artifacts are all
covered by `.gitignore`: `node_modules/`, `dist/`, `public/admin/`,
`.wrangler/`, `*.log`, `/.seed.sql`, `/.perf-seed.sql`,
`/.seed-assets/`, `.dev.vars`). After adding this file, `git status
--short` shows exactly one new file:

```
?? docs/verification-log/task-w5-h-build-test-redesign.md
```

No product, test, style, script, or config file was touched.
