# Wave 72 receipts (docs-only lane, task-w72-p)

Runtime: `main` at `b2fe1367e4b81b5adb9343da7e352a89d847d658` in this
worktree at the time of this read. Per DEC-069 wave 72 is a CODE wave, so
this lane files no `docs/verification-log/index/` section — this file
and the rebuilt `docs/eval-findings/06-in-flight.md` are the whole
deliverable. Every citation below was re-derived against that tip, not
copied from the planner's brief; line numbers are noted where they
drifted.

## Section 1 — new findings this wave

1. **DEC-083 wave-70 blast-radius ruling landed in the DEC and in
   neither of the two other files it named.** The wave-70 amendment on
   `decisions/DEC-083.md` ruled the instance-wide `PUBVER_KEY` blast
   radius be "recorded beside that window, in the same three places the
   staleness bound lives (this DEC, the pubcache header, AUDIT)." Verified
   at this runtime: `decisions/DEC-083.md` itself now carries a wave-72
   amendment (`decisions/DEC-083.md:25`) that reaches the same verdict
   independently — the DEC text states the bound, but `src/server/
   pubcache.ts`'s header (`:1-54`, checked this wave) states only the
   ~60s KV version-read staleness window and the signed-in-cookie bypass,
   never mentioning `PUBVER_KEY = "chq:pubver"` (`:66`) is one key for
   the whole instance or that `bumpIfMutating` (`:433-436`) rewrites it
   on ANY successful non-`NEVER_PUBLIC` mutation. `docs/AUDIT.md` carries
   neither bound — `grep -in "cache\|purge\|staleness\|version"
   docs/AUDIT.md` returns exactly one line (`:100`, an unrelated
   "version history" UI-copy sentence). An amendment is not an
   implementation: the ruling's own three-place instruction is honored in
   one of the three places at this runtime. STILL OPEN in `pubcache.ts`
   and `AUDIT.md` — do not re-file the DEC.md coverage, do not
   re-architect `PUBVER_KEY`.

2. **Six-site display-name population ignores `user.name`; its single
   reader is `src/server/repo/users.ts:53`.** `toOrgUserRecord`
   (`src/server/repo/users.ts:46-56`) reads `row.name` at line 53 into
   `OrgUserRecord.name`, consumed by `listUsers` — the only reader of the
   column found in `src/`. Six independent display-name ladders never
   consult it, each re-deriving a name from `contactId` and/or `email`:
   `src/server/repo/pipeline.ts:83-90` (`resolveAuthorName`, falls back
   to the literal `"Unknown"` at `:90` — confirmed present verbatim this
   wave), `src/server/repo/review/users.ts:40-` (`batchUserDisplayNames`,
   contactId-then-org-scoped-email, never `user.name`),
   `src/server/repo/files-comments.ts:188-193` and `:313-317`
   (`listFileComments`/`listFileCommentsForFiles`, identical
   `authorContactId -> user.contactId -> user.email` ladder, both throw
   rather than fall back to "Unknown"), and `src/routes/me.ts:21-` (`GET
   /api/v1/me` selects `contact.firstName`/`lastName` joined on
   `user.contactId`, never `user.name`). Six answers to "what is this
   person called?", one column none of them read. STILL OPEN.

3. **Clear-path holes outside settings, re-confirmed this wave at their
   corrected paths** (the mandate brief's paths were off by directory —
   re-derived by `find`, not trusted from the brief):
   - `app/src/pages/review/ResultsTable.tsx:140,187` — `setError(...)` in
     two independent `.catch()` blocks (plan load, results fetch);
     `grep -n setError` on the whole file returns only these two lines —
     no clear anywhere, including on a subsequent successful load.
   - `app/src/pages/comms/RecentSends.tsx:61` — same shape, one
     `setError` in a `.catch()`, no clearing call found in the file (the
     per-batch `recipients` map at `:239/:244` is a different state and
     is correctly cleared on success there — the page-level `error` at
     `:51` is not).
   - `app/src/components/EventSwitcher.tsx:187` — `setError(...)` in the
     events-list `.catch()`; no clearing call in the file.
   - `app/src/lib/useCurrentEvent.ts:71,78` — `setError('No events exist
     yet.')` and `setError(err instanceof ApiError ? ... )`; the hook
     never calls `setError(undefined)` anywhere, including on the
     self-heal/reconcile success path at `:100-105`.
   Same shape as DEC-856's settings-panel fix (wave 71): grep the CLEAR,
   not the set. STILL OPEN, four more sites beyond the three settings
   panels and `TracksRoomsPanel`/`ResultsTable`(comms/pipeline) already
   fixed.

4. **Branch/amendment namespace collision forced this wave onto
   `-k..-p`.** `.git/refs/heads/` (loose, the only refs this wave read)
   already held `task-w72-k`, `-l`, `-m`, `-n`, `-o` at plan time, so this
   lane is `task-w72-p`. Separately, `.git/packed-refs` (read once here
   only to confirm the collision, never for census content) carries
   `task-w71-a/-c/-d/-e` and `task-w72-a` through `task-w72-j` from an
   interleaved earlier campaign, and that campaign's amendments already
   sit on `decisions/DEC-889.md`, `DEC-989.md`, `DEC-033.md`,
   `DEC-874.md`, `DEC-900.md`, `DEC-825.md`, `DEC-571.md`, `DEC-021.md`,
   `DEC-369.md` as `## Amendment (wave 72)` headings (per the wave-72
   field-guide entry — not independently re-confirmed this task, out of
   scope). This lane filed only on `DEC-358` (this file) and touched no
   other DEC.

## Section 2 — closures the field guide records as landed by wave-70/71
## receipts files that do not exist on disk, re-read at this runtime

`docs/eval-findings/12-wave70-receipts.md` and
`docs/eval-findings/13-wave71-receipts.md` — the former does not exist on
disk at this runtime (`ls docs/eval-findings/` confirms); the latter
exists and IS on `main` (via `task-w71-j`, already an ancestor — see
`06-in-flight.md`'s note). Re-reading the four rows the field guide's w70
receipts line claims were closed at `5305cc7c`:

1. **Submit-post contact rollback (DEC-713).** CLOSED, confirmed at this
   runtime. `src/routes/public/submit-post.tsx:390-414` (R2-upload
   rejection path) and `:448-477` (DB-write-phase catch) both delete the
   freshly-minted contact (`contactIsFresh` guard, `:396` and `:461`)
   before best-effort R2 cleanup and the budget refund. Full rollback
   unit, both failure paths.

2. **Auth-claim insert-then-consume ordering (DEC-064 wave-66
   amendment).** CLOSED, confirmed at this runtime. `git log --all
   --oneline --grep="insert-then-consume"` finds commit `415441dc`
   ("auth-claim: insert-then-consume so a failure the speaker can't
   influence never burns their claim link"), and `git merge-base
   --is-ancestor 415441dc main` returns true — it is on `main`.
   `src/routes/auth-claim.tsx` now inserts the user row before consuming
   the KV grant.

3. **DEC-817 `api*`-verb scan gap.** CLOSED, confirmed at this runtime.
   `test/spa-mutation-contract.scan.test.ts:340`: `const CALL_NAME_RE =
   /\b(apiGet|apiList|apiPost|apiPatch|apiPut|apiDelete|apiUpload|
   apiPostBlob)\b/g;` — all eight call names are present.

4. **The IP-budget property statement (DEC-072 wave-67 amendment).**
   PARTIALLY closed — the field guide's framing of this as fully closed
   at `5305cc7c` does not hold at this runtime. Two of the three call
   sites the DEC-072 wave-67 amendment named now cite the canonical
   statement instead of restating it: `src/routes/public/
   submit-post.tsx:128-136` and `src/routes/public/
   submit-draft.tsx:53-56` both reference `src/lib/rate-limit.ts`'s
   doc comment on `requestIpFromHeaders` by name rather than repeating a
   claim. But the amendment's own text names `src/routes/
   auth-claim.tsx:47-50` as "explicitly out of scope" (owned by a
   wave-66 branch, at that time) — and at this runtime that file's
   comment (still at `:47-50`) is UNCHANGED: it still claims "every
   client resolves to the literal string 'unknown'" and still cites
   DEC-949, not DEC-072's corrected three-branch property.
   `src/lib/rate-limit.ts:73-79` (`requestIpFromHeaders`) itself proves
   the claim false — branch 2 (`x-forwarded-for` present) returns a
   client-controlled value verbatim, never "unknown". This one call site
   is STILL OPEN; the mandate as a whole is not closed, and no file on
   disk records that distinction — this paragraph is the first one that
   does.
