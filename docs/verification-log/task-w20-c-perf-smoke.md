# task-w20-c — perf-smoke @ 6807b67

Wave-20 seventh-generation battery (DEC-206), FROZEN sha `6807b67`,
port 8952. Summary section in `docs/verification-log.md` under the
heading `## 2026-08-10 task-w20-c — perf-smoke @ 6807b67`.

## Sha derivation (DEC-114)

Worktree cut from `main` tip `78bb286` ("scribe wave 20").

```
git diff --name-only 78bb286^ 78bb286
decisions/DEC-205.md
decisions/DEC-206.md
field-guide/index.md
src/decisions.ts
```

`src/decisions.ts` diff hunk:

```
+export const DEC_205 = "...";
+export const DEC_206 = "...";
```

Pure two-line string-constant append, no other change. All four
touched paths fall inside the DEC-114 bookkeeping-exclusion set
(decisions/**, field-guide/**, and pure-constant-append to
src/decisions.ts). `78bb286` is therefore not code-bearing; its first
parent `6807b67` ("merge task-w18-b") is the newest code-bearing sha,
matching the DEC-206 FROZEN binding exactly. No drift.

## DEC-203 preconditions

- `src/routes/api/users.ts:57` — `record.email.trim().toLowerCase()`
- `src/server/repo/users.ts:54` — `.where(sql\`lower(${schema.user.email}) = ${input.email}\`)`
- `src/index.ts` — `import { accountRoutes } from "./routes/account";` and `app.route("/", accountRoutes);`
- `src/routes/api/users.ts:79` — welcome email text has no password
  value: "Sign in at /login with the temporary password your
  organizer will share with you; you can change it at
  /account/password after signing in."

All four present.

## Fresh-state run

1. `rm -rf .wrangler`
2. `npm run db:migrate` — 14 migrations `0000`-`0013`, all applied
3. `npm run seed` — clean, 8 R2 objects uploaded
4. `npm run perf:seed` — DEC-086/DEC-088 scale, all SQL batches
   `"success": true`
5. `npx wrangler dev --port 8952` — ready
6. `PERF_URL=http://localhost:8952 npm run perf:smoke` — exit 0

## p95 table (budget 150ms)

| probe                              | p95    | status |
|-------------------------------------|--------|--------|
| submissions list (page 1)           | 12.2ms | ok     |
| submissions list (q=Kubernetes)     | 15.6ms | ok     |
| submission detail                   | 14.1ms | ok     |
| event overview                      | 15.6ms | ok     |
| organizer agenda (300 accepted)     | 27.2ms | ok     |
| public sessions page                | 3.4ms  | ok     |
| public agenda                       | 8.5ms  | ok     |
| schedule.ics 150 ids                | 41.4ms | ok     |
| plan progress (12 reviewers)        | 22.2ms | ok     |
| rating PUT                          | 12.6ms | ok     |

DEC-080 cap assertion (301-id `schedule.ics` -> 400) passed implicitly
via the clean `perf:smoke OK` exit (the script throws synchronously on
any non-400 response). Script exit code 0.

## Cleanup

`wrangler dev` stopped, port 8952 confirmed free. `.dev.vars` created
via `npx tsx scripts/ensure-dev-vars.ts` when absent (DEC-187); never
read or printed.

RESULT: PASS
