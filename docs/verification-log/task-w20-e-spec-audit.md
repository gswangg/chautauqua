# task-w20-e — spec-audit @ 6807b67 (detail)

See `docs/verification-log.md`, section
`## 2026-08-10 task-w20-e — spec-audit @ 6807b67`, for the full narrative.
This file exists only to match the optional-detail-doc convention used by
prior spec-audit lanes (e.g. `task-w16-d-spec-audit.md`,
`task-w15-f-spec-audit.md`); no additional content beyond the main log
section was warranted for this run.

Command transcript (verbatim, re-run against the worktree at HEAD = `78bb286`,
first-code-bearing-parent = `6807b67`):

```
$ git diff --stat 6807b67 78bb286
 decisions/DEC-205.md |  3 +++
 decisions/DEC-206.md |  3 +++
 field-guide/index.md | 60 ++++++++++++++++++++++++++--------------------------
 src/decisions.ts     |  2 ++
 4 files changed, 38 insertions(+), 30 deletions(-)

$ grep -n "toLowerCase" src/routes/api/users.ts
57:  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";

$ grep -n "lower(" src/server/repo/users.ts
54:    .where(sql`lower(${schema.user.email}) = ${input.email}`)

$ grep -n "accountRoutes" src/index.ts
4:import { accountRoutes } from "./routes/account";
41:app.route("/", accountRoutes);

$ grep -rn "DEC_201\|DEC-201\|DEC_202\|DEC-202" src/ docs/ --include="*.ts" --include="*.tsx" --include="*.md" | grep -v "^docs/verification-log" | grep -v decisions.ts
(no output)

$ grep -rln 'from "node:\|cloudflare:' src/{auth,domain,forms,mail,lib}
(no output)

$ grep -rn "process.env\|API_KEY\|SECRET" src/ wrangler.jsonc
(no output)

$ grep -n "DROP" migrations/*.sql
(no output)

$ npx vitest run test/users-api.test.ts test/account-password.test.ts --silent
 Test Files  2 passed (2)
      Tests  19 passed (19)

$ grep -n "^  - id:" docs/eval-rubric/*.yaml | wc -l
     116
```

RESULT: PASS (see main log section for full reasoning). OPEN ITEMS: 0.
