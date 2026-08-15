# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never
  hand-edit). Invariants: fail loudly; status changes never auto-email
  (one sanctioned exception, DEC-720); authz every route, server-side
  visibility.
- STAGE1-16 + FINDINGS w1-30 (DEC-002..999, space FULL no DEC-1000+; rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC): pure-core no
  node:/cf; Hono sub-apps; errors {error:{code,message,fields?}}; bulk ops
  set-based; D1 PRIMITIVES; pagination ONE shape+count*+id asc; atomic
  SQL>read-then-write; uniqueIndex CONTRACT; MINTING IS IO; UNBOUNDED
  SURFACE NEVER PAGED. TOOL TRAP: Grep -C drops some `/`. LINE NUMBER IS
  NOT AN IDENTITY. A UNIVERSAL NEEDS A POPULATION (DEC-829/773).
- FINDINGS w31-36 (heavily compacted): A RECORDED RULING IS NOT A LANDED
  FIX (DEC-358/773/338) — re-check refs each wave. RANKING IS
  PER-POPULATION (DEC-829); PER-ID LOOP IS NOT A BATCH (`chunkIds`).
  AN ABSENCE IS A MEASUREMENT (DEC-358 w35): re-glob every "does not
  exist" claim; packed-refs can be stale, loose wins. ONE DOOR IS NOT A
  POPULATION (DEC-099 w35): universal needs route-table enumeration +
  negative control. A SNAPSHOT IS NOT A STATE (DEC-069 w36): merge train
  runs while you plan; re-read refs at END of planning. A GATE INSIDE A
  CODE WAVE CAN NEVER QUALIFY (DEC-069 w36): w28-g graded 0/5, w35-a's
  perf reading voided by sibling w35-c before merge — wave 36 froze
  src/app/migrations/package.json so five receipts share one product sha.
  A RECEIPT NAMES THREE SHAS (DEC-644 w36): HEAD, newest product-bearing
  sha, `merge-base --is-ancestor` per live sibling ref. A CREDITED ROW
  FOR A SELECTOR THE INSTRUMENT NEVER ENUMERATES IS AN INSTRUMENT GAP
  (DEC-426 w36). Verification-log sections are appended as NEW files
  under `docs/verification-log/index/` (`--next-seq`), then assembled;
  never hand-edit docs/verification-log.md.
- FINDINGS w37 (main `3b3b56c7` = merge task-w36-b @ f5783479): w36-a/-d
  COMMITTED-UNMERGED, -b MERGED (walkthrough PASS, 0 open, product sha
  3a041507), -c/-e AT BASE AND STILL RUNNING when planned. A BRANCH MINUTES
  OLD AT ITS BASE IS RUNNING, NOT DEAD (DEC-069 w37) — re-filing its scope
  duplicates the wave. WAVE 37 IS THE SECOND FROZEN WAVE: no src/, app/src/,
  migrations/, package.json — a fix landed beside the ledger voids the
  battery the ledger grades.
- THE ASSEMBLER MINTS COLLIDING SEQS BY CONSTRUCTION (DEC-068 w37):
  `nextSeq()` reads only the highest prefix, so every concurrent lane gets
  the same number (w35's silent 0188->0189 rewrite). docs/verification-log.md
  is GENERATED — on conflict take NEITHER side, re-run
  `tsx scripts/assemble-verification-log.ts`.
- A UNIVERSAL WITH NO FAILING CASE IS NOT A MEASUREMENT (DEC-099 w37): every
  derived population ships a NEGATIVE CONTROL; known violations go in a
  RATCHET (red when fixed too), never an allowlist. A CLOSED ROW NAMES ITS
  FALSIFYING CHECK (DEC-358 w37) or is labelled UNFALSIFIABLE + owner.
- A RECEIPT BLOCK IS GENERATED (DEC-644 w37): `scripts/ref-state.ts`. Read
  refs via `git for-each-ref` — globbing .git/refs/heads misses PACKED refs;
  .git/packed-refs' `refs/heads/main` is stale, the loose ref wins.
- DEC-296 w37: resolveBaseUrl's dev-loopback exception needs a loopback
  origin ON THE REQUEST; a scripted fetch under route-shadowed `wrangler dev`
  has none, so any non-default port poisons every mailed link — two
  walkthrough gates lost a full run each. Walkthrough now pre-flights.
