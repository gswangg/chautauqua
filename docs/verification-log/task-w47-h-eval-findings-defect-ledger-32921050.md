# task-w47-h — eval-findings rebase and wave-45 defect-ledger filing @ 32921050

DOCS ONLY (DEC-358, DEC-068, DEC-069). No file under `src/`, `app/src/`,
`migrations/`, `scripts/`, or `package.json` was touched by this task. This
is a scribe/mandate rebase, not a code wave — per DEC-069, a gate inside a
code wave can never qualify, and this lane runs no product code and no
five-slot gate.

## What this task did

1. Rebased `docs/eval-findings.md` at its own runtime (DEC-069
   wave-17/wave-37, DEC-358 rebase rule): `git merge --no-edit main`
   ("Already up to date" — worktree cut from `main`'s tip);
   `npx tsx scripts/ref-state.ts`; `git for-each-ref --format='%(objectname)
   %(refname:short)' refs/heads` (37 live branches) plus an individual `git
   merge-base --is-ancestor <ref> main` per ref (never trusted from
   `ref-state` alone). Replaced the stale header (previously pinned at
   `6edb5263`, wave 44, predating wave 45 entirely) rather than prepending.
2. Filed the wave-45 adjudication ledger's omission: wave 45's six
   FILE-NEVER-FIX adjudication lanes (`docs/verification-log/index/0230`-
   `0237`) filed seven CONFIRMED-DEFECT rows that never made it into
   `docs/eval-findings.md`'s mandate because the file's header predated
   wave 45. All seven are now recorded there, each under its wave-47 owning
   branch, marked IN FLIGHT (not closed — this rebase runs concurrently
   with `task-w47-a` through `-g`, it does not adjudicate or fix their
   scope).
3. Re-homed two orphaned UNFALSIFIABLE remainder lists (wave-41
   falsifiability batch A and batch B remainders) from a stale "owner: a
   wave-47+ lane, branch to be named" pointer to UNOWNED — wave 45's lanes
   closed without taking them, and no wave-47 branch (`task-w47-a` through
   `-g`) covers this UI/settings falsifiability scope either.
4. Re-globbed every "file X exists / does not exist" claim carried forward
   from the wave-44 header before carrying it (an absence is a measurement,
   not a note) — all re-confirmed present/absent as claimed, see the
   commands below.

## Ref-state receipt (verbatim, `npx tsx scripts/ref-state.ts`)

> DEC-644 three-sha boundary: HEAD `32921050980ed81206d66c83fe30c53b6d3681ae`;
> newest first-parent product-code-bearing sha
> `ae1ea6aee5e4e320936a0e7511fe1e4b43f34192`; every live ref (`main`,
> `manual-qa`, `task-custodian-w68-4`, `task-w46-a`, `task-w46-b`,
> `task-w46-c`, `task-w46-d`, `task-w46-e`, `task-w46-f`, `task-w47-a`,
> `task-w47-g`, `task-w47-h`, `task-w68-d`, `task-w71-c`, `task-w71-d`,
> `task-w71-e`) confirmed an ancestor of HEAD via `git merge-base
> --is-ancestor`. NON-ancestor refs (NOT confirmed via `git merge-base
> --is-ancestor`): `mail-rich-shape-fallback`, `task-w17-i`, `task-w46-g`,
> `task-w47-b`, `task-w47-c`, `task-w47-d`, `task-w47-e`, `task-w47-f`,
> `task-w68-b`, `task-w68-c`, `task-w68-e`, `task-w71-a`, `task-w72-a`
> through `task-w72-j`.

Individually re-run `git merge-base --is-ancestor <ref> main` this task's
own runtime for every `task-w46-*`/`task-w47-*` ref: `task-w46-a` through
`-f` and `task-w47-a`/`-g` ARE ancestors (tips equal `main`'s HEAD exactly,
zero commits of their own — RUNNING per DEC-069 wave-37, not dead);
`task-w46-g` and `task-w47-b`/`-c`/`-d`/`-e`/`-f` are NOT ancestors — real,
unmerged commits. This worktree's own `.git` directory carries no
`packed-refs` file at all (unlike the main checkout, where the historical
stale-`main`-in-packed-refs trap lives); `git for-each-ref` is still the
only complete branch enumeration regardless.

## The seven CONFIRMED-DEFECT rows (source: `0230`-`0237`)

| Owning w47 branch | Source section | Claim | File:line |
|---|---|---|---|
| `task-w47-a` | `0232` (task-w45-c) | cron reminder send-then-stamp race | `src/server/repo/tasks/reminders.ts:416-459` |
| `task-w47-b` | `0232` (task-w45-c) | portal read doors scoped in JS, not SQL | `src/server/repo/portal/data.ts:208-273`, `src/server/repo/portal/resources.ts:117-152` |
| `task-w47-c` | `0233` (task-w45-d) | auto-schedule J9 fail-loud invariant, concurrent-write race | `src/server/repo/agenda/auto-schedule.ts:193-198` |
| `task-w47-d` | `0234` (task-w45-e) | CSV import duplicate-destination mapping accepted silently | `src/domain/contacts-parts/import.ts:44-101` |
| `task-w47-e` | `0234` (task-w45-e) | merge preview/execute preflight parity | `src/routes/api/contacts/merge.ts:41-73` |
| `task-w47-f` | `0234` (task-w45-e) | per-contact history `events` unbounded | `src/server/repo/contacts/history.ts:119-126` |
| `task-w47-g` | `0235` (task-w45-h) | file version-mint race, no unique-index backstop | `src/server/repo/files-versions.ts:477-511` |

Also filed by wave 45 but NOT one of the seven and NOT assigned a wave-47
owner: `0236` (task-w45-f)'s blast-radius finding (24 non-conforming
DEC-068 headers found vs. the 7 named by that task; 17 mechanically
repairable, 15 need a DEC ruling on sha-less legacy entries) —
`Owner TBD, wave-46+` at filing, still TBD at this re-glob. UNOWNED,
carried forward in `docs/eval-findings.md`.

`0230` (review-integrity) and `0231` (comms-integrity) filed zero
CONFIRMED-DEFECT rows each — closed clean, not re-filed as owed a wave-47
lane. `0237` (slot-claim instrument repair) fixed two DEC-069
classifier defects directly, no product-code defect filed, MERGED.

## Re-glob receipts (existence/absence claims carried forward)

```
$ ls docs/verification-log/task-w27-g-fidelity-recheck-ceda66f2.md \
     src/db/schema/embed.ts src/routes/public/saved-embed.tsx \
     app/src/pages/submissions/submissions-phone-card.render.test.tsx \
     src/routes/public/cfp-steps-script.tsx \
     app/src/pages/speakers/RosterPanel.tsx \
     app/src/pages/speakers/RosterPanel.render.test.tsx \
     docs/mandates/w41-falsifiability-batch-a.md \
     docs/mandates/w41-falsifiability-batch-b.md \
     test/tier0-falsifiability-w46.test.ts \
     app/src/pages/Overview.caption.w46.render.test.tsx \
     src/routes/account.tsx src/routes/public/home.css.ts
-> all EXIST (12/12)

$ grep -rl "localhost:8799" app/src | wc -l   -> 0 (absence re-confirmed)
$ grep -rln "TBD" src/routes/public | wc -l   -> 0 (absence re-confirmed)
```

## Verification

`npm run verification-log:check` — run after this file and its index
section were added — exits 0 (see index section `0238` for the receipt).
No product code, no tests beyond `verification-log:check` (DEC-069: a
docs-only scribe lane runs no gate slot and no test suite).
