# task-w40-g — triage-closure @ 2e99b272

DEC-069's required fifth section (triage-closure, per DEC-453: enumerate,
never fix). This lane touched nothing under `src/**`, `app/src/**`,
`migrations/**`, `package.json`.

## STEP 0 — ref-state receipt

`npm run ref-state` (first call, at worktree cut from `main` tip
`9f78158b`):

> DEC-644 three-sha boundary: HEAD `9f78158b4d45fab55d57259ad7b4b63adcc5d317`;
> newest first-parent product-code-bearing sha
> `ed5c679e59828c5600cb84b51208056f7e38a445`; every live ref (`main`,
> `manual-qa`, `task-custodian-w68-4`, `task-w40-c`, `task-w40-e`,
> `task-w40-g`, `task-w68-d`, `task-w71-c`, `task-w71-d`, `task-w71-e`)
> confirmed an ancestor of HEAD via `git merge-base --is-ancestor`.
> NON-ancestor refs: `mail-rich-shape-fallback`, `task-w17-i`, `task-w40-b`,
> `task-w40-d`, `task-w40-f`, `task-w68-b`, `task-w68-c`, `task-w68-e`,
> `task-w71-a`, `task-w72-a..j`.

`--product-sha` for this task = `ed5c679e59828c5600cb84b51208056f7e38a445`.

(NOTE: at that first call, `task-w40-c` and `task-w40-e` were listed as
"ancestor" only because both refs were still pointing at the unchanged wave
base `14db7b30` — they had not yet diverged with their own work. This is a
trivial ancestor relation, not evidence either lane had landed.)

## STEP 1 — assembling the boundary, polling for the four measured slots

`npm run verification-log:assemble` after the initial merge produced only
one of the four required sections (`task-w40-a — build+test+bundle`).
Per the task's instructions, polled up to 10 times (`git merge --no-edit
main`, re-assemble, re-check), sleeping 180s between attempts when a slot
was still missing:

- Attempt 1: `git merge --no-edit main` fast-forwarded in `task-w40-d`
  (spec-audit). `npm run verification-log:assemble` **crashed** with a
  DEC-068 duplicate-4-digit-sequence-prefix collision between
  `0198-...-task-w40-a-...md` and `0198-...-task-w40-d-...md` (both lanes
  minted seq 0198 concurrently — exactly the construction DEC-068
  documents). Remedy per DEC-068/field guide ("the remedy is a command"):
  ran `npx tsx scripts/assemble-verification-log.ts --renumber`, which
  renamed `task-w40-d`'s index file `0198 -> 0199` and re-assembled clean.
  Missing after attempt 1: walkthrough, perf-smoke.
- Attempt 2: fast-forwarded in `task-w40-b` (walkthrough). Assemble hit the
  same class of collision again (a *second*, independently-landed copy of
  the `task-w40-d` spec-audit index file arrived via the merge, this time
  at seq 0198 again); ran `--renumber` again (0198 -> 0201, alongside the
  already-renumbered 0199 copy — see FINDING below, this produced a
  content-duplicate rather than resolving one). Missing after attempt 2:
  perf-smoke only.
- Attempts 3-10: `git merge --no-edit main` (no-op / no relevant landings
  each time), re-assemble clean, perf-smoke still absent. After the 10th
  attempt the budget was exhausted.

Per the task's own instruction ("proceed with whatever is present, naming
every absent slot and the branch that owed it"): **perf-smoke is absent**
at this lane's sync boundary. `git log --oneline --all` shows a
`task-w40-c: perf-smoke gate reading @ 2e99b272 — RESULT PASS` commit
exists in the repository and was later merged (`deee555e merge
task-w40-c`), i.e. **task-w40-c owed and eventually delivered the
perf-smoke slot** — but that merge landed on `main` only after this lane's
10-attempt polling budget had already been spent, so it is not counted
toward this reading. (Also observed after polling closed: `task-w40-e`
render-sweep, an advisory not one of the four required slots, also landed
around the same time, `dfe02177 merge task-w40-e`.)

MEASURED_SHA (captured after the final sync, before this lane's own
commit): `git rev-parse --short HEAD` = **`2e99b272`**.

FINDING (not fixed, per DEC-453): `docs/verification-log/index/` now
carries two byte-identical copies of the `task-w40-d` spec-audit section
under different sequence numbers — `0200-2026-08-15-task-w40-d-spec-audit-14db7b30.md`
and `0201-2026-08-15-task-w40-d-spec-audit-14db7b30.md` — both with
identical body text (`RESULT: PASS` / `OPEN ITEMS: 0`). This produced two
back-to-back identical `## 2026-08-15 task-w40-d — spec-audit @ 14db7b30`
sections in the assembled `docs/verification-log.md`. `--renumber` only
resolves numeric-prefix collisions; it has no content-dedup step, so this
content duplicate survives assembly untouched. Filed as OPEN ITEM 2 below.

## STEP 2 — grading the three present slots (verbatim, ancestry self-confirmed)

1. **build+test+bundle** — `task-w40-a`, header `14db7b30`:
   `git merge-base --is-ancestor ed5c679e59828c5600cb84b51208056f7e38a445 14db7b30` exits 0 (ANCESTOR, not VOID). Quoted `RESULT:` line:
   > RESULT: PASS (build clean, 1092/1092 test files and 12002/12002 tests
   > green, entry bundle 69.20 kB gzip vs 300 kB budget) at 14db7b30, sole
   > live task-w39-* ref (task-w39-e) confirmed ANCESTOR, zero retries
   > needed.
   `OPEN ITEMS: 0`.

2. **walkthrough** — `task-w40-b`, header `14db7b30`:
   `git merge-base --is-ancestor ed5c679e... 14db7b30` exits 0 (ANCESTOR). Quoted `RESULT:` line:
   > RESULT: PASS — all six walkthrough areas pass at product sha
   > `14db7b30` (no product edits made; frozen wave per this task's brief,
   > docs/** only).
   `OPEN ITEMS: 0`.

3. **spec-audit** — `task-w40-d`, header `14db7b30` (two identical copies,
   see FINDING above; both carry the same verdict):
   `git merge-base --is-ancestor ed5c679e... 14db7b30` exits 0 (ANCESTOR). Quoted `RESULT:` line:
   > RESULT: PASS
   `OPEN ITEMS: 0`.

4. **perf-smoke** — ABSENT at this lane's sync boundary (see STEP 1).
   Owed by `task-w40-c`; delivered `RESULT PASS` per its own commit
   message but merged after this lane's polling budget closed, so not
   graded here. VOID/MISSING status left to the exit-predicate read below.

## STEP 2 — enumerated open items (deduplicated)

1. **Absent perf-smoke slot at sync boundary.** `docs/verification-log.md`
   (this lane's sync point, HEAD `2e99b272`) — no wave-40 `perf-smoke`
   section landed within this lane's 10-attempt / 180s polling budget,
   even though `task-w40-c` (see `git log --oneline --all`, commit
   `d1db93f9`) did eventually deliver one. Owner: wave-41 lane (confirm
   `task-w40-c`'s perf-smoke section is present and ancestry-valid once
   fully synced, or re-run the slot if stale).
2. **Duplicate `task-w40-d` spec-audit section.**
   `docs/verification-log/index/0200-2026-08-15-task-w40-d-spec-audit-14db7b30.md`
   and `docs/verification-log/index/0201-2026-08-15-task-w40-d-spec-audit-14db7b30.md`
   are byte-identical, producing a duplicate `## ... task-w40-d — spec-audit
   @ 14db7b30` section in the assembled log (`docs/verification-log.md`
   lines ~5386 and ~5424 at this lane's HEAD). Owner: wave-41 lane (delete
   the later-numbered duplicate file and re-assemble; do not renumber
   around it, DEC-068 forbids hand-renumbering).
3. **`scripts/exit-predicate.ts` crashes on an unresolvable historical
   sha.** `scripts/exit-predicate.ts:259` (`isAncestorOfProductSha`) calls
   `git merge-base --is-ancestor <productSha> <sha>` for every
   verdict-bearing section classified to a slot, oldest included, and only
   catches exit status `1` (not-ancestor); any other git failure (e.g.
   status `128`, "fatal: Not a valid object name") is rethrown uncaught.
   Running `npm run exit:predicate -- --product-sha
   ed5c679e59828c5600cb84b51208056f7e38a445` against this lane's corpus
   throws exactly this way on `git merge-base --is-ancestor
   ed5c679e59828c5600cb84b51208056f7e38a445 6807b67` (header sha of the
   ancient `## 2026-08-10 task-w20-c — perf-smoke @ 6807b67` section,
   `docs/verification-log.md:2470`) because `6807b67` is not a resolvable
   git object in this repository (confirmed absent both in this worktree
   and in the primary checkout via `git cat-file -t 6807b67`) — it reaches
   that section because no *later* perf-smoke section in this lane's
   corpus has `ed5c679e...` as an ancestor of its header sha (the one
   section that would satisfy it, `task-w40-c`'s, is not yet synced — see
   item 1). Owner: wave-41 lane (either patch
   `isAncestorOfProductSha` to treat an unresolvable object as
   not-ancestor rather than rethrowing, or retire/repoint the stale
   `6807b67` historical section per DEC-099's shrink-only ratchet).

**OPEN ITEMS: 3**

## STEP 4 — the predicate read

`npm run exit:predicate -- --product-sha ed5c679e59828c5600cb84b51208056f7e38a445`
did **not** produce the five-row table. It crashed with an unhandled
exception (see OPEN ITEM 3 above); verbatim:

```
node:internal/errors:983
  const err = new Error(message);
              ^

Error: Command failed: git merge-base --is-ancestor ed5c679e59828c5600cb84b51208056f7e38a445 6807b67
fatal: Not a valid object name 6807b67

    at genericNodeError (node:internal/errors:983:15)
    at wrappedFn (node:internal/errors:537:14)
    at checkExecSyncError (node:child_process:892:11)
    at execFileSync (node:child_process:928:15)
    at isAncestorOfProductSha (scripts/exit-predicate.ts:259:7)
    at (anonymous) (scripts/exit-predicate.ts:201:11)
    at Array.map (<anonymous>)
    at gradePredicate (scripts/exit-predicate.ts:190:26)
    at (anonymous) (scripts/exit-predicate.ts:276:16)
```

Process exit code: **1**.

Per DEC-069 wave-27/28 amendments ("report whatever it says ... a
NOT-SATISFIED with an honest table is a result, not a licence to defer"):
this lane reports the crash honestly rather than hand-computing a
substitute table. Based on this lane's own STEP 2 grading above (not a
substitute for the script, only a manual cross-check pending OPEN ITEM 3's
fix): build+test+bundle=PASS, walkthrough=PASS, spec-audit=PASS,
perf-smoke=MISSING (not yet synced), triage-closure=this section
(OPEN ITEMS: 3, so grades FAIL per DEC-069's own n>0 rule).

RESULT: FAIL — `npm run exit:predicate` did not produce a five-row table
(unhandled crash, exit code 1, on an unresolvable historical sha
`6807b67`); this lane's own triage-closure OPEN ITEMS count is 3 (not 0),
so even by manual cross-check the predicate is NOT SATISFIED at this
boundary.
OPEN ITEMS: 3
