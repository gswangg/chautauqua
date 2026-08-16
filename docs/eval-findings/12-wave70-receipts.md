# Wave 70 mandate-hygiene receipts

New file, per the wave-52 decomposition and the DEC-358 pattern established at
`docs/eval-findings/10-wave68-receipts.md` / `11-wave69-receipts.md`: hygiene
receipts get their own file so they never collide with the shared open lists
or with a sibling hygiene lane. This file is `12-wave70-receipts.md`
specifically so it cannot collide with `task-w69-f`'s
`11-wave69-receipts.md`.

DOCS-ONLY lane of a code wave (DEC-069): no gate ran, no
`docs/verification-log/index/` section is filed for this lane. Every
citation below was re-derived at THIS lane's own runtime against the worktree
tip (`git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w70-g
log -1` = `24dfe0b6`, "merge task-w69-a", branched from main `1445ce95`) — do
not copy these line numbers forward without re-checking them; the merge
train moves under every wave.

## Verdicts

### (1) Four carried rows re-read CLOSED

- **submit-post's orphan-contact rollback (DEC-713 wave-67).**
  `src/routes/public/submit-post.tsx`: the `contactIsFresh` cleanup now runs
  in BOTH places a freshly-minted contact can be orphaned — the R2-rejection
  branch (`:396-402`, guarded by the comment at `:391-395` that explicitly
  cites DEC-713 and the "mirroring the DB-write-phase catch below" intent)
  and the DB-write-phase `catch` block (`:461-467`, guarded by the comment
  at `:448-457`). Both call `deleteContact(db, contactId)` only when
  `contactIsFresh`; a pre-existing contact is never touched by either path.
  CLOSED.

- **auth-claim's insert-then-consume ordering (DEC-064 wave-66 amendment).**
  `src/routes/auth-claim.tsx`: the comment block at `:119-128` states the
  ruling ("the INSERT is the serializer, not the KV consume... the insert
  runs FIRST, before the token is touched"); `db.insert(schema.user)...`
  runs at `:133-142` inside a `try` that redirects to `/login` on a unique
  violation (`:143-147`) without touching the token; `consumeClaimToken(kv,
  token)` runs only afterward, at `:157`, guarded by the comment at
  `:150-156` explaining that this request's insert winning the unique index
  is the only gate. The grant survives any throw before the insert commits.
  CLOSED.

- **The `requestIpFromHeaders` mis-citation (DEC-072 wave-67).**
  `src/lib/rate-limit.ts:43-72`'s doc comment states the exact three-branch
  property (opens "DEC-072 (wave-67 amendment): the ONE statement of this
  property. There are exactly three branches...") and the function body at
  `:73-78` matches it exactly: `cf-connecting-ip` verbatim, else the first
  `x-forwarded-for` hop verbatim (attacker-controlled, not a shared bucket),
  else the literal `"unknown"`. CLOSED — the honest three-branch property is
  now the only statement of this function's behavior in the file.

- **The DEC-613 submission-sort duplicate type.** `src/domain/submission-sort.ts`
  is the one shared vocabulary (`SortOrder`, `SORT_ORDERS`, header comment
  `:1-15` names both consumers it replaced: `src/server/repo/submissions/query.ts`'s
  `readSortToken` and `app/src/pages/submissions/types.ts`'s
  `SubmissionsFilterState` shape) and imports `DEC_613` from
  `src/decisions.ts` at `:16-18` so the dependency is compile-checked. SPA
  parity is pinned by `app/src/pages/submissions/sort-vocabulary-parity.test.ts`.
  CLOSED.

### (2) User-filed scan gap — extend the DEC-817 scan to every `api*` verb

CLOSED-WITH-RECEIPT. The gap is filed at
`docs/eval-findings/01-user-filed.md:25-28` ("SCAN GAP for the swarm: the
DEC-817 SPA↔route mutation-contract scan missed the DELETE verb — extend it
to enumerate EVERY api* helper call (get/post/patch/DELETE)..."). It is
closed by `test/spa-mutation-contract.scan.test.ts`, whose own header
(`:1-25`) states the widening in its own words: "Wave 53 widened both: every
api* helper is scanned, and resolution goes through resolveRegisteredRoute
(test/helpers/registered-routes.ts), derived from the REAL route table in
src/routes/**." — quoted verbatim, matching what the header actually says at
this runtime. The population step (`:14-19`) walks `app/src/**/*.{ts,tsx}`
for calls to `apiGet/apiList/apiPost/apiPatch/apiPut/apiDelete/apiUpload/
apiPostBlob` — DELETE is enumerated alongside every other verb, not scanned
separately. CLOSED.

### (3) DO-NOT-CHASE ruling — portal vs organizer co-presenter email asymmetry (freeze-lane item 10)

Re-confirmed this wave: NEITHER door sends. `src/routes/api/submissions.ts`'s
`POST /submissions/:id/participants` (organizer door) carries its own
comment at `:673-678`: "Per product principle 4, this does NOT send an
email — notifying the invitee is a separate, explicit comms action."
`src/server/repo/portal-edit.ts`'s `addCoPresenter` (portal door,
`:503-...`) writes `inviteStatus: "invited"` at `:584` with no mail call
anywhere in the function. Both doors produce the identical
`inviteStatus: 'invited'` row with no email side effect, so the asymmetry
described in the freeze lane does not exist on the server. The only real
gap was the missing copy explaining that no email was sent, which is owned
this wave by `task-w70-d` per the mandate brief — DO NOT re-file the
"asymmetry" as a server defect.

### (4) DEC-083 wave-70 amendment — status: DEC text already landed, header/AUDIT paragraphs completed this lane

The `## Amendment (wave 70)` section on `decisions/DEC-083.md` was **already
present on main** before this lane started — `git -C
/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w70-g
log --oneline -S "Amendment (wave 70)" -- decisions/DEC-083.md` finds it in
`d19300b0` ("scribe wave 70"), a commit already an ancestor of this branch's
base. This is a DEC-358-shaped "mandate row closed before it was filed":
the DEC text was correct and did not need rewriting, so this lane did not
duplicate it.

What was genuinely missing, and what this lane added: the ruling was not yet
echoed in the two other prescribed locations.

- `src/server/pubcache.ts`'s header comment did not mention the
  instance-wide-key blast radius at all (only DEC-083's wave-10/15/22/26
  amendments were represented). This lane added a paragraph after the
  wave-26 staleness paragraph (now at `:26-38`) stating the ruling: PUBVER_KEY
  is one instance-wide key by design, `bumpIfMutating` bumps it on any
  successful non-NEVER_PUBLIC mutation, per-event scoping was rejected for
  stage 1 for the two reasons the DEC gives, and the measured public surface
  still passes its budget cold.
- `docs/AUDIT.md`'s J10 section (`:135-171`) had **no edge-cache paragraph of
  any kind** before this lane — not even the pre-existing 60s staleness
  bound the mandate brief assumed was already there (re-checked with `grep
  -in "public.*cach\|edge.*cach\|stale" docs/AUDIT.md` against main before
  editing: zero hits). This lane added one paragraph covering both the 60s
  KV-read staleness window (DEC-083 wave-26) and the instance-wide-key blast
  radius (DEC-083 wave-70), citing `docs/eval-findings.md`'s "PROD-LIKE LOAD
  TEST" section (`docs/eval-findings.md:310-312`, 15-98ms adjusted vs a
  150ms budget at 2,030 submissions) for the budget-passes-cold claim.

Both additions are docs/comments only — no behavior in `src/server/pubcache.ts`
changed; the file's exported surface, `bumpIfMutating`, `PUBVER_KEY`, and
`versionedCacheKey` are untouched.

### (5) Wave-69 branch census — all five have LANDED (do not re-file, and do not trust the "in flight" status recorded in `11-wave69-receipts.md`)

Re-derived at this lane's runtime against
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w70-g`
(`git log --oneline | grep -n "merge task-w69"`, taking the FIVE merge
commits nearest HEAD — lines 1, 2, 7, 9, 10 of that grep — not the five
duplicate-named merges ~2,000 lines deeper in history, which belong to the
unrelated interleaved campaign DEC-358/w69 already warned about):

- `task-w69-a` — merged as `24dfe0b6`, carrying `89feb05d` "Emit
  break_overlap conflicts from the server (DEC-557 wave-69 amendment)".
  Server-side `break_overlap` conflict kind + emission. LANDED.
- `task-w69-b` — merged as `a75ae7ab`, carrying `73f35f84` "Unify
  UnplacedReason vocabulary: one label renderer for all seven members"
  (closes DEC-615's 4-of-7-member SPA mirror). LANDED.
- `task-w69-c` — merged as `6e777050`, carrying `9ad688d2` "Public search
  submit is a real, clickable control (DEC-919 wave-69 amendment)". LANDED.
- `task-w69-d` — merged as `2679b49e`, carrying `3dda1761` "DEC-945
  (amendment, wave 69): role-blocked /admin bounce says why". LANDED.
- `task-w69-e` — merged as `3e247048`, carrying `d179cfc2` "Clear page-level
  error banner on every settings write handler (DEC-856 amendment w69)".
  LANDED.
- `task-w69-f` — merged as `3295baa9`, the wave-69 mandate-hygiene lane that
  filed `docs/eval-findings/11-wave69-receipts.md` and the DEC-358
  amendment. LANDED (and is the ancestor this file's own naming convention
  follows).

All five of `11-wave69-receipts.md`'s "in flight, unconfirmed scope" notes
for `-a`, `-c`, and `-e` are now STALE — they landed since that file was
written. Per DEC-903 (a gate/branch-census finding is a claim about a
snapshot, not about main), this is expected drift, not an error in the prior
lane's work.

### (6) The reflog trap, re-measured this wave

`.git/logs/HEAD` in the MAIN repo (not the worktree — the worktree's `.git`
is a gitdir pointer file) interleaves an earlier, unrelated campaign that
also reached "wave 70". `grep -n "scribe wave 70"
/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua/.git/logs/HEAD`
finds two hits: line 1479 (the earlier campaign's "scribe wave 70", commit
`d354fa34`) and line 2654 (this campaign's own "scribe wave 70", commit
`d19300b0`) — the file is 2658 lines long, so the true tail is the line
nearest the end. The gap between the two hits is 1,175 lines, matching the
field guide's "roughly 1,150 lines" estimate. `.git/packed-refs` is stale
from the earlier campaign (it still lists branches/tags from that run) —
loose refs and the reflog FILE TAIL (not a grep match, which can land on
either campaign) remain the only trustworthy read.

## Standing note

This lane touched no `src/` behavior and no test assertions — only
`docs/AUDIT.md` and `src/server/pubcache.ts`'s header comment (prose,
outside any function body) changed inside `src/`. `vitest related
src/server/pubcache.ts` is expected to run pubcache's existing suite
unchanged and green.
