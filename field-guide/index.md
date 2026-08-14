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
- FINDINGS w32-63 (DEC-983..999, 001-999 FULL no DEC-1000+, `## Amendment
  (wave N)` on nearest existing DEC, heavily compacted): grep "no matches"
  is a fact about that minute only. DECISION DOC != FIX; MINTING IS IO;
  boundary fails per RECIPIENT never REQUEST; batch the FRONTIER not
  query-per-link; FIND-OR-CREATE NEEDS A UNIQUE INDEX; UNBOUNDED SURFACE
  NEVER PAGED; A WATERMARK ONLY SEES THE COLUMN IT COMPARES -- PARENT ROW
  IS THE SYNC UNIT; NAV != ROUTE.
- FINDINGS w1-72 (heavily compacted; DEC space FULL, rulings land as `##
  Amendment (wave N)` on the EXISTING file at that id): RE-PROBE THE
  MANDATE BEFORE SPENDING A LANE; A DECISION DOC IS NOT A BRANCH -- grep
  decisions/ first, implement verbatim; A FRAME NIT CAN CONTRADICT A
  LANDED DECISION; A FRAME "EXTRA" IS USUALLY A CAPABILITY -- restyle/
  disclose, never delete; A MIRROR MUST COPY THE ROLLBACK not just the
  ordering; A REVIEW LENS CAN BE WRONG ON PURPOSE (demo-credential
  "leak", DEC-583) -- record refusals so they aren't re-filed; A READER
  WITH NO WRITER IS A LIE THAT RENDERS NOTHING; A STALE EXCUSE OUTLIVES
  ITS CAUSE; ONE FORMATTER, TWO GRAMMARS; A CHROME LABEL CAN BE
  ROLE-SCOPED; A SECOND READER OF THE SAME WRITE INHERITS NONE OF ITS
  MANNERS -- grep EVERY caller of a route; A DELAY POLICY IS NOT A
  LOADING POLICY; A GUESSABLE URL THAT 404s IS A DEAD END; A RECEIPT
  STATES WHAT WAS RECEIVED; A FACET IS A CONTRACT; A CONTROL WITHOUT ITS
  SCRIPT/SAVE IS A PICTURE OR A LIE; A PROJECTION MUST CARRY ITS SOURCE'S
  LIMITS AND VOCABULARY; A HARDCODED SURFACE LIST GOES STALE; A
  DISCLOSURE IS NOT A DELETION; A FRAMED PRIMARY WITH NOTHING TO WRITE IS
  A LIE. REFUSALS RECORDED: aria-pressed (DEC-939), "Mean of submitted
  reviews" (DEC-873), roster Import-CSV link (DEC-662).
- FINDINGS w9 (compacted): ~65 mandate clauses re-probed at file:line
  across EVERY area — gate-4 reds, carried residue, SBEK run-3/4 P1/P2s,
  the SPEC J1-J12 bar — and ALL CLOSED, incl. the four review-lens
  "security" finds (files.ts:137 refuses reviewer writes; auth-session.ts
  rotates the PRESENTED token only; portal/tasks.tsx:429 rolls back R2 +
  rows; demo credentials = the recorded DEC-583 refusal). THE MANDATE IS
  SPENT — the next wave is verification, not fixes. Three survived, all
  one shape. A DUPLICATED FORMATTER DRIFTS AT ITS LAST COPY:
  paginationSummary exists twice byte-identically, inline twice more, and
  as an ASCII HYPHEN in Comms — DEC-906 said "one shape" and got five.
  A FIXTURE WRITTEN TO THE ANSWER CANNOT FAIL: ReviewerQueue's test
  pre-lowercased audienceLevel, so the seed's Title-Case "Advanced"
  rendering raw survived four waves — drive vocabulary tests from the
  SEED's own literals, never a hand-shaped fixture. A COMMENT CLAIMING A
  CHECK IS NOT THE CHECK (that test's comment claimed both clauses ran
  through formatMetaLabel; only `format` did). A "CANNOT IMPORT" COMMENT
  OUTLIVES ITS TRUTH: gridMath.ts:65 says app/src can't reach src/lib --
  its own line 21 does, and four other SPA files do too.
