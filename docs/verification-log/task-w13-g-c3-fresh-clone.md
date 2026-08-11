# task-w13-g - fresh-clone @ f6983e6

FROZEN SHA: f6983e66a51d23e88931ce45dac6d0374a3d5463 (S = worktree HEAD, task-w13-g branched from main)
WAVE-12 GATE: PASS (all seven anchors W1..W7 present at S, no polling needed)
DRIZZLE-ORM AT S: 0.45.2 (package.json:20 `"drizzle-orm": "^0.45.2"`; installed clone resolves to exactly `0.45.2`; drizzle-kit absent)
OPEN ITEMS: 0
RESULT: PASS
RECHECK SHA: f6983e66a51d23e88931ce45dac6d0374a3d5463 (unchanged; no delta observed between gate check and clone work)

## WAVE-12 GATE detail (DEC-314 anchors W1..W7, grepped at S = f6983e6, `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w13-g`)

- W1 (DEC-308, drizzle-orm ^0.45.2 / no drizzle-kit): `package.json:20` `"drizzle-orm": "^0.45.2"`; `grep -c drizzle-kit package.json` = 0. PRESENT.
- W2 (DEC-309, perf class budgets): `scripts/perf-smoke-lib.ts:18` `PERF_CLASS_BUDGET_MS`, `:80` `gradePerfCheck`. PRESENT.
- W3 (DEC-309, schedule.ics graded as `public` class): `scripts/perf-smoke.ts:324,329,336` `cls: "public"`. PRESENT.
- W4 (DEC-310, id-scoped agenda query): `src/server/repo/public.ts:768` `export async function getPublicAgendaByIds`, called from `src/routes/public/index.tsx:197`; `test/schedule-ics-id-scoped.test.ts` exists. PRESENT.
- W5 (DEC-311, mobile viewport/overflow fix): `src/routes/dev/mailbox.tsx:44,92` and `src/routes/docs.tsx:240` `<meta name="viewport" ...>`. PRESENT.
- W6 (DEC-311, render-sweep manifest join): `scripts/render-sweep.ts:80-81` `{ path: "/docs/api", role: "public" }`, `{ path: "/dev/mailbox", role: "public" }` inside `MOBILE_ROUTE_MANIFEST`. PRESENT.
- W7 (DEC-313/314, review split): `src/routes/review/` exists as a directory; `src/routes/review.ts` does not exist. PRESENT.

No missing anchors -> gate resolved immediately, no 60s/10x poll required.

## Fresh clone

- Clone command: `git clone /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua /private/tmp/w13-g-clone`
- Cloned HEAD: `f6983e66a51d23e88931ce45dac6d0374a3d5463` — equals S, no drift.

### README.md verbatim commands (Quickstart section), run in order, outside the repo/worktree

1. `npm i`
   - Tail: `added 366 packages, and audited 367 packages in 7s` / `4 vulnerabilities (2 moderate, 2 high)`.
   - `npm audit --omit=dev` -> `found 0 vulnerabilities` (production-dependency surface clean; the 4 flagged are devDependency-only, accepted per DEC-302).
   - `ls node_modules | grep -i drizzle` -> `drizzle-orm` only (no `drizzle-kit`).
   - Resolved `drizzle-orm` version (`node_modules/drizzle-orm/package.json`): `0.45.2`.
2. `npm run db:migrate`
   - Tail: `🚣 6 commands executed successfully.` followed by a table of all 17 migration files (`0000_secret_matthew_murdock.sql` ... `0017_review_recusal.sql`), each `✅`.
3. `npm run seed`
   - Tail: `seed-r2: put 8 object(s) into local R2 bucket 'chautauqua-files'` (preceded by successful `Upload complete.` R2 object-creation logs for resource/headshot files). No errors.
4. `npm run dev`
   - `predev` (`tsx scripts/ensure-dev-vars.ts && vite build --config app/vite.config.ts`) ran first and populated `public/admin/` (verified `ls /private/tmp/w13-g-clone/public` -> `admin`, present only after `npm run dev`, confirming the predev build step — the clone ships no committed `public/` content besides `public/.gitkeep`).
   - `wrangler dev` came up with `[wrangler:info] Ready on http://localhost:8787` and no `--var PUBLIC_BASE_URL` override (default port, default env — `.dev.vars` supplies `PUBLIC_BASE_URL=http://localhost:8787` per README's own description of `.dev.vars.example`).

### Assertions

- No committed build output: `git ls-files | grep -E '^public/|^app/dist'` -> only `public/.gitkeep`. `predev`'s `vite build` step is what populates `public/admin`.
- `GET /health` -> `200`.
- `GET /docs/api` -> `200` (15719 bytes). `GET /dev/mailbox` -> `200` (1220 bytes).
- All four README "For evaluators" persona credentials logged in via `POST /login` (form-encoded, CSRF cookie `chq_csrf` fetched from `GET /login` and echoed back as form field `chq_csrf`, per `src/auth/cookies.ts:9` + `src/server/middleware.ts`):
  - Organizer `sbek-organizer@example.com` / `SbekTest!2027-org` -> `302 Found`, `Location: /admin`, `Set-Cookie: chq_session=...`. Authed `GET /admin` (same cookie jar) -> `200`.
  - Speaker `sbek-speaker@example.com` / `SbekTest!2027-spk` -> `302 Found`, `Location: /portal`, `Set-Cookie: chq_session=...`. Authed `GET /portal` -> `200`.
  - Speaker (second) `sbek-speaker2@example.com` / `SbekTest!2027-spk2` -> `302 Found`, `Location: /portal`, `Set-Cookie: chq_session=...`. Authed `GET /portal` -> `200`.
  - Reviewer `sbek-reviewer@example.com` / `SbekTest!2027-rev` -> `302 Found`, `Location: /admin`, `Set-Cookie: chq_session=...`. Authed `GET /admin` -> `200`.
- Demo event public pages render with real content (seeded slug `devflow-conf-2027`, not `sbek-*` fixture-only shell text — corroborated against `docs/fixtures/sample-data.json` structure, not hardcoded in product code):
  - `GET /e/devflow-conf-2027/sessions` -> `200` (12060 bytes); body contains 9 rendered `.chq-card` session entries with titles, speaker names/affiliations, track chips, and scheduled times (e.g. "Taming 40-Minute CI: Incremental Builds at Monorepo Scale" / Priya Raman / Main Stage).
  - `GET /e/devflow-conf-2027/agenda` -> `200` (7425 bytes); three day headings (`2027-05-12`, `2027-05-13`, `2027-05-14`) with per-slot blocks.
  - `GET /e/devflow-conf-2027/speakers` -> `200` (6787 bytes); populated `.chq-speaker-grid` with headshots, names, affiliations, and session lists (e.g. Toni Brightwell / Software Engineer, Junction Point / "What Nobody Tells You About Release Trains").

No README command diverged from its documented behavior; no credential failed to log in. OPEN ITEMS: 0.

## POST-S DELTA

None. RECHECK SHA equals FROZEN SHA (`f6983e6`) — no commits landed on `refs/heads/main` between the WAVE-12 GATE check and the completion of the fresh-clone battery. `main` at the time of this log's own commit inside the `task-w13-g` worktree is unaffected by this task (this lane is log-only; no product code touched, and the fresh clone under `/private/tmp/w13-g-clone` was deleted after the run, per instructions).
