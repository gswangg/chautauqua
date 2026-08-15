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
  atomic SQL beats read-then-write; uniqueIndex CONTRACT; MINTING IS IO;
  UNBOUNDED SURFACE NEVER PAGED; GUARD THAT NARROWS < NONE; MINT !=
  DELIVERY; PARSE RESULT DISCARDED != PARSED.
- FINDINGS w34-69 (all LANDED, heavily compacted): tenant axis, evaluation
  lattice, date grammars, B7 zero-states, error vocabulary (V9),
  locked-field/minutes/score/clock single sources, MB/cap constants
  unified to src/domain. w69: SWARM REBOOTED at gate-7. Shapes: A SCAN'S
  POPULATION IS BLIND TO THE HELPER IT DIDN'T ENUMERATE; A FIELD PARSED
  AND NEVER READ IS THE CAP NOBODY IS TOLD ABOUT; A SWARM REBOOT VOIDS
  EVERY IN-FLIGHT BRANCH: CHECK .git/refs/heads AGAINST main's FILES.
- FINDINGS w2 (verified, do not re-file): DateField/search fixes;
  "EMB cards omit title/company" is RULING DEC-968 not a defect. NEW
  class: password.ts unbounded hash at anon surface; builder.ts caps
  option not COUNT; PlanEditor MAX_CRITERIA=7 browser-only; contacts
  typeof-string guard skips non-string; views.ts no cap/event;
  form-render `max` never read by validate.ts. Shapes: A CAP THAT
  EXISTS ONLY IN THE SPA IS A SUGGESTION; A TYPEOF GUARD IN FRONT OF A
  CHECK IS A SKIP BRANCH UNTIL YOU MAKE IT A REFUSAL BRANCH.
- FINDINGS w3 (wave-2 train MID-FLIGHT when planned: w2-a..d branches
  exist unmerged, w2-e/f/g had no refs; scripts/with-test-lock.sh IS on
  main so w1-a landed). Verified STALE in eval-findings.md, do NOT
  re-file: /logout (GET redirects, POST signs out, ?signed-out=1 -
  DONE); portal upload session-selector reset (DEC-891's pickPreselected
  - DONE); CSV import same-email duplicates (DEC-663 wave-61 in-batch
  byEmail - DONE); results Speaker column co-presenters (row.speakers is
  an array - DONE); CFP edit intro->name data bug (intro is its own
  column end to end); AUTH_CSS .chq-field-invalid cascade (ERROR_STATES_
  CSS is at the TAIL of AUTH_CSS, which loads after ThemeStyles - it
  wins). Verified OPEN and filed as w3-a..h: settings rail key 'tracks'
  vs panel 'tracks-rooms' (a test's DRILL_KEY map was DOCUMENTING the
  bug); .chq-bare-page max-width with no width inside a flex body;
  five SSR `chq-btn-primary` with no `chq-btn`; .chq-empty-what 15px;
  hasActiveNarrowing omitting `q`; TemplatesTab Name column bound to
  derivePurpose; compose never posts templateId (root cause of BOTH
  "history shows TEMPLATE —" and the phantom "Recent Sends vs History
  two readers" - RecentSends is one component mounted twice, fed a
  null); compose/send has no dedupe window; `· optional` uppercased by
  its parent label. Shapes: A TEST THAT TRANSLATES BETWEEN TWO SPELLINGS
  OF ONE IDENTIFIER IS DOCUMENTING A BUG, NOT PINNING A CONTRACT. A
  SCAN THAT POLICES THE STRING IS BLIND TO THE STYLESHEET THAT REWRITES
  IT. max-width WITHOUT width IS A SUGGESTION TO A FLEX ITEM. A ZERO
  STATE THAT PICKS ITS VOICE FROM A SUBSET OF ITS OWN QUERY WILL
  EVENTUALLY TELL THE USER THEIR DATA IS GONE. A FACE CLASS WITHOUT ITS
  BOX CLASS IS PAINT WITH NO GEOMETRY. TWO QUESTIONS, ONE ANSWER: "what
  went out" AND "where did it come from" ARE NOT THE SAME FIELD.
