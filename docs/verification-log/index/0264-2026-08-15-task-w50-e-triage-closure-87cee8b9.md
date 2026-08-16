## 2026-08-15 task-w50-e — triage-closure @ 87cee8b9

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

FROZEN GATE LANE (DEC-069 w50): docs-only, no file under `src/**`, `app/src/**`,
`migrations/**`, or `package.json` touched.

STEP 0 — `git merge --no-edit main`: "Already up to date" (worktree cut
directly from `main` tip `87cee8b9`). `npx tsx scripts/ref-state.ts` receipt
(verbatim):

> DEC-644 three-sha boundary: HEAD `87cee8b9fec30d190f93156c99ddf7011b68bc92`;
> newest first-parent product-code-bearing sha
> `c6f5ab28ccf4c4a06096f95a460a66ad0be0687b`; every live ref (`main`,
> `manual-qa`, `task-custodian-w68-4`, `task-w47-a`, `task-w47-g`,
> `task-w47-h`, `task-w48-a`, `task-w48-c`, `task-w48-f`, `task-w50-a`,
> `task-w50-b`, `task-w50-c`, `task-w50-e`, `task-w68-d`, `task-w71-c`,
> `task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD via `git
> merge-base --is-ancestor`. NON-ancestor refs (NOT confirmed via `git
> merge-base --is-ancestor`): `mail-rich-shape-fallback`, `task-w17-i`,
> `task-w48-b`, `task-w48-d`, `task-w48-e`, `task-w48-g`, `task-w49-a`,
> `task-w49-b`, `task-w49-c`, `task-w49-d`, `task-w49-e`, `task-w49-f`,
> `task-w49-g`, `task-w49-h`, `task-w50-d`, `task-w68-b`, `task-w68-c`,
> `task-w68-e`, `task-w71-a`, `task-w72-a`, `task-w72-b`, `task-w72-c`,
> `task-w72-d`, `task-w72-e`, `task-w72-f`, `task-w72-g`, `task-w72-h`,
> `task-w72-i`, `task-w72-j`.

Every ref in both lists re-run individually via `git merge-base
--is-ancestor <ref> HEAD` (never a glob, never packed-refs): the receipt
above matches exactly. Notably `task-w47-a`, `task-w47-g`, `task-w47-h`
(field-guide-flagged w49 as "committed-and-unmerged") are now confirmed
ANCESTOR — the wave-47 merge train landed since w49's runtime. Their
still-live sibling branches `task-w47-b`/`-c`/`-d`/`-e`/`-f` no longer
exist as refs at all (`git for-each-ref refs/heads` returns nothing for
them) — merged and deleted, consistent with landing.

MEASURED_SHA = `git rev-parse --short HEAD` = `87cee8b9`.

## POPULATION (DEC-358, no split, no exclusion clause)

Every `OPEN ITEMS: <n>` line with n>0 in `docs/verification-log/index/`,
sections 0174 through 0244 (highest present at this runtime, confirmed
`ls docs/verification-log/index/`): 0174(7), 0175(3), 0184(non-numeric,
DEC-773 clause), 0188(1), 0189(1), 0192(1), 0193(4), 0195(3), 0196(5),
0197(1), 0210(1), 0211(1), 0213(2), 0215(3), 0216(4), 0220(1), 0225(1),
0226(2), 0232(2), 0233(1), 0234(3), 0235(1), 0236(1), 0237(1), 0240(2).
(0230, 0231, 0238, 0242, 0244 all read `OPEN ITEMS: 0` — outside the
population by definition, but read in full anyway for evidence.)

This is the FOURTH triage-closure wave over this same growing population
(after 0210/task-w42-a, 0215/task-w40-g, 0225/task-w44-f). Every item
already reconciled by one of those three sections was RE-CHECKED against
this lane's own HEAD (never inherited), per DEC-069 wave-17. Dedupe rule
kept: one underlying defect, reconciled once, citing every section that
raises it.

## RECONCILIATION TABLE

| Underlying item | Raised in | Verdict @ 87cee8b9 | Evidence |
|---|---|---|---|
| 0174 A/B caret contrast | 0174/0175 | CLOSED | `add09a9e` ancestor; reconfirmed clean at 0244 (`243b3094`, ancestor of HEAD), NAMED_CONTRAST_SELECTOR row `ratio=6.82 PASS` |
| 0174 C / 0175(vi) review-checkbox-label contrast (3.09) | 0174/0175 | RULED-NOT-A-DEFECT | DEC-426 EXEMPT-BY-RULE (WCAG 2.1 SC 1.4.3, inactive component); still reads `EXEMPT-BY-RULE` at 0244, ancestor of HEAD |
| 0174 D cfp-step-next focus-visible | 0174/0175 | CLOSED | task-w29-c fix; 0244's interaction-state pass 3/3 PASS incl. `.chq-cfp-step-next focus` |
| 0174 E review-field-disabled selector | 0174/0175 | CLOSED | same fix; 0244 interaction-state 3/3 PASS |
| 0174 F mobile console-error collection | 0174 | CLOSED | 0244: "zero console/pageerror events collected across every route on both viewport passes" |
| 0174 G / 0210 admin Speakers `[List \| Grid]` toggle | 0174/0210 | **VOID — do not re-file.** Ruled VOID at 0225 (public-surface spec row, `docs/design/README.md:350` names the PUBLIC speakers page; control exists at `src/routes/public/speakers.tsx:20,235,314`). Per this task's own brief: "ruled VOID three times ... do not re-file." Not re-verified here beyond citing the standing ruling. | 0225, `docs/eval-findings.md` DISMISSED-VERIFIED-CLOSED |
| 0184 files-library headshot-join perf (DEC-773 clause) | 0184 | MOOT, superseded | file's own MERGE NOTE: product change not taken, w29-b's indexed-FK route landed instead, measured PASS; nothing owed |
| 0188 caret-contrast instrument gap | 0188 | CLOSED | `76431743` ancestor; 0244 reconfirms |
| 0189/0193#2/0196#2 plan-progress perf unstable | 0189/0193/0196 | CLOSED | 0201 (3/3 PASS), reconfirmed fresh at 0242 (`0ecff8aa`, ancestor of HEAD): `plan progress (page 1)` 23.4/24.1/25.3ms, 3/3 PASS, "no regression" |
| 0192/0196#5 bundle-size PENDING-OWNED | 0192/0196 | CLOSED | 0200, 69.20 kB gz first-hand |
| 0193#1/0196#1 reviewer queue perf | 0193/0196 | CLOSED | 0201 3/3 PASS; reconfirmed at 0242 (23.1/20.2/21.8ms, 3/3 PASS) |
| 0193#3/0196#3/0195/0213 perf-seed.ts perf-speaker wiring gap | 0193/0195/0196/0213 | CLOSED (FALSE at HEAD, per 0225's own re-derivation) | own re-grep this run: `grep -c PERF_SPEAKER scripts/perf-seed.ts` = 13; 0242 independently confirms same count and reaches all three portal rows via the documented recipe, no fixup needed |
| 0193#4/0196#4 perfSpeakerAcceptedIndexes / portal-fixup reachability | 0193/0196 | CLOSED | 0201's three portal rows via documented recipe; reconfirmed 0242 |
| 0195 autoSchedule320 / 0213 row 1 window-blind `existing` filter | 0195/0213 | CLOSED | wave-43 fix (`isDayWithinEventRange` shared with `payload.ts`), confirmed still present: `src/server/repo/agenda/auto-schedule.ts:60-68` |
| 0195 plan-progress advisory 0.6ms FAIL | 0195 | CLOSED by fresh measurement | 0213 left it ADVISORY/unadjudicated; 0242's fresh 3-run measurement (23.4/24.1/25.3ms, all PASS) resolves the marginal reading, no regression at this HEAD |
| 0197/0213 row 2 `resolveBaseUrl` dev-loopback footgun | 0197/0213 | NOT-A-DEFECT (standing ruling) | 0213's own read of `src/server/origin.ts`, unchanged; dev-only, stage-2 provisioning resolves it |
| 0211/0216#2 mergeContacts multi-id non-atomicity | 0211/0216 | CLOSED | `src/server/repo/contacts/merge.ts:702-716`, "DEC-629/DEC-026 wave-43 amendment: set-based, ALL-OR-NOTHING merge"; unchanged at HEAD |
| 0215 item 1 (absent perf-smoke slot, stale sync boundary) | 0215 | STALE, superseded | perf-smoke long since landed and an ancestor of HEAD |
| 0215 item 2 (duplicate task-w40-d index files) | 0215 | STALE, not reproducible | only one `*task-w40-d-spec-audit-14db7b30.md` exists at this HEAD |
| 0215 item 3 / 0216#1 / 0225 / 0226 exit-predicate crash on unresolvable ancient sha | 0215/0216/0225/0226 | **CLOSED.** `scripts/exit-predicate.ts`'s `gitAncestorResult` (added by commit `f86ebc5c`, "exit-predicate: unresolvable git object degrades to false, not crash (DEC-099 w46)") now catches git exit status 128 and returns `false` with one `console.warn`, only rethrowing genuinely unexpected statuses. Exercised check: `npx tsx scripts/exit-predicate.ts --product-sha c6f5ab28ccf4c4a06096f95a460a66ad0be0687b` ran to completion this session (printed a full five-row table, all VOID — see ADVISORY section below — not a crash); `test/exit-predicate.test.ts` and `test/exit-predicate-corpus.test.ts` both green this run (targeted). Reverting `gitAncestorResult`'s status-128 branch would reproduce the crash on any corpus entry referencing an aged-out git object (e.g. `7561cc1`, `6807b67`), which is exactly what these tests exercise. | own run + targeted tests this session |
| 0216#1 (0215-over-0210 mechanically-graded artifact) | 0216 | CLOSED by supersession | 0225 (a strictly newer section) is now the higher-sequence, newest-measured-tree candidate; moot |
| 0216 items 2-4 | 0216 | CLOSED, see rows above | — |
| 0220/0226 contacts-repo.test.ts mock/production call-order desync | 0220/0226 | **CLOSED.** `test/contacts-repo.test.ts:241-256`'s `fakeDb` queue now documents and supplies the 4-select whole-operation preflight (`// preflight findContactById(keepId)` etc.) ahead of `mergeOnePair`'s own re-fetch, matching `src/server/repo/contacts/merge.ts:727-761`'s actual call order. | `npx vitest run test/contacts-repo.test.ts` this session: green, 0 failures (targeted, inside `with-test-lock.sh`) |
| 0225 exit-predicate crash | 0225 | CLOSED, see 0215-item-3 row above | — |
| 0232#1 cron reminder claim-before-send race | 0232 | CLOSED | `src/server/repo/tasks/reminders.ts:414-433` ("DEC-023 amendment: claim BEFORE the mail loop — a conditional chunked UPDATE... A group whose claim loses every one of its assignments to a concurrent claimant is dropped from the send set entirely"), landed via `task-w47-a` (`030c9170`), confirmed ANCESTOR of HEAD this session |
| 0232#4 portal read doors unscoped-then-JS-filtered | 0232 | CLOSED | `src/server/repo/portal/data.ts:201-224` (`submissionOwnedByContact`, a correlated SQL `EXISTS` ANDed into the WHERE, "DEC-962 wave 47 amendment"); the old JS post-filter is now a fail-loud invariant that can never fire (comment at `data.ts:264-267`) |
| 0233 claim 1 J9 fail-loud race (concurrent-write) | 0233 | CLOSED | `src/server/repo/agenda/auto-schedule.ts:187-206` ("DEC-615 wave-47 amendment: payload is a SECOND read... Reconcile by SET, scoped to this run's OWN snapshot... an id outside that snapshot diverging is a benign concurrent edit, not an accounting bug"), fail-loud only for genuinely-impossible states |
| 0234#1 CSV import duplicate-destination mapping | 0234 | CLOSED | `src/domain/contacts-parts/import.ts:37-68` (`validateImportMapping`, "DEC-478 amendment wave-47... throws... naming BOTH offending columns and the shared target"), landed `2e23a785` |
| 0234#2 merge preview/execute preflight parity | 0234 | CLOSED | `src/routes/api/contacts/merge.ts:37-76` (preview route now runs `repo.checkMergeConflicts`, "the exact same whole-operation preflight... so the preview and the write can never drift", "DEC-705/DEC-026 wave-47 amendment") |
| 0234#4 contact-history `events` unbounded | 0234 | CLOSED | `src/server/repo/contacts/history.ts:86,118,134-149` (`MAX_CONTACT_HISTORY_EVENTS` limit + `eventsTotal` count, mirroring the submissions/emails cap idiom) |
| 0235#2 file version-mint race (read-then-write) | 0235 | CLOSED | `src/db/schema/content.ts:81` (`file_previous_file_id_unique`, a `uniqueIndex` on `previous_file_id`), landed via `task-w47-g` (`9a541796`, "File version mint gets its unique-index contract (DEC-818 amendment)"), migration `migrations/0043_file_version_chain_unique.sql` present on disk |
| 0236 blast-radius (24 vs 7 non-conforming index headers) | 0236 | CLOSED, structurally | `scripts/assemble-verification-log.ts:97-121` (`deriveSyntheticHeader`) synthesizes a conforming header from the FILENAME for any section whose own first line doesn't match `HEADER_RE`, so no malformed first line can donate a wrong verdict to its predecessor or itself; `assembleEntry` (`:132-139`) calls it unconditionally. No file needs individual repair for the header-contract purpose 0236 was filed for. (A DISTINCT, newly-discovered defect about `RESULT:` line content — not header format — is filed below.) |
| 0237 (residual: same as 0215-item-3) | 0237 | CLOSED, see above | — |
| 0240#1 DEC-818 dangling migration-path reference | 0240 | CLOSED | `migrations/0043_file_version_chain_unique.sql` now exists on disk (see 0235#2 row); `npx vitest run test/decision-path-references.scan.test.ts` green this session (targeted) |
| 0240#2 `test/spec9-invariants.test.ts:131` clock-dependent failure | 0240 | **STILL OPEN — see ADDITIONAL FINDINGS below (not fixed, re-confirmed failing this run).** | — |

## ADDITIONAL FINDINGS (discovered via this lane's own targeted verification runs, outside the strict `OPEN ITEMS: n>0` population but genuine defects at this HEAD — DEC-358, no exclusion clause spirit applied to what the population's own exercised checks surface)

Ran `sh scripts/with-test-lock.sh npx vitest run test/contacts-repo.test.ts
test/exit-predicate.test.ts test/exit-predicate-corpus.test.ts
test/verification-log-verdict-contract.test.ts test/spec9-invariants.test.ts
test/decision-path-references.scan.test.ts` this session (targeted, inside
the sanctioned lock). Result: 2 files failed, 3 tests failed, 90 passed.

1. **`test/spec9-invariants.test.ts:131`** ("an ACCEPTED speaker keeps
   editing past close") FAILS at this HEAD, at this session's runtime
   (`date -u` = `2026-08-16T01:2Xz`). This is the SAME clock-dependent test
   defect the field guide already diagnosed at wave 49 (DEC-522): the test
   feeds `Date.now() - 24h` as `pastClose` where `canEditSubmission`
   (`src/domain/edit-lock.ts`) requires a DAY LABEL derived via
   `dayLabelToYmd`, which reads the UTC calendar date — so the row is RED
   for roughly 7 hours of every UTC day and green the rest. This is a TEST
   DEFECT, not a product regression (per DEC-522 w49's own ruling); the
   fix direction is the frozen `Date.UTC(y,m,d)`-label pattern already used
   correctly by `test/edit-lock.test.ts:9-11`. It remains unfixed at this
   HEAD — 0240 filed it as CONFIRMED-DEFECT with owner "wave-49 lane"; no
   wave-46 through wave-50 lane has landed the frozen-label fix.
   **CONFIRMED-DEFECT, still open. Owner: wave-51 lane,
   `test/spec9-invariants.test.ts:131` (apply the frozen-day-label pattern
   from `test/edit-lock.test.ts:9-11`).**

2. **`test/verification-log-verdict-contract.test.ts`**'s shrink-only
   ratchet (`LEGACY_VERDICT_VIOLATIONS`, `test/verification-log-verdict-
   contract.test.ts:224-234`) FAILS: `docs/verification-log/index/0238-
   2026-08-15-task-w47-h-eval-findings-defect-ledger-32921050.md`'s
   `RESULT:` line reads `RESULT: NOT QUALIFYING — this is a docs-only
   scribe/mandate rebase inside a code wave; ...` — `verdictToken()`
   (`test/verification-log-verdict-contract.test.ts:178-180`) takes the
   first whitespace-delimited token, `"NOT"`, which is neither `PASS` nor
   `FAIL`, violating the contract every non-ratcheted section must meet.
   `0238` was added (wave 47, header sha `32921050`) after this ratchet
   test already existed, and no lane amended `LEGACY_VERDICT_VIOLATIONS`
   to include it (which would at least make the violation visible/tracked)
   nor changed `0238`'s own `RESULT:` line to start `PASS`/`FAIL` (its
   `NOT QUALIFYING` framing intentionally mirrors its `QUALIFYING`-line
   convention of "NOT QUALIFYING (code wave — ...)" but the contract test
   does not special-case that convention for `RESULT:` lines the way it
   does for the leading `QUALIFYING`/`NOT QUALIFYING` line). This is a
   genuine, previously-unfiled violation of a shrink-only ratchet — a
   regression the ratchet exists specifically to catch, now caught, not
   yet closed. **CONFIRMED-DEFECT, newly surfaced this session. Owner:
   wave-51 lane — either amend `docs/verification-log/index/0238`'s
   `RESULT:` line to start `PASS` or `FAIL` (its content is informational/
   scribe-only, so `PASS` naming what it did would fit the existing
   convention used by other `NOT QUALIFYING`-scoped code-wave sections),
   or add it to `LEGACY_VERDICT_VIOLATIONS`
   (`test/verification-log-verdict-contract.test.ts:224`) with a comment
   explaining why, per that array's own shrink-only-ratchet contract.**

`test/exit-predicate.test.ts`, `test/exit-predicate-corpus.test.ts`, and
`test/contacts-repo.test.ts` all passed clean (0 failures), confirming the
CLOSED verdicts above with a fresh exercised run, not a bare code read.
`test/decision-path-references.scan.test.ts` also passed clean.

## ADVISORY SECTION (NOT this lane's verdict — DEC-069 w50)

`npm run exit:predicate -- --product-sha
c6f5ab28ccf4c4a06096f95a460a66ad0be0687b` (the newest first-parent
product-code-bearing sha from this lane's own ref-state receipt above),
run and pasted VERBATIM:

```
SLOT               STATUS  SHA  HEADER
build-test-bundle  VOID    -    -
walkthrough        VOID    -    -
perf-smoke         VOID    -    -
spec-audit         VOID    -    -
triage-closure     VOID    -    -
```
(process exited 1: `exit-predicate: not all five DEC-069 slots are PASS at
product sha c6f5ab28ccf4c4a06096f95a460a66ad0be0687b.`)

All five slots read VOID because no wave-50 sibling section (the a/b/c/d
build+test+bundle / walkthrough / perf-smoke / spec-audit lanes, nor any
prior-wave triage-closure section that is ancestry-valid at this exact
product sha) has landed in `docs/verification-log.md` yet — this worktree
cannot see its four concurrent wave-50 siblings' sections, since none has
merged to `main` as of this lane's runtime. This is a SEQUENCING artifact,
not a product regression: it is pending on wave-50 siblings `task-w50-a`
(build+test+bundle), `task-w50-b` (walkthrough), `task-w50-c` (perf-smoke),
`task-w50-d` (spec-audit) — none of which is in this lane's worktree or
ancestry (per the ref-state receipt above, `task-w50-d` is NOT-ancestor;
`task-w50-a`/`-b`/`-c` ARE ancestor of this HEAD per the receipt but their
own index sections, if any, are pre-allocated seqs `0260`-`0263` not yet
assembled into `docs/verification-log.md` at this lane's read time — this
lane does not re-run `verification-log:assemble` speculatively for
siblings' not-yet-existing index files).

**This table is ADVISORY ONLY and is explicitly NOT this lane's verdict.**
The authoritative stage-1 exit ledger is a wave-51 lane cut AFTER wave 50's
merge train completes and all five required sections (plus this
triage-closure) are present and ancestry-valid at one shared product sha.
A future planner must not mistake this VOID table for a graded ledger —
it proves nothing about wave 50's four other slots except that they had
not yet synced into this worktree's view of `docs/verification-log.md`.

## RESULT

RESULT: FAIL — 2 CONFIRMED-DEFECT items remain open at `87cee8b9`, both
newly-verified-still-failing by this lane's own exercised targeted test
run (not inherited from any prior wave's verdict): (1)
`test/spec9-invariants.test.ts:131`, a clock-dependent test defect
(DEC-522 w49) unfixed since wave 49; (2)
`test/verification-log-verdict-contract.test.ts`'s shrink-only ratchet,
newly violated by `docs/verification-log/index/0238`'s non-PASS/FAIL
`RESULT:` line, not previously filed anywhere in this population. Every
other item across the wave-28-through-wave-48 population (0174-0240, no
exclusion) was reconciled at this lane's own runtime with a quoted
file:line, a named exercised test, or an explicit
VOID/NOT-A-DEFECT/MOOT/STALE ruling — all CLOSED or standing-ruling; the
admin-Speakers-toolbar row remains VOID and was not re-filed, per this
task's own instruction.

OPEN ITEMS: 2
