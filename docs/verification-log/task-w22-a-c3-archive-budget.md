# task-w22-a: DEC-353 bulk ZIP archive memory budget

FROZEN SHA (base, main @ start): 24155d94b6020e807970bb37b4959a00687cc1ec

## What changed

1. `src/server/repo/files-library.ts`: `resolveLatestVersions` now also
   selects `schema.file.sizeBytes` in both its per-id and per-submission
   file queries, and its returned record type (and the `RequestedFileRow`
   internal interface) carries `sizeBytes: number`. Still strictly a
   per-id / per-submission-id bounded load (DEC-344) — no whole-event
   scan added.
2. `src/routes/files.ts`: added
   `export const ARCHIVE_MAX_TOTAL_BYTES = 40 * 1024 * 1024;` next to
   `MAX_ARCHIVE_FILES`. In `POST /api/v1/events/:eventId/files/archive`,
   after `resolveLatestVersions` resolves all requested ids and BEFORE the
   first `store.get(...)` call, the route sums `sizeBytes` over the
   resolved latest versions. If the sum exceeds `ARCHIVE_MAX_TOTAL_BYTES`
   it throws `ApiError("invalid", ...)` with a message naming both the
   request total (in MB) and the cap (in MB), fields
   `{ fileIds: "Too large" }`, and zero R2 gets are issued before the
   throw. No truncation, no partial archive, no silent skip. The 50-id
   cap and `parseBoundedIdArray` (DEC-182) are unchanged.
3. `src/lib/zip.ts`: `ByteWriter` gained an `append(other: ByteWriter)`
   method that moves another writer's chunks onto itself (no copy).
   `buildZip` now calls `body.append(central); body.append(eocd);` and
   returns `body.toUint8Array()` — a single materialisation instead of
   three (`out.bytes(body.toUint8Array())`,
   `out.bytes(central.toUint8Array())`, `out.bytes(eocd.toUint8Array())`,
   then `out.toUint8Array()`). Byte layout emitted is identical — only the
   assembly path changed. `test/zip.test.ts` assertions were not touched
   and still pass unmodified.
4. `src/routes/files.ts` (attempted, then reverted): tried narrowing
   `buildZip`'s return so the route's second copy
   (`new Uint8Array(built.length); zip.set(built);`) could be dropped.
   `tsc --noEmit` rejects `Uint8Array<ArrayBufferLike>` (buildZip's actual
   inferred return type, since `ByteWriter.toUint8Array()`'s `new
   Uint8Array(this.length)` is generically typed as
   `Uint8Array<ArrayBufferLike>` in this TS/lib version) being passed
   where Hono's `c.body` needs `Uint8Array<ArrayBuffer>` — `SharedArrayBuffer`
   is a member of `ArrayBufferLike` and isn't assignable to `ArrayBuffer`.
   Per the task's explicit fallback instruction, the copy at
   `files.ts` was kept (now inline right after `buildZip`, with a comment
   explaining why), rather than weakening any type.
5. Tests: `test/files-archive-route.test.ts`'s mocked `resolveLatestVersions`
   now returns `sizeBytes` on each resolved entry (was missing the field
   entirely, which would have summed to `NaN` and silently never tripped
   the new budget check — fixed so the existing route test suite stays a
   faithful mock of the real repo function's shape).
   New `test/files-archive-budget.test.ts`:
   - asserts a 400 `{error:{code:"invalid", message, fields:{fileIds:"Too
     large"}}}` envelope when the resolved total (50MB via two entries,
     one exactly at the cap) exceeds `ARCHIVE_MAX_TOTAL_BYTES`, and that
     the fake R2 bucket's `get` was called zero times;
   - asserts a small multi-file (3 entries) request under budget still
     returns 200 `application/zip` and issues one `get` per file.

## Build / test results

- `npm run build` — PASS (tsc --noEmit x2 + vite build), no errors.
- `npm test` — PASS: 231 test files, 1932 tests, 0 failures (includes
  `test/zip.test.ts`, `test/files-archive-route.test.ts`,
  `test/files-library.test.ts`, `test/files.test.ts`, and the new
  `test/files-archive-budget.test.ts`).

## Open items

None.

RESULT: PASS
