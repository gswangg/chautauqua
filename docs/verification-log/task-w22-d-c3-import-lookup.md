# task-w22-d: CSV import file-keyed contact lookup (DEC-356)

FROZEN SHA (base): 24155d94b6020e807970bb37b4959a00687cc1ec

## What changed

`src/server/repo/contacts/import.ts` (`applyImportRows`):

- Removed the unconditional `select ... from contact where org_id = ?` that
  loaded every contact row of the org before applying a single import row.
- Replaced it with a pre-pass that collects the distinct normalized
  (trim + toLowerCase) emails present in the parsed rows, then loads
  `select id, email from contact where org_id = ? and lower(email) in (...)`
  chunked via `chunkIds` (`src/lib/chunk.ts`, `ID_CHUNK_SIZE = 90`,
  DEC-078), seeding the same `byEmail` map the row loop already used.
- Rows with a missing/blank email still skip with the same reason/line.
  `byEmail` is still updated on create (unchanged from the prior `:64`
  behavior) so within-file duplicate emails collapse onto the same created
  contact.
- Added `export const MAX_IMPORT_ROWS = 2000`. `applyImportRows` now throws
  `ApiError("invalid", ..., { csvText: "Too many rows" })` before any DB
  work when `rows.length > MAX_IMPORT_ROWS`.
- `resolveImportUpsert`, `createContact`/`patchContact`, the created/updated
  counters, the skipped list, and the `ImportResult` shape (including
  `contactIds` order/dedup) are unchanged.
- `src/routes/api/contacts.ts:391`'s call to `repo.applyImportRows` is
  unchanged in call shape (per the task note, not edited).

## Tests

- `test/contacts-import-scale.test.ts` (new): counting in-memory fake `Db`
  (real eq/and/or/inArray/lower semantics) directly exercising
  `applyImportRows`:
  - proves the email pre-pass issues `ceil(distinctEmails / ID_CHUNK_SIZE)`
    chunked lookups and zero unfiltered org-wide contact selects, for a
    file with `ID_CHUNK_SIZE * 2 + 20` distinct emails (3 chunks);
  - proves a file over `MAX_IMPORT_ROWS` is rejected (`ApiError` with
    `code: "invalid"`, `status: 400`) before any `db.select` call;
  - proves within-file duplicate emails (case/whitespace variants) still
    collapse onto one created contact (`created: 1`, `updated: 2`,
    `contactIds` length 1);
  - proves missing/blank-email rows still skip with the same reason/line.
- `test/contacts-import.test.ts` (existing, route-level P1 regression):
  assertions unchanged; its fake-db `drizzle-orm` mock was extended to
  also model `inArray` and `sql\`lower(...)\`` (previously only
  `eq`/`and`/`or`) so it can evaluate the new query shape structurally.
  All 3 existing assertions still pass unmodified.
- `test/contacts-roster-import.test.ts`, `test/contacts.test.ts`,
  `test/csv.test.ts`: unmodified, all green.

## Build / test results

- `npm run build`: PASS (tsc --noEmit x2 + vite build, no errors).
- `npm test` (full suite): PASS — 231 test files, 1934 tests, 0 failures.

## OPEN ITEMS: 0

## RESULT: PASS
