# task-w28-g — STAGE-1 EXIT LEDGER @ frozen literal 3564c7747e211f0e5857091e5909536c56e31b4a

LOG-ONLY lane. Touches nothing under `src/`, `app/src/`, `scripts/`, `test/`,
`migrations/`, `package.json`. This lane is the one wave-28's own gate lanes
(a/b/c/e/f) deferred reading — it reads DEC-069's predicate whatever it finds,
per the wave-27 amendment's "READ the predicate this wave" ruling and the
wave-28 amendment's explicit re-statement that a `RESULT: FAIL` with an honest
`OPEN ITEMS: n` is a result, not a licence to defer a fourth time.

## (1) Frozen literal

`git -C task-w28-g rev-parse HEAD` at worktree cut:

```
3564c7747e211f0e5857091e5909536c56e31b4a
```

`git log --oneline -20` at that sha (most recent first):

```
3564c774 merge task-w27-g
c6dbdb7c scribe wave 28
e2a49545 merge task-w27-c
4b14f0b9 merge task-w27-f
e5d4a955 merge task-w27-d
644aacc8 docs: task-w27-g TIER-1 fidelity re-check @ ceda66f2
d87ca117 task-w27-c: J1-J12 walkthrough + curl spot checks @ ceda66f2
5a47d8a1 docs(eval-findings): compact rebase per DEC-358 wave-27 amendment
25b0d592 task-w27-d: perf-smoke + render-sweep receipt @ ceda66f2
7af126a2 merge task-w27-e
42e5ac69 merge task-w27-b
0d0e24e8 merge task-w27-a
d8974cf6 Merge repair (wave 26): cross-lane integration fixes
068440a5 task-w27-e: DEC-069 static-audit widened per DEC-063 (§6/§7 mechanical checks)
989810fb task-w27-b: build+test+bundle diagnostic receipt @ ceda66f2
900f8326 Fix last render-sweep offender: drop line-height:1 on display-face headings (DEC-991)
ceda66f2 scribe wave 27
b0cd495a merge task-w26-f
0a5991f9 merge task-w26-d
1b026b99 merge task-w26-c
```

Main WILL move under this ledger while it works (it has moved under every
prior ledger in this log). Every grade below is against the frozen literal
`3564c774` above, never against whatever `main` has since accreted.

## (2) Newest product-code-bearing sha

Walking `git log --first-parent --name-only 3564c774`, the newest commit
touching `src/**`, `app/src/**`, `migrations/**` or `package.json` (per
DEC-069's wave-28 amendment, which allow-lists `scripts/**`, `test/**`,
`docs/**`, `decisions/**`, `field-guide/**` and pure string-constant appends
to `src/decisions.ts`) is:

```
0d0e24e88752d9de94653b7cd88a207bc74d9eca  merge task-w27-a
```

Files changed: `app/src/pages/comms/comms.css`, `app/src/pages/forms/forms.css`,
`src/routes/auth.css.ts` (all `-1` line each — the DEC-991 line-height:1
deletions), plus `test/display-heading-line-height.scan.test.ts` (allow-listed).
Every first-parent commit newer than `0d0e24e8` up to `3564c774` (`42e5ac69`,
`7af126a2`, `e5d4a955`, `4b14f0b9`, `e2a49545`, `c6dbdb7c`, `3564c774`) touches
only `docs/**`, `decisions/**`, or `field-guide/**` — confirmed by
`--name-only` inspection, none advance the product sha.

**PRODUCT SHA: `0d0e24e8` ("merge task-w27-a").**

## (3) Five required DEC-069 sections, graded against the product sha

Grepped `docs/verification-log.md` (`^## ` headers) back through the wave-27
entries. The five most recent candidate sections, all labelled `[DIAGNOSTIC]`
(not `[QUALIFYING]`) per the wave-26/27 amendments, are:

### build+test — `task-w27-b`

```
## 2026-08-15 task-w27-b — build+test+bundle @ ceda66f2 [DIAGNOSTIC]
...
OPEN ITEMS: 2 — (1) in-process test SQLite fixture bootstrap missing
`user.name` column despite schema.ts/migrations already having it,
breaking 9+ test files; (2) `POST /api/v1/users` 500s via `db.select is
not a function` in `getAnchorEventForOrg` on the mutating path.
RESULT: FAIL — full-suite vitest run has 37 failing tests across 11 files
at S; build, bundle:check, db:migrate, and seed all PASS; the wave-16 red
spa-mutation-contract scan is confirmed GREEN.
```

Measured at `ceda66f2`, which is the parent of `d8974cf6`, which is the
parent of `0d0e24e8` — i.e. `ceda66f2` PRE-DATES the product sha `0d0e24e8`.
Also explicitly labelled `[DIAGNOSTIC]`, not `[QUALIFYING]`, by design (wave-27
amendment: "the battery as explicitly DIAGNOSTIC receipts that hand wave 28 a
defect list"). Not usable as the qualifying section.

GRADE: no qualifying section at/after product sha. `task-w28-b` carries
commits beyond base (`bb702a52` vs base `3564c774`) — live branch, work not
yet on the frozen literal. **PENDING-OWNED(task-w28-b)**.

### J1-J12 walkthrough — `task-w27-c`

```
## 2026-08-15 task-w27-c — walkthrough @ ceda66f2 [DIAGNOSTIC]
...
OPEN ITEMS: 1 (speaker/DEC-244 "version 2", same open item task-w26-f
already carries — not double-counted as new)
RESULT: FAIL — one J1-J12 walkthrough check (speaker/DEC-244 "version 2")
reproduces unfixed at the wave-27 tip; all three curl spot checks
(orphan-free CFP upload failure, no-auto-email status transitions,
immediate un-accept purge) PASS.
```

Same `ceda66f2` pre-product-sha timestamp, same `[DIAGNOSTIC]` label.

GRADE: `task-w28-a` carries commits beyond base (`0778816b` vs `3564c774`).
**PENDING-OWNED(task-w28-a)**.

### perf smoke — `task-w27-d`

```
## 2026-08-15 task-w27-d — perf-smoke + render-sweep @ ceda66f2 [DIAGNOSTIC]
...
OPEN ITEMS: 5
RESULT: perf-smoke FAILED (4 read-budget overruns, default profile; 2
persist/worsen under aie); render-sweep found 5 genuinely open items plus
2 rows already owned by in-flight task-w27-a; task-w25-e's cfp-step-next
keyboard focus-visible fix confirmed NOT resolved live.
```

Same `ceda66f2` pre-product-sha timestamp, `[DIAGNOSTIC]`.

GRADE: `task-w28-c` carries commits beyond base (`a8dacd1b` vs `3564c774`).
**PENDING-OWNED(task-w28-c)**.

### SPEC §8/§9 static audit — `task-w27-e`

```
## 2026-08-15 task-w27-e — spec-audit §6/§7/§8/§9 @ ceda66f2 [DIAGNOSTIC]
...
INVALIDATED BY: src/**, app/src/**, migrations/**, SPEC.md, README.md, docs/eval-rubric/**
OPEN ITEMS: 1
RESULT: PASS — 5 of 6 widened §6/§7 items confirmed (FK-index coverage
complete, code-split confirmed, no raw-SQL interpolation, HTML content-type
guard + secrets hygiene confirmed, rubric-coverage scan green at S); 1 item
(§7-3 bundle size) pending-at-S, no wave-27 measurement landed, last known
value (wave 26) is well inside budget.
```

Same `ceda66f2` pre-product-sha timestamp, `[DIAGNOSTIC]`, and its own
`RESULT:` is `PASS` with `OPEN ITEMS: 1` (not 0) besides.

GRADE: `task-w28-e` carries commits beyond base (`3d6ef260` vs `3564c774`).
**PENDING-OWNED(task-w28-e)**.

### triage closure

No `[QUALIFYING]` triage-closure section for wave 28 exists anywhere in
`docs/verification-log.md` at or before the frozen literal. `task-w28-f`
(the assigned triage-closure lane per this task's own text) resolves to
`3564c7747e211f0e5857091e5909536c56e31b4a` — **identical to the frozen base**.
Per DEC-069's wave-17 amendment: "a branch whose ref equals its base is
recorded as PRODUCED NOTHING and its scope returns to unowned."

GRADE: **FAIL-unowned** — triage closure has no owning branch with any
commits at read time.

## (4) DEC-991 line-height:1 independent re-confirmation

`grep -n "line-height" app/src/pages/forms/forms.css app/src/pages/comms/comms.css src/routes/auth.css.ts`:

```
app/src/pages/forms/forms.css:107:  line-height: 1.2;
app/src/pages/forms/forms.css:118:  line-height: 1.2;
app/src/pages/forms/forms.css:198:  line-height: 1.5;
app/src/pages/comms/comms.css:199:  line-height: 1.5;
app/src/pages/comms/comms.css:342:  line-height: 1.5;
app/src/pages/comms/comms.css:357:  line-height: 1.5;
app/src/pages/comms/comms.css:371:  line-height: 1.5;
app/src/pages/comms/comms.css:430:  line-height: 1.65;
app/src/pages/comms/comms.css:766:  line-height: 1;
app/src/pages/comms/comms.css:1136:  line-height: inherit;
src/routes/auth.css.ts:68:    line-height: 1.2;
src/routes/auth.css.ts:72:    .chq-auth-body { font-size: 15px; line-height: 1.63; color: var(--chq-ink-2); margin: 0; }
```

The one surviving `line-height: 1` (comms.css:766) is on `.chq-insert-field-menu-caret`
(`font-size: 11px; color: var(--chq-muted); line-height: 1;` — a DEC-993
caret glyph, not a display-face heading; comment at comms.css:759-762
explicitly documents it as "the caret is its own element ... in muted ink").
No `line-height: 1` remains alongside any display-face heading rule in the
three files DEC-991 named. The wave-27 fix (`900f8326`, merged as `0d0e24e8`)
is confirmed present on this frozen literal.

`test/display-heading-line-height.scan.test.ts` (144 lines, added by the same
commit) run live at this literal: `npx vitest run
test/display-heading-line-height.scan.test.ts` — **5/5 tests PASS**. A scan
now exists to prevent the rule from growing back.

## (5) Verdict

**STAGE 1 IS NOT COMPLETE.**

Blockers:

1. Build+test qualifying section not yet on the frozen literal — owner: `task-w28-b`.
2. J1-J12 walkthrough qualifying section not yet on the frozen literal — owner: `task-w28-a`.
3. Perf-smoke qualifying section not yet on the frozen literal — owner: `task-w28-c`.
4. SPEC §8/§9 static-audit qualifying section not yet on the frozen literal — owner: `task-w28-e`.
5. Triage-closure section (`OPEN ITEMS: 0`) does not exist anywhere in the log,
   and its assigned lane (`task-w28-f`) has produced zero commits (ref equals
   base) — owner: `unassigned`.
6. Even once wave-28's own qualifying sections land, the underlying substantive
   defects the wave-27 DIAGNOSTIC battery found are still open at this literal
   and have no confirmed fix on this tree: (a) build+test — 37 failing tests /
   11 failing files (SQLite fixture missing `user.name`, `getAnchorEventForOrg`
   `db.select is not a function`); (b) walkthrough — speaker/DEC-244 "version 2"
   deliverable-panel FAIL, reproduced across two waves; (c) perf-smoke — 4-6
   read-budget overruns depending on profile plus 5 render-sweep opens; (d)
   spec-audit — §7-3 bundle size unmeasured at product sha. None of these are
   confirmed fixed by any commit visible at `3564c774`; owner: `unassigned`
   until a wave-28 (or later) code lane claims them.

No lane can be graded PASS by inference. Five required rows: zero PASS, four
PENDING-OWNED (named branches with live commits not yet merged), one
FAIL-unowned (triage closure, no owning branch with any work).
