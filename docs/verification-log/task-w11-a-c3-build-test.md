# task-w11-a - build-test @ 84e2c04

FROZEN SHA: 84e2c04de087310f39877140cb6e239fab018e6c
WAVE-10 GATE: PASS
OPEN ITEMS: 1
RESULT: FAIL
RECHECK SHA: n/a

## WAVE-10 CONTENT GATE detail (all seven items present at S)

- G1 `src/routes/root.tsx` contains `res.status !== 304` — 1 match. PASS.
- G2 `.dev.vars.example` contains `PUBLIC_BASE_URL=http://localhost:8787` (1 match) AND
  `src/server/origin.ts` contains `firstLoopbackCandidate` (3 matches). PASS.
- G3 `src/routes/public/index.tsx` sets `Cache-Control: no-store` on the non-200 path
  (line 55: `c.header("Cache-Control", "no-store");`). PASS.
- G4 `src/routes/agenda.ts` contains `parseBoundedInt` (5 matches) and
  `gridMin: { min: 1, max: 480 }` (1 match). PASS.
- G5 `src/server/repo/attribution.ts` exists and contains
  `isNull(schema.participant.titleAtTime)` (1 match). PASS.
- G6 `src/routes/api/forms.ts` (409-on-dependents/answers unless `?cascade=1`, lines
  206-218) + `src/server/repo/forms.ts` (declared cascade at line 281) implement the
  409/`cascade=1` field delete. PASS.
- G7 `src/routes/api/events.ts` contains `name: "General"` at event create (1 match).
  PASS.

All seven gate items present at S on the first read; no sleep/retry loop needed.

## Worktree provenance

- `S=84e2c04de087310f39877140cb6e239fab018e6c` (= refs/heads/main at read time).
- `git worktree add --detach <scratch>/w11-a $S` succeeded; verification performed
  entirely inside that detached worktree (fresh `npm ci`, no inherited node_modules,
  no `.wrangler` directory present before migrate/seed).
- `git merge-base --is-ancestor $S refs/heads/main` confirmed (printed
  `ANCESTOR-CONFIRMED`).

## Build (`npm run build`: tsc --noEmit x2 + vite build)

Command: `tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts`

Result: PASS, zero TypeScript diagnostics from either tsconfig. Vite: 138 modules
transformed, bundle emitted to `public/admin/`. Wall time: 7.069s total (build step
13.35s user / 0.72s system / 199% cpu).

## Tests (`npm test` = `vitest run`)

Test Files: 218 passed (218)
Tests: 1823 passed (1823)
Failed: 0
Skipped: 0
Duration: 20.43s (transform 4.60s, setup 0ms, collect 54.63s, tests 25.08s,
environment 10.51s, prepare 15.38s)
Wall time (outer): 20.900s total (81.54s user / 15.47s system / 464% cpu — parallelized)

### Tripwires confirmed present and green (isolated re-run)

`npx vitest run test/docs-route-coverage.test.ts test/spa-contract-sweep.test.ts test/schema-fk-indexes.test.ts test/migration-parity.test.ts`

- test/docs-route-coverage.test.ts — 2 tests, PASS
- test/spa-contract-sweep.test.ts — 8 tests, PASS
- test/schema-fk-indexes.test.ts — 1 test, PASS
- test/migration-parity.test.ts — 1 test, PASS

Test Files: 4 passed (4); Tests: 12 passed (12); Duration: 953ms.

## bundle:check

`npm run bundle:check` PASSED. Entry bundle (index-Cre-ehTW.js + index-easpJsYc.css)
= 58.88 kB gzip against a 300.00 kB budget.

## db:migrate + seed (clean state, no carried-over `.wrangler`)

Confirmed no `.wrangler` directory existed in the worktree before running either
command (fresh clone/checkout, never previously run).

`npm run db:migrate` (`wrangler d1 migrations apply chautauqua --local`): all 18
migration files (0000_secret_matthew_murdock.sql through 0017_review_recusal.sql,
D1's own numbering has no 0011 file — not a gap introduced by this run) applied
✅, "6 commands executed successfully" on the terminal (pending) batch, then all 18
shown ✅ on the final listing pass.

`npm run seed` (`tsx scripts/seed.ts && wrangler d1 execute ... --file=.seed.sql &&
tsx scripts/seed-r2.ts`): completed with exit 0 against the freshly migrated,
previously-empty database — no SQLite constraint errors, no thrown exceptions.
`seed-r2` reported `put 8 object(s) into local R2 bucket 'chautauqua-files'`. (A
second, deliberate re-run against the now-already-seeded DB — done only to probe
idempotency, not part of the graded clean-state run — correctly failed with a
`UNIQUE constraint failed: pipeline_entry.org_id, pipeline_entry.contact_id` error;
the seed script is not idempotent by design, which is expected and out of this
section's scope to fix.)

## npm audit (DEC-302)

Plain `npm audit`: 9 vulnerabilities (6 moderate, 3 high) — form-data (CRLF
injection, devDependency of a transitive tool), lodash <=4.17.23 (high, dev-only
transitive), react-router 6.0.0-7.17.0 (moderate, app/ devDependency-tier UI
library used only in the admin SPA build, not the Worker bundle).

Verbatim `npm audit --omit=dev`:

```
# npm audit report

drizzle-orm  <0.45.2
Severity: high
Drizzle ORM has SQL injection via improperly escaped SQL identifiers - https://github.com/advisories/GHSA-gpj5-g38j-94v9
fix available via `npm audit fix --force`
Will install drizzle-orm@0.45.2, which is a breaking change
node_modules/drizzle-orm

1 high severity vulnerability

To address issues that do not require attention, run:
  npm audit fix --force
```

drizzle-orm is one of the two packages that ship in the Worker bundle (the other is
hono, which is clean in this report). Per DEC-302 this is an advisory affecting a
production dependency, which is explicitly a red that fails the section — not a
devDependency-only advisory eligible for acceptance. No `npm audit fix` /
`npm audit fix --force` was run (DEC-302 forbids lockfile churn this wave); the
fix is a breaking-change major-version bump of drizzle-orm and is out of this
section's scope to apply — it is LOGGED here as an OPEN ITEM, not fixed.

## OPEN ITEMS

1. `npm audit --omit=dev` reports drizzle-orm@0.36.4 < 0.45.2 (production
   dependency, ships in the Worker) as HIGH severity: GHSA-gpj5-g38j-94v9, SQL
   injection via improperly escaped SQL identifiers. Per DEC-302 this is a red
   that fails this section. Remediation (`npm audit fix --force`, a breaking
   drizzle-orm major bump) is out of scope for this battery-only, product-code-
   frozen wave and is left for a future wave to plan and apply.

## POST-S DELTA

(empty — `git log --oneline 84e2c04de087310f39877140cb6e239fab018e6c..refs/heads/main -- src app migrations scripts test` returned no output)
