# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-
  edit). House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-33 (DEC-002..999, space FULL no DEC-1000+, rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC; heavily
  compacted): pure-core no node:/cf; Hono sub-apps, errors
  {error:{code,message,fields?}}; bulk ops set-based; D1 PRIMITIVES; dates
  via event-time.ts OWNING EVENT's tz; pagination ONE shape+count*+id asc;
  atomic SQL beats read-then-write; uniqueIndex CONTRACT; MINTING IS IO;
  UNBOUNDED SURFACE NEVER PAGED; GUARD THAT NARROWS < NONE; MINT !=
  DELIVERY; PARSE RESULT DISCARDED != PARSED.
- FINDINGS w34-69 (all LANDED, heavily compacted): tenant axis, evaluation
  lattice, date grammars, B7 zero-states, error vocabulary (V9),
  locked-field/minutes/score/clock single sources, MB/cap constants unified
  to src/domain. w69: SWARM REBOOTED at gate-7. Shapes: A FIELD PARSED AND
  NEVER READ IS THE CAP NOBODY IS TOLD ABOUT; A SWARM REBOOT VOIDS EVERY
  IN-FLIGHT BRANCH: CHECK .git/refs/heads AGAINST main's FILES.
- FINDINGS w2-w4 (compacted): DateField/search, EMB cards, password/builder/
  PlanEditor caps, logout, CSV dup, settings rail, gutters. Shapes: A CAP ONLY
  IN THE SPA IS A SUGGESTION. AN EXTERNAL FRAME MEASUREMENT LOSES TO README.md.
- FINDINGS w5 (compacted): plans-hub framed elements, compose step-4 report,
  .zip-as-SLIDE, danger-btn semantic red, role select behind a mode, Session
  details grid. Shapes: AN INTERIM SPEC DIES THE DAY ITS FRAME LANDS. A
  CONTROL BEHIND A MODE IS A CONTROL THE SCREEN DOESN'T HAVE.
- FINDINGS w6 (compacted): canEditSubmission DISCARDS status/locked-accepted
  (restored); reviewer scope null->LIST w/ formatter; login-band pair;
  `npm run deploy` restored; eval-findings.md archived; acceptance back-fill
  DENSE by design (DEC-932/746).
- FINDINGS w7 (planned on main; w5-a..g/w6-a..e unmerged, not re-filed). Filed
  w7-a..d: Settings' portal action bounced to /admin by speakerGate -> built
  read-only GET /portal/preview instead; docs/AUDIT.md prose drift (4 spots)
  fixed via EXPORT_KINDS machine-checked claim; agenda empty-state link wrong
  route/grammar, 6 sibling /admin anchors reload SPA; YourDataPanel hardcoded
  hostname now derived (FormsPage.tsx:252 pattern). Shapes: AN ACTION ITS OWN
  ROLE CANNOT REACH IS NOT AN ACTION.
- FINDINGS w8 (planned on main; w7-a..d still unmerged — portal/preview,
  AUDIT.md, agenda/SPA anchors and the derived API-docs host are NOT re-filed).
  Swept and found ALREADY LANDED, do not re-file without runtime evidence:
  fleet-list items (active-filter ink chip, headshot-fallback initials,
  files-library columns, hasActiveNarrowing+q, phone-block override test, Home
  820/44, root.tsx role redirects, distribute-with-preview, speakers List/Grid
  + nav, mail/shell.ts B9 shell, seed one-clock w/ CFP open -12/+18d); public
  agenda already frame's time-anchored sequence (A25 "no TBD column" holds);
  CNT-S3's edit loop already ?edit=1/?history=1 from DeliverableDetail. Filed
  w8-a..e, each read off the tree: session cards drop title/company that
  EMB-01(w3)/EMB-09(w2) require and the query already loads; Submissions has
  no route into Comms so J5's "select decided records -> compose" asks for
  the selection twice (?template= lands on step 2 w/ empty step 1); a round
  is an integer w/ no name or window though DEC-147 was opened for ABS-01's
  three; compose step 1 hides the slot until step 3 refuses the .ics; History
  fetches page 1 of a 50/page endpoint, prints a total it cannot reach. Shapes:
  A SAMPLE STRING IN A FRAME IS NOT A RULING — THE FRAME FIXES THE LINE, THE
  SOURCES FIX THE FACTS. A HANDOFF THAT DROPS THE SELECTION ASKS THE SAME
  QUESTION TWICE. A PAGED ENDPOINT RENDERED WITHOUT A PAGER IS A LIST THAT
  LIES ABOUT ENDING.
