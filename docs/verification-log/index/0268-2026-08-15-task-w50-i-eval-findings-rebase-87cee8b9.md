## 2026-08-15 task-w50-i — eval-findings rebase @ 87cee8b9

NOT QUALIFYING (docs-only — DEC-069)

INVALIDATED BY: src/** app/src/** migrations/** package.json

DOCS ONLY (DEC-358 w41/w50, DEC-069, DEC-099 w50): no file under `src/`,
`app/src/`, `migrations/`, `scripts/`, or `package.json` was touched;
`docs/eval-findings.md` and this index entry are the only edits. This is
the sole editing owner of `docs/eval-findings.md` this wave; scope
classifies to no five-slot gate.

Step 0 sync-then-measure: `git merge --no-edit main` in this worktree (cut
directly from `main` tip) reported "Already up to date." `npx tsx
scripts/ref-state.ts` receipt (verbatim): DEC-644 three-sha boundary — HEAD
`87cee8b9fec30d190f93156c99ddf7011b68bc92`; newest first-parent
product-code-bearing sha `c6f5ab28ccf4c4a06096f95a460a66ad0be0687b`;
ancestors of HEAD: `main`, `manual-qa`, `task-custodian-w68-4`,
`task-w47-a`, `task-w47-g`, `task-w47-h`, `task-w48-a`, `task-w48-c`,
`task-w48-f`, `task-w50-e`, `task-w50-h`, `task-w50-i`, `task-w68-d`,
`task-w71-c`, `task-w71-d`, `task-w71-e`. NON-ancestors: `mail-rich-shape-fallback`,
`task-w17-i`, `task-w48-b`, `task-w48-d`, `task-w48-e`, `task-w48-g`,
`task-w49-a` through `-h`, `task-w50-a`, `task-w50-b`, `task-w50-c`,
`task-w50-d`, `task-w50-f`, `task-w50-g`, `task-w68-b`, `task-w68-c`,
`task-w68-e`, `task-w71-a`, `task-w72-a` through `-j`. `git for-each-ref
--format='%(refname:short) %(objectname:short)' refs/heads` (46 live
branches) plus `git merge-base --is-ancestor <ref> HEAD` re-run
individually for every ref (never a `.git/refs/heads/*` glob, never the
`.git/packed-refs` `refs/heads/main` line) confirms the same split.

MEASURED_SHA = `git rev-parse --short HEAD` = `87cee8b9` (taken before
this commit).

**REBASE per DEC-358 w27/w31/w35/w37/w39/w41/w45/w46/w48/w50:** the pinned
mandate (`32921050`, wave 47/task-w47-h) is now three waves stale;
replaced (not prepended) with a header derived at this task's own
runtime. Folded the `32921050`..`87cee8b9` range in:

- **All seven wave-45 CONFIRMED-DEFECT rows CLOSED.** Every `task-w47-a`
  through `-g` owning branch confirmed an ancestor of HEAD; each item's
  falsifying check re-run directly against the live tree this task (not
  restated from the branch's own commit message) — reminder claim-before-
  send (`test/reminders-claim-before-send.test.ts` 2/2), portal doors SQL
  scoping (`test/portal-detail-download-scope-sql.test.ts` 4/4,
  `test/portal-resources-scope.test.ts` 2/2), auto-schedule accounting
  race (`test/auto-schedule-unplaced-reconciliation.test.ts` 2/2), CSV
  import duplicate-destination mapping
  (`test/contacts-import-mapping-injective.test.ts` 6/6), merge
  preview/execute parity (`test/contacts-merge-preview-parity.test.ts`
  3/3), contact-history `events` bound
  (`test/contacts-history-event-id.test.ts` 6/6), file version-mint race
  (`test/file-version-chain-unique.test.ts` 2/2). `0236`'s 24-file
  blast-radius finding stays UNOWNED (re-glob: still true).
- **Wave-48's three landed gate sections folded in**: `0240`
  (build+test+bundle, FAIL, 2 items), `0242` (perf-smoke, PASS 117/117),
  `0244` (render-sweep, PASS all seven passes). `0240`'s item 1
  (DEC-818's cited migration) is now CLOSED — the file landed via
  `task-w47-g` (`test/decision-path-references.scan.test.ts` 2/2, re-run
  this task). `0240`'s item 2 (`test/spec9-invariants.test.ts:131`)
  RECLASSIFIED as a TEST DEFECT (DEC-522 w49 finding), independently
  reconfirmed this task by re-running the suite: at this runtime line 131
  (`"pending"`) failed rather than line 133 (`"accepted"`) as `0240`
  reported — same UTC-day-label clock-boundary defect, different
  assertion; `src/domain/edit-lock.ts:22`'s DEC-041 carve-out itself is
  unchanged. Not re-filed as a product regression; owner stays wave-51.
- **Every "file X exists" claim in the document re-globbed
  programmatically this runtime**: 169 distinct backtick-quoted file-path
  citations resolved (exact path or unique basename match) — all 169
  found on disk, zero false claims carried forward. No "does not exist"
  claim is currently carried (both prior absence claims were already
  closed by wave-46).
- **IN FLIGHT rebuilt purely from `.git` ref state**: wave-48's four
  non-landed lanes (`-b`/`-d`/`-e`/`-g`), all eight wave-49 lanes (none
  landed — `task-w49-f`/`task-w49-g` claim to discharge the UNOWNED
  wave-41 falsifiability batch-A/batch-B remainders respectively, named as
  OWNED-BUT-UNMERGED since this lane did not itself re-run their checks),
  and this wave's own siblings (`task-w50-a`..`-h`, none an ancestor
  except `-e`/`-h` which are RUNNING with zero commits) are each named by
  branch, sha and one-line scope — no counts, verdicts or RESULT/OPEN
  ITEMS lines restated or predicted for any of them, per this task's own
  boundary.

Net: `docs/eval-findings.md` went from 923 to 892 lines while folding in
seven newly-closed defects, three wave-48 gate sections, and 17 named
branches across waves 48-50 that the prior header did not carry.

```
$ npm run verification-log:assemble
```
```
$ npm run verification-log:check
exit 0
```

RESULT: FAIL — NOT QUALIFYING: docs-only scribe/mandate rebase, DEC-069 (a gate
inside a code wave can never qualify; here, no code wave gate is even
attempted). `docs/eval-findings.md` rebased to `87cee8b9`; seven wave-45
defects and three wave-48 gate sections folded into TIER 0 with re-run
falsifying checks; IN FLIGHT rebuilt from live `.git` ref state naming
every wave-48/49/50 non-landed branch.

OPEN ITEMS: 0 (this lane files no new CONFIRMED-DEFECT of its own; the one
item it reclassifies — `test/spec9-invariants.test.ts:131`'s clock
dependency — remains counted at `0240`'s own filing, owner wave-51, not
re-filed here as a new item)
