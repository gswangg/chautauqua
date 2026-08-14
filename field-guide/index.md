# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-
  edit). House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-31 (DEC-002..982, heavily compacted): pure-core
  imports no node:/cf; Hono sub-apps, errors {error:{code,message,fields?}};
  bulk ops set-based; D1 binds PRIMITIVES; dates via event-time.ts OWNING
  EVENT's tz; pagination ONE shape+count*+`id asc`; atomic SQL beats
  read-then-write; uniqueIndex CONTRACT; negation skips NULLs; irreversible
  action a PAGE naming what goes AND what it refuses; decision with no code
  a LIE; submitted blank CLEARS, absent key is silence; a JOIN row cascades
  on contact delete.
- FINDINGS w32-72 (DEC-983..999, 001-999 FULL no DEC-1000+, rulings land as
  `## Amendment (wave N)` on the nearest EXISTING DEC, heavily compacted):
  grep "no matches" is a fact about that minute only; DECISION DOC != FIX;
  MINTING IS IO; boundary fails per RECIPIENT never REQUEST; batch the
  FRONTIER not query-per-link; FIND-OR-CREATE NEEDS A UNIQUE INDEX;
  UNBOUNDED SURFACE NEVER PAGED; A WATERMARK ONLY SEES THE COLUMN IT
  COMPARES -- PARENT ROW IS THE SYNC UNIT; NAV != ROUTE; RE-PROBE THE
  MANDATE BEFORE SPENDING A LANE; A DECISION DOC IS NOT A BRANCH -- grep
  decisions/ first, implement verbatim; A FRAME "EXTRA" IS USUALLY A
  CAPABILITY -- restyle/disclose, never delete; A MIRROR MUST COPY THE
  ROLLBACK not just the ordering; A REVIEW LENS CAN BE WRONG ON PURPOSE
  (demo-credential "leak", DEC-583) -- record refusals so they aren't
  re-filed; A READER WITH NO WRITER IS A LIE THAT RENDERS NOTHING; ONE
  FORMATTER, TWO GRAMMARS; A SECOND READER OF THE SAME WRITE INHERITS
  NONE OF ITS MANNERS -- grep EVERY caller; A GUESSABLE URL THAT 404s IS
  A DEAD END; A CONTROL WITHOUT ITS SCRIPT/SAVE IS A PICTURE OR A LIE; A
  PROJECTION MUST CARRY ITS SOURCE'S LIMITS/VOCABULARY; A HARDCODED
  SURFACE LIST GOES STALE; A FRAMED PRIMARY WITH NOTHING TO WRITE IS A
  LIE. REFUSALS: aria-pressed (DEC-939), "Mean of submitted reviews"
  (DEC-873), Import-CSV link (DEC-662).
- FINDINGS w9-11 (compacted, all CLOSED): DUPLICATED FORMATTER DRIFTS AT
  LAST COPY; FIXTURE WRITTEN TO THE ANSWER CANNOT FAIL; COMMENT CLAIMING A
  CHECK IS NOT THE CHECK; WRITER WITH NO READER STORES NOTHING; CAP ON
  DERIVED WORK MUST NAME PRODUCER'S UNITS; UNBOUNDED inArray HIDES BEHIND
  A CHUNKED ONE; GATE SPEC MANDATES IS NOT A BUG, SILENCE IS; RULE
  ENUMERATED BY EXAMPLE MISSES ITS NEXT MEMBER (DEC-519); SEED THAT NEVER
  MINTS A KIND CANNOT DEMO IT (DEC-739); PER-AREA SWEEP IS NOT AN
  INVARIANT. Mechanics: lanes land MID-PLAN, re-open file:line at edit
  time; grep -C eats leading `//`; DEC-438: clause closes only on a
  NAMED EXECUTED TEST.
- FINDINGS w12 (mandate + review-lens re-probed at ~12 clauses; ALL 8
  probed clauses ALREADY CLOSED on main). DESKTOP MANDATE IS EXHAUSTED BY
  READING; new desktop findings now need the external gate. New shapes,
  each found by fresh reading, not by the list:
  A COPY OF A PROP IS A SNAPSHOT, NOT A SUBSCRIPTION (DeliverableDetail's
  pill froze 'approved' through the reopen its own upload caused, hiding the
  Approve action that would republish); A CAPTION THAT NAMES A NUMBER MUST
  COUNT ('Two sessions in this slot' over an unbounded list); A PHONE SURFACE
  THAT REFUSES WHAT DESKTOP ALLOWS IS A DIFFERENT PRODUCT, NOT A REFLOW (J9
  never-blocking held only on the grid); A NEGATIVE SCAN IS NOT A FLOOR (44px
  test only forbids old 40px string); HIDDEN AT TOP LEVEL WITH NO OVERRIDE IS
  A PICTURE THAT NEVER RENDERS. Rulings landed as `## Amendment (wave 12)` on
  DEC-380/385/394/020/825.
