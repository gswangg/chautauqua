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
  NONE OF ITS MANNERS -- grep EVERY caller of a route; A GUESSABLE URL
  THAT 404s IS A DEAD END; A CONTROL WITHOUT ITS SCRIPT/SAVE IS A
  PICTURE OR A LIE; A PROJECTION MUST CARRY ITS SOURCE'S LIMITS AND
  VOCABULARY; A HARDCODED SURFACE LIST GOES STALE; A FRAMED PRIMARY WITH
  NOTHING TO WRITE IS A LIE. REFUSALS: aria-pressed (DEC-939), "Mean of
  submitted reviews" (DEC-873), Import-CSV link (DEC-662).
- FINDINGS w9 (compacted): mandate re-probed CLOSED except: A DUPLICATED
  FORMATTER DRIFTS AT ITS LAST COPY; A FIXTURE WRITTEN TO THE ANSWER
  CANNOT FAIL; A COMMENT CLAIMING A CHECK IS NOT THE CHECK.
- FINDINGS w10 (compacted): POLISH mandate spent — re-probed CLOSED items,
  formatMinutes LIVE (prior "dead code" find WRONG). Survivors: A WRITER
  WITH NO READER IS A LIE THAT STORES NOTHING; A CAP ON DERIVED WORK MUST
  BE STATED IN THE PRODUCER'S UNITS; AN UNBOUNDED inArray HIDES BEHIND A
  CHUNKED ONE (DEC-078 obeyed on one axis only); A DOC COMMENT CAN NAME A
  RULE NOTHING OBEYS; ONE FORMATTER, TWO GRAMMARS again; A GATE SPEC
  MANDATES IS NOT A BUG, ITS SILENCE IS.
- FINDINGS w11 (mandate re-probed at ~20 clauses; ALL closed except two
  found by fresh reading, so: STOP RE-PROBING THE MANDATE BY READING —
  DEC-438 amendment: a clause closes only on a NAMED EXECUTED TEST,
  annotated in place, never deleted, never for a pixel clause). New
  shapes: A RULE ENUMERATED BY EXAMPLE MISSES ITS NEXT MEMBER (DEC-519
  named title/description/room-name; event.timezone shifts every DTSTART
  through both .ics readers and bumped nothing). A SEED THAT NEVER MINTS
  A KIND CANNOT DEMO IT (no DEFAULT_ONBOARDING_TASK is file_request, so
  the whole upload-deliverable path ships unseeded — DEC-739). A
  PER-AREA SWEEP IS NOT AN INVARIANT (chunk sweeps existed for two
  areas; the rule is repo-wide). Mechanics: wave-10 lanes landed MID-PLAN
  (w10-c/w10-d were on main by mid-wave) — re-open the file:line at the
  moment of editing, not from the brief. Grep -C context can eat a
  leading `//`: read the file before believing a syntax error.
