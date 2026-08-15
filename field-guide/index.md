# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never
  hand-edit). Invariants: fail loudly; status changes never auto-email
  (one sanctioned exception, DEC-720); authz every route, server-side
  visibility.
- STAGE1-16 + FINDINGS w1-33 (DEC-002..999, space FULL no DEC-1000+, rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC): pure-core no
  node:/cf; Hono sub-apps, errors {error:{code,message,fields?}}; bulk ops
  set-based; D1 PRIMITIVES; dates via event-time.ts; pagination ONE shape+
  count*+id asc; atomic SQL>read-then-write; uniqueIndex CONTRACT; MINTING
  IS IO; UNBOUNDED SURFACE NEVER PAGED; GUARD THAT NARROWS < NONE.
- FINDINGS w2-30 (heavily compacted): DateField/search/CSV/compose/reviewer-
  scope/error-vocab/locked-field/write caps unified; contact merge, CSRF,
  bulk-email dedupe, table-layout, sub-pixel geometry, bleed-vs-clamp,
  citations must quote. TOOL TRAP: Grep -C drops some `/`. LINE NUMBER IS
  NOT AN IDENTITY. A COUNT IS NOT A LICENCE TO SCAN (DEC-829/773); A
  UNIVERSAL NEEDS A POPULATION; A DESKTOP PASS CAN'T SEE A PHONE-ONLY
  COMPONENT'S ERRORS.
- FINDINGS w31-34 (heavily compacted): A RECORDED RULING IS NOT A LANDED
  FIX (DEC-358/773/338) — re-check refs each wave. "ONE ROUND TRIP PER
  VIEW" HAS SERVER+PUBLIC+WRITE SIDES (DEC-338/774/155/598): Promise.all
  wave, `allSettled`+re-throw SOURCE order. RANKING IS PER-POPULATION
  (DEC-829); PER-ID LOOP IS NOT A BATCH (`chunkIds`); COMMENT-ONLY
  INVARIANT IS A FALLBACK (DEC-170); FALSE-MECHANISM GUARD INVITES ITS
  OWN REMOVAL (DEC-060, Hono DOES merge mount prefix — enforcement =
  `role-refusal-probe.test.ts`).
- FINDINGS w35 (compacted): all w32/w33 lanes merged+deleted; w34-b Vary:
  Cookie fix landed. A BRANCH-LOCAL PASS IS NOT A CLOSURE (DEC-644 w35):
  row closes only at a boundary carrying every fix credited (w32-a/b,
  w29-c/d). AN ABSENCE IS A MEASUREMENT (DEC-358 w35): re-glob every
  "does not exist" claim; packed-refs can be stale, loose wins. ONE
  DOOR IS NOT A POPULATION (DEC-099 w35): universal needs route-table
  enumeration + negative control. NAMED SET IN SPEC IS A POPULATION
  (DEC-063 w35). SURFACE W/ NO PERF ROW IS OPTIMISED BLIND (DEC-338 w35).
- FINDINGS w36 (main moved 0db68e36 -> 10e628aa DURING planning): ALL SIX
  w35 lanes produced work — `-b` render-sweep (green, exit 0), `-c` DEC-099
  cacheability enumeration (+ a real src fix: no-store responses were still
  carrying `Vary: Cookie`), `-d` /portal perf rows + perf speaker, `-a` perf
  reading, `-e` SPEC §9 four invariants, `-f` findings rebase. Read
  `.git/logs/refs/heads/<branch>` — the branch reflog names each lane's
  COMMIT MESSAGE, the cheapest way to learn what a live lane owns.
- A SNAPSHOT IS NOT A STATE (DEC-069 w36): merge train runs while you plan;
  re-read refs at the END of planning. A GATE INSIDE A CODE WAVE CAN
  NEVER QUALIFY (DEC-069 w36): w28-g graded 0/5, w35-a's perf reading was
  voided by sibling w35-c before merge. Wave 36 freezes src/app/migrations/
  package.json so five receipts share one product sha; findings FILED
  with file:line + owner, never fixed by the lane that measured them.
- A RECEIPT NAMES THREE SHAS (DEC-644 w36): HEAD, newest product-bearing
  first-parent sha, `merge-base --is-ancestor` per live sibling ref. A row
  closes only if credited fixes are proven ancestors.
- A CREDITED ROW FOR A SELECTOR THE INSTRUMENT NEVER ENUMERATES IS AN
  INSTRUMENT GAP (DEC-426 w36): `.chq-participation-menu-caret` was FAILed
  by w28-d, "fixed" by w29-d and "PASSed" by w29-c — and w35-b proved no
  such check exists. Verification-log sections are appended as NEW files
  under `docs/verification-log/index/` (`--next-seq`), then assembled;
  never hand-edit docs/verification-log.md.
