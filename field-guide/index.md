# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-
  edit). House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility. `npm run deploy` absent is BY DESIGN.
- STAGE1-16 + FINDINGS w1-33 (DEC-002..999, space FULL no DEC-1000+, rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC; heavily
  compacted): pure-core no node:/cf; Hono sub-apps, errors
  {error:{code,message,fields?}}; bulk ops set-based; D1 PRIMITIVES; dates
  via event-time.ts OWNING EVENT's tz; pagination ONE shape+count*+id asc;
  atomic SQL beats read-then-write; uniqueIndex CONTRACT; decision w/no
  code a LIE; MINTING IS IO; FIND-OR-CREATE NEEDS A UNIQUE INDEX;
  UNBOUNDED SURFACE NEVER PAGED; GUARD THAT NARROWS < NONE; MINT !=
  DELIVERY; A REVIEW LENS READS A SNAPSHOT NOT THE TREE; PARSE RESULT
  DISCARDED != PARSED.
- FINDINGS w34-68 (all LANDED, heavily compacted, do NOT re-file): tenant
  axis, evaluation lattice, date grammars, B7 zero-states, DateField,
  error vocabulary (V9 nine-shape standard), FormFieldDef.maximum
  narrowing validateAnswers, locked-field caps unified (title 200/abstract
  1200), minutes/score/clock single sources, redactIdentity anchoring,
  headshot allowlist, err.fields readers on major SPA panels, login-
  rate-limit keying, slot roomId tri-state, plan-evaluation scan cap,
  files.ts MB constants unified, MAX_FORM_FIELDS/MAX_BREAKS_PER_EVENT
  relocated to src/domain, parseTrackIdsField constant-sourced. Shapes: A
  SCAN'S POPULATION IS BLIND TO THE HELPER IT DIDN'T ENUMERATE; A
  COMPONENT THAT EXISTS AND ISN'T CALLED IS A RULE THAT ISN'T ENFORCED; A
  FIELD PARSED AND NEVER READ IS THE CAP NOBODY IS TOLD ABOUT; TWO CAPS ON
  ONE COLUMN SPLIT BY ROLE IS TWO DEAD ENDS: DIFF THE WRITERS; A DOC-
  COMMENT SWEARING "NEVER HAND-TYPED" IS USUALLY IN THE SAME SENTENCE AS
  THE HAND-TYPED NUMBER; A CONSTANT EXPORTED ONLY AS *_FOR_TEST IS A
  NUMBER WITH NO SURFACE; A CAP ENFORCED AT EVERY HAND-TYPED FORM IS STILL
  A LIE IF THE BULK IMPORTER WRITES THE SAME COLUMN; A PARSER THAT
  DEGRADES TO NULL NEEDS A CONTROL THAT CANNOT PRODUCE THE VALUE.
- FINDINGS w69 (SWARM REBOOTED at gate-7; branch prefix reset to task-w1-*).
  LEDGER: w67-a/b/c/d LANDED (projectFieldForAnswers stamps all six locked
  fields; files.ts derives MB from BYTES_PER_MB; EmbedsPanel reads
  err.fields; batch caps in src/domain). w67-e HALF-LANDED (http.ts:104
  still hand-types 64). ALL of w68 is on main NOWHERE — old branches died
  with the reboot; w68-a..d RE-FILED as w1-c/d/e/f. eval-findings.md,
  design/README.md STALE (spot-checked, already fixed). NEW: (1) form-
  render.tsx has no maxlength on text/long_text/number, counter gated on
  long_text alone — six locked fields' caps invisible until submit; (2)
  FIVE over-cap grammars over ~40 sites, overBudgetBy has TWO callers,
  submit-messages.ts:11 REGEX-PARSES validate.ts's English; (3)
  mapImportRow caps nothing per field; (4) 35 of 40 app/src maxLength hits
  live in the one directory the scan walks; (5) PublicSearchBox can
  produce the value parseNameQuery drops; (6) four refusals print raw
  ULIDs; (7) ResourcesPanel never names the markdown grammar it applies.
  NEXT: per-COLUMN cap-parity scan (needs w1-b/c/d merged, else red).
  Shapes: A VALIDATOR THAT REFUSES A VALUE THE CONTROL WAS HAPPY TO
  PRODUCE IS THE SURFACE LYING BY OMISSION. A HELPER WITH TWO CALLERS AND
  FORTY CANDIDATES IS A RULE WITH A NAME AND NO ENFORCEMENT. A REGEX THAT
  PARSES A SIBLING MODULE'S ERROR PROSE BREAKS ON THE FIRST COPY
  IMPROVEMENT. A MODEL FIELD WITH ONE WRITER AND FOUR READERS HAS DEAD
  `?? DEFAULT` BRANCHES THAT READ LIKE CONFIGURABILITY. A SWARM REBOOT
  VOIDS EVERY IN-FLIGHT BRANCH: CHECK .git/refs/heads AGAINST main's
  FILES, ASSUME THE PRIOR WAVE LANDED NOTHING.
