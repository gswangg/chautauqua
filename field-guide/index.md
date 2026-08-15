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
- FINDINGS w2-w7 (all LANDED, heavily compacted): DateField/search, EMB
  cards, password/builder/PlanEditor caps, logout, CSV dup, settings rail,
  gutters, plans-hub framed elements, compose step-4 report, .zip-as-SLIDE,
  danger-btn semantic red, role-select-behind-mode, Session details grid,
  canEditSubmission status/locked-accepted, reviewer scope null->LIST,
  login-band pair, `npm run deploy`, eval-findings.md archived, acceptance
  back-fill dense (DEC-932/746), portal/preview read-only route, AUDIT.md
  prose-drift machine check, agenda empty-state route/anchors, YourDataPanel
  derived hostname. Shapes: A CAP ONLY IN THE SPA IS A SUGGESTION. AN
  EXTERNAL FRAME MEASUREMENT LOSES TO README.md. AN INTERIM SPEC DIES THE
  DAY ITS FRAME LANDS. A CONTROL BEHIND A MODE IS A CONTROL THE SCREEN
  DOESN'T HAVE. AN ACTION ITS OWN ROLE CANNOT REACH IS NOT AN ACTION.
- FINDINGS w8 (mostly LANDED; session-card title/company, Submissions->Comms
  ?ids= handoff, compose step-1 SLOT+footer, History pager = w8-a/b/d/e
  STILL UNMERGED, not re-filed; w8-c round name/window IS on main). Shapes:
  A SAMPLE STRING IN A FRAME IS NOT A RULING. A HANDOFF THAT DROPS THE
  SELECTION ASKS THE SAME QUESTION TWICE. A PAGED ENDPOINT RENDERED WITHOUT
  A PAGER IS A LIST THAT LIES ABOUT ENDING.
- FINDINGS w9 (planned on main). Swept and found ALREADY LANDED, do not
  re-file without runtime evidence: edit-lock accepted-keeps-editing,
  reviewer multi-track scope LIST, `npm run deploy`, icsChip event-tz,
  settings field-width tokens (date 200/seats 110), /account/password
  Cancel + bare 820 column, Overview's dedupe caption, pipeline
  fit_score+rationale, content-note mailer, saved views/segments, home hub
  3 states + role redirects, portal resources, perf CLASS budgets
  (50/100/150), focus-ring + tap-target(44) + type-scale conformance tests,
  phone agenda N-aware clash + place-anyway, phone password footer+Cancel,
  Comms phone landing, Home footer media rule. Filed w9-a..e: README's
  render-sweep section asserts ">=40px" (twice) and "constant lands false"
  while code says 44 / ADMIN_MOBILE_PASS_BLOCKING=true; public speaker-
  detail draws the DEC-885 placeholder EMPTY (inline width, no initials)
  and prints a blank <p> for a speaker with no title/company; every version
  row asks to delete though ruling A3 asks only for the newest; verification
  -log's last receipt is wave 37 (2026-08-13), ~35 waves stale; eval-
  findings' fleet list is mostly landed and needs rebasing. Shapes: A
  README IS A DERIVED CLAIM — MACHINE-CHECK IT OR IT DRIFTS. ONE PLACEHOLDER,
  TWO RENDERINGS IS A PLACEHOLDER NOBODY OWNS. A CONFIRM ON EVERY ROW IS A
  CONFIRM NOBODY READS. AN IN-FLIGHT BRANCH IS OWNED, NOT OPEN AND NOT CLOSED.
