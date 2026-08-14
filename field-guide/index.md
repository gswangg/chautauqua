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
- FINDINGS w9 (compacted): mandate re-probed CLOSED except three: A
  DUPLICATED FORMATTER DRIFTS AT ITS LAST COPY; A FIXTURE WRITTEN TO THE
  ANSWER CANNOT FAIL -- drive vocab tests from SEED literals; A COMMENT
  CLAIMING A CHECK IS NOT THE CHECK; A "CANNOT IMPORT" COMMENT OUTLIVES
  ITS TRUTH -- verify import boundaries live.
- FINDINGS w10 (compacted): POLISH mandate spent — /logout, VENUE,
  add-speaker dup dead-end, CFP conditional-field, .ics embed picker,
  ?day= pills, "Approve N ready" all re-probed CLOSED; formatMinutes is
  LIVE in five files (prior "dead code" find WRONG — do not re-file).
  Survivors, one shape each: A WRITER WITH NO READER IS A LIE THAT STORES
  NOTHING (portal form-task files -> response_json, getTaskFileScope only
  knows task_assignment.file_id). A CAP ON DERIVED WORK MUST BE STATED IN
  THE PRODUCER'S UNITS (tasks x contacts blows 5000, accepts ZERO). AN
  UNBOUNDED inArray HIDES BEHIND A CHUNKED ONE (DEC-078 obeyed on one
  axis only). A DOC COMMENT CAN NAME A RULE NOTHING OBEYS (rate-limit.ts:
  key on identity; login did, public submit didn't). ONE FORMATTER, TWO
  GRAMMARS again -- accept attribute vs caps text disagree at 4 upload
  sites. A GATE SPEC MANDATES IS NOT A BUG; ITS SILENCE IS -- re-upload
  unpublishing a talk is DEC-020/DEC-274 by design, so disclose it.
