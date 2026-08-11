# task-w20-a — build+test detail @ 6807b67

Verification-only lane (DEC-206, DEC-205, DEC-197, DEC-114, DEC-068).
Summary section lives in `docs/verification-log.md` under the heading
`## 2026-08-10 task-w20-a — build+test @ 6807b67`; this file holds raw
command output excerpts for reference only.

## Sha derivation (DEC-114)

```
git log --first-parent --oneline -5 main
78bb286 scribe wave 20
6807b67 merge task-w18-b
668acc6 scribe wave 19
a85ddcc merge task-w18-a
5bcffb2 scribe wave 18

git diff --name-only 6807b67 78bb286
decisions/DEC-205.md
decisions/DEC-206.md
field-guide/index.md
src/decisions.ts
```

`src/decisions.ts` diff between 6807b67 and 78bb286 is exactly two
appended `export const DEC_205 = ...` / `export const DEC_206 = ...`
string literal lines — no other code changed. All four changed paths
fall in DEC-114's excluded set (decisions/, field-guide/, and a
string-append-only src/decisions.ts diff). Newest code-bearing sha =
`6807b67`. Matches the FROZEN battery binding; no drift, no stop.

## Precondition greps (DEC-203) at 6807b67

```
git show 6807b67:src/routes/api/users.ts | grep -n "toLowerCase"
57:  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";

git show 6807b67:src/server/repo/users.ts | grep -n "lower("
54:    .where(sql`lower(${schema.user.email}) = ${input.email}`)

git show 6807b67:src/index.ts | grep -n "accountRoutes"
4:import { accountRoutes } from "./routes/account";
41:app.route("/", accountRoutes);

git show 6807b67:src/routes/api/users.ts | grep -n "/account/password"
79:    const text = `An account has been created for you.\n\nEmail: ${created.email}\n\nSign in at /login with the temporary password your organizer will share with you; you can change it at /account/password after signing in.`;
```

The `text` template interpolates only `created.email`, not the
plaintext password — the password appears solely in the JSON API
response (`password` field), not in the email body. All four
preconditions satisfied.

## Build

Run in a detached worktree checked out at `6807b67`
(`chautauqua-wt/task-w20-a-verify`, removed after use — this lane's own
worktree touches nothing but the verification-log files):

```
npm run build
> tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts
...
✓ built in 735ms
```

Clean, zero errors.

## Test

```
npm test --silent
...
 Test Files  155 passed (155)
      Tests  1390 passed (1390)
   Duration  14.96s
```

`test/account-password.test.ts` present and passing.
`test/users-api.test.ts` contains and passes the `DEC-199 email case
normalization + login regression` describe block (line 169).
`test/auth.test.ts` (21 tests) passed green within the full-suite run,
including all three `POST /login rate limiting (DEC-180)` cases —
the known concurrency flake did not manifest on this run, so the
DEC-197/DEC-206 solo-rerun protocol was not invoked.

## bundle:check

```
npm run bundle:check
Entry bundle: index-BcvmMKms.js + index-easpJsYc.css = 58.87 kB gzip (budget 300.00 kB)
bundle:check PASSED
```

## Result

PASS. 0 open items.
