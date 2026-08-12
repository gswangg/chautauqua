# 2026-08-12 task-w11-f — STAGE-1 COMPLETION LEDGER (DEC-423) @ a3dbba6

Full detail for the `## 2026-08-12 task-w11-f — STAGE-1 COMPLETION LEDGER (DEC-423) @ a3dbba6` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

Log-only lane (no source changed). Full detail in
`docs/verification-log/task-w11-f-spec-audit-stage1.md`. Audited sha
`a3dbba69137120da98862b2af1091546f67c94c3` ("scribe wave 11").

Built the full DEC-423 ledger: a J1-J12 table (SPEC.md:95-181), a SPEC §5
invariants table, a SPEC §6 security table, a SPEC §7/§8 perf/deploy table
(marking stage-1-measurable vs stage-2-only rows), the SPEC §9 four-invariant
test-file table, and a DEFERRED-TO-STAGE-2 list. `npm run build` PASS; `npm
test --silent` PASS — 263 test files / 2186 tests, 0 failures.

All twelve J-rows VERIFIED with file:line citations; all SPEC §5 invariants
VERIFIED; SPEC §9's four invariants each map to a named test. Two genuine
SPEC §6 GAPs found and precisely named (both already described and
prescribed, but not yet landed in code, by `decisions/DEC-422.md`):

1. `POST /submit/:eventSlug/save-draft` (`src/routes/public/submit.tsx:
   465-508`) carries no rate limit at all, unlike its sibling
   `POST /submit/:eventSlug` (line 530-538 uses
   `checkAndIncrementScopedLimit`, scope `submit`).
2. `POST /portal/profile` (`src/routes/portal/profile.tsx:252-283`) writes
   firstName/lastName/title/company/bio/socialLinks to `contact` with no
   length cap — no `MAX_TEXT_LENGTH`/`MAX_LONG_TEXT_LENGTH` import present,
   unlike every DEC-417-covered admin route.

Also noted (documentation staleness, not a functional gap): SPEC.md:308's
literal "PBKDF2 ≥600k iterations" text is stale against the binding
`decisions/DEC-004.md` amendment (2026-08-11) that dropped iterations to
100,000 to match a hard Cloudflare Workers PBKDF2 ceiling discovered during
stage-2 deploy prep — the code correctly implements the amended decision.

`npm run deploy` correctly does not exist in `package.json` at this sha —
SPEC §0 places `wrangler deploy` under stage-2, so this is deliberate
deferral, not a stage-1 gap. Full DEFERRED-TO-STAGE-2 list in the per-task
file.

OPEN ITEMS: 4

RESULT: FAIL — two named, narrow, already-decided (DEC-422) GAPs unfixed;
everything else audited is VERIFIED with citations and build/test are
green.
