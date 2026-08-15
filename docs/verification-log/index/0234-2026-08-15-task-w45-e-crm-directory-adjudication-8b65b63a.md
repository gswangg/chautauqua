## 2026-08-15 task-w45-e — crm-directory adjudication @ 8b65b63a

QUALIFYING (advisory to the DEC-069 predicate — this scope classifies to none of the five slots)

INVALIDATED BY: src/** app/src/** migrations/** package.json

```
DEC-644 three-sha boundary: HEAD `8b65b63ace26b79e23a2d19dd5b8d91a3eca9ed2`; newest first-parent product-code-bearing sha `14da2921a5be66408057712be877bc44c19de6c4`; every live ref (`main`, `manual-qa`, `task-custodian-w68-4`, `task-w44-e`, `task-w44-h`, `task-w44-i`, `task-w45-a`, `task-w45-c`, `task-w45-e`, `task-w68-d`, `task-w71-c`, `task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD via `git merge-base --is-ancestor`. NON-ancestor refs (NOT confirmed via `git merge-base --is-ancestor`): `mail-rich-shape-fallback`, `task-w17-i`, `task-w45-b`, `task-w45-d`, `task-w68-b`, `task-w68-c`, `task-w68-e`, `task-w71-a`, `task-w72-a`, `task-w72-b`, `task-w72-c`, `task-w72-d`, `task-w72-e`, `task-w72-f`, `task-w72-g`, `task-w72-h`, `task-w72-i`, `task-w72-j`.
```

Adjudication-only lane (DEC-069/DEC-099/DEC-068/DEC-358/DEC-644 w45). FILE, NEVER FIX — no product code touched. Full verdicts, citations and targeted-test counts: `docs/verification-log/task-w45-e-crm-directory-adjudication-8b65b63a.md`.

| # | Claim | Verdict |
|---|-------|---------|
| 1 | CSV import: duplicate-destination column mapping refused | CONFIRMED-DEFECT (`src/domain/contacts-parts/import.ts:44-101`, silent last-write-wins) |
| 2 | Merge preview/execute preflight parity | CONFIRMED-DEFECT (`src/routes/api/contacts/merge.ts:41-73` preview never runs `planMergeFold`/`detectMergeConflicts`) |
| 3 | Segments: bounded SQL predicate vs. unscoped JS materialization | not a defect (`src/server/repo/contacts/crud.ts:394-403,424-440`, org-scoped + `MAX_CONTACT_DIRECTORY_SCAN` refuse-not-truncate) |
| 4 | Per-contact history: submissions/talks/emails/events bounded-or-paged | CONFIRMED-DEFECT (`src/server/repo/contacts/history.ts:119-126`, `events` unbounded `selectDistinct`, no limit/total) |

Targeted: `npm run test:targeted -- test/contacts-import-plan.test.ts test/contacts-import.test.ts test/import-field-caps.test.ts test/import-row-cap-single-source.scan.test.ts test/contacts-merge-preview-route.test.ts test/contacts-import-participant-cap.test.ts test/contacts-history-event-id.test.ts` — 7 files, 29 tests, all passed.

RESULT: PASS — adjudication complete, 3 CONFIRMED-DEFECTs filed, 1 not-a-defect settled with citation.
OPEN ITEMS: 3
