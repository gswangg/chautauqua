# task-w45-e — J11 contact directory adjudication @ 8b65b63a

File-only wave (DEC-069 w45): touched nothing under `src/**`, `app/src/**`,
`migrations/**`, `package.json`. Adjudicates four NEW claims against
SPEC.md:171-175 (J11) and SPEC.md:193-195 (§2 principle 2, volume-first).
Does not re-litigate wave 42's contacts-integrity rows
(`docs/verification-log/index/0211-...`).

## Ref-state receipt (verbatim)

```
DEC-644 three-sha boundary: HEAD `8b65b63ace26b79e23a2d19dd5b8d91a3eca9ed2`; newest first-parent product-code-bearing sha `14da2921a5be66408057712be877bc44c19de6c4`; every live ref (`main`, `manual-qa`, `task-custodian-w68-4`, `task-w44-e`, `task-w44-h`, `task-w44-i`, `task-w45-a`, `task-w45-c`, `task-w45-e`, `task-w68-d`, `task-w71-c`, `task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD via `git merge-base --is-ancestor`. NON-ancestor refs (NOT confirmed via `git merge-base --is-ancestor`): `mail-rich-shape-fallback`, `task-w17-i`, `task-w45-b`, `task-w45-d`, `task-w68-b`, `task-w68-c`, `task-w68-e`, `task-w71-a`, `task-w72-a`, `task-w72-b`, `task-w72-c`, `task-w72-d`, `task-w72-e`, `task-w72-f`, `task-w72-g`, `task-w72-h`, `task-w72-i`, `task-w72-j`.
```

`git merge --no-edit main` reported "Already up to date." — task-w45-e branched
directly off current `main`.

## Verdict table

| # | Claim | Verdict | File:line / check |
|---|-------|---------|---------------------|
| 1 | CSV import column mapping refuses a duplicate destination field | **CONFIRMED-DEFECT** | `src/domain/contacts-parts/import.ts:44-101` (`mapImportRow`). The `switch` at lines 67-91 writes `result.<field> = value` for every mapped column with no check that `target` was already assigned by an earlier column; two source columns bound to the same destination (e.g. both `"Work Email"` and `"Personal Email"` -> `email`) silently last-write-wins (whichever header column comes later in `header` wins). The *unknown*-destination half of the claim IS enforced — the `default:` branch at line 90 throws `Error('mapImportRow: unknown target field "..."')`, caught by the route (`src/routes/api/contacts/import.ts:155-160`) and surfaced as a field-named `ApiError({ mapping: ... })`. Only the duplicate-destination half is unguarded. No test in `test/contacts-import*.test.ts` or `test/import-*.test.ts` exercises a two-columns-one-field mapping. |
| 2 | Merge preview/execute preflight parity | **CONFIRMED-DEFECT** | Execute path `mergeContacts` (`src/server/repo/contacts/merge.ts:709-716`) runs the whole-operation preflight (`planMergeFold` + `detectMergeConflicts`, imported at `merge.ts:24`) BEFORE any write, refusing on `both_logins`/`email_taken` conflicts (`src/server/repo/contacts/merge-preflight.ts:39,43-59`). The preview door `GET /contacts/merge/preview` (`src/routes/api/contacts/merge.ts:41-73`) calls only `previewMerge` (pure field-diff formatting) and `repo.countMergeImpact` (submission/task counts) — it never imports or calls `planMergeFold`/`detectMergeConflicts`. A preview for a merge set that would trip a login/email conflict at execute time returns a clean `{fields, impact}` with no warning; execute then throws `ApiError("conflict", ...)`. `test/contacts-merge-preview-route.test.ts` has zero cases covering `both_logins`/`email_taken` — confirms this gap is untested, not just unimplemented-by-oversight. Separately, per-pair rechecks at `merge.ts:388-405` (login recheck) and `:410-428` (email recheck) ARE genuinely unreachable dead code given a correct whole-list preflight already ran (`planMergeFold` folds in the identical order `mergeOnePair` applies, `detectMergeConflicts` covers the same [keepId, ...mergeIds] set) — no edge found there; kept intentionally as fail-loud invariants per their own docstrings, not a defect. |
| 3 | Segments: bounded SQL predicate vs. unbounded JS materialization | **not a defect** | `src/server/repo/contacts/segments.ts` itself holds only segment-definition CRUD (list/count/find/upsert/patch/delete), no membership evaluation. Actual membership evaluation is `matchesSegment` (pure, `src/domain/contacts-parts/segments.ts:97`) applied in JS over `scanAndFilterContacts` (`src/server/repo/contacts/crud.ts:424-440`), which is org-scoped (`buildContactWhereExpr`) AND capped: `scanOrgContactRecords` (`crud.ts:394-403`) fetches `MAX_CONTACT_DIRECTORY_SCAN + 1` rows and throws `ApiError("invalid", ...)` when the true count exceeds the bound, rather than silently truncating. This is a bounded, refuse-not-truncate JS materialization (DEC-336/DEC-554), not the unscoped/unbounded case the claim tests for. |
| 4 | Per-contact history: submissions/talks/emails/events each bounded-or-paged | **CONFIRMED-DEFECT (events only)** | `src/server/repo/contacts/history.ts:54-129` (`getContactHistory`). SPEC's four nouns collapse to three actual lists in this implementation — "talks" has no separate list; submissions (which become talks once accepted) serve both roles, a narrow-interpretation call, not itself adjudicated here. Of the three real lists: `submissions` is capped at `MAX_CONTACT_HISTORY_SUBMISSIONS=20` with a separate `submissionsTotal` count (lines 54-92) — bounded-with-total, matching the idiom cited in the task (`crud.ts:255-272`'s `.slice(0,5)` + `more:` pattern, here expressed as cap+total instead of slice+more but equivalently bounded). `emails` is capped at `MAX_CONTACT_HISTORY_EMAILS=20` with a separate `emailsTotal` count (lines 94-115) — same shape, bounded. `events` (lines 119-126) is a `selectDistinct` over the full participant/submission/event join for the contact with **no `.limit()` at all** and no companion total/remainder field — an unbounded surface, neither paged nor bounded-with-affordance. `test/contacts-history-event-id.test.ts:168-215` documents the intent ("must never shrink the 'Across your events' list") but only exercises 3 events; the surface itself has no cap. |

## Targeted tests (DEC-644)

`npm run test:targeted -- test/contacts-import-plan.test.ts test/contacts-import.test.ts test/import-field-caps.test.ts test/import-row-cap-single-source.scan.test.ts test/contacts-merge-preview-route.test.ts test/contacts-import-participant-cap.test.ts test/contacts-history-event-id.test.ts`

```
Test Files  7 passed (7)
     Tests  29 passed (29)
```

RESULT: PASS — targeted suite green; adjudication complete with 3 CONFIRMED-DEFECTs (column-mapping duplicate-destination last-write-wins, merge preview/execute preflight parity gap, unbounded `events` history list) and 1 not-a-defect (segments, bounded scan+refuse).
OPEN ITEMS: 3
