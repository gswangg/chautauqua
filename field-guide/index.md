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
- FINDINGS w2-w3 (compacted, all filed/landed): DateField/search fixes;
  EMB cards is RULING not defect; password.ts hash cap, builder.ts caps,
  PlanEditor MAX_CRITERIA browser-only, typeof-string guard skip,
  form-render `max` unread; logout, portal reselect, CSV dup, results
  co-presenters, CFP intro/name, AUTH_CSS cascade; settings rail key
  mismatch, .chq-bare-page max-width w/o width, SSR primaries missing
  chq-btn, hasActiveNarrowing missing q, compose templateId dedupe.
  Shapes: A CAP ONLY IN THE SPA IS A SUGGESTION. A TYPEOF GUARD IS A
  SKIP UNTIL IT'S A REFUSAL. A TEST TRANSLATING TWO SPELLINGS OF ONE
  IDENTIFIER DOCUMENTS A BUG, NOT A CONTRACT. max-width WITHOUT width
  IS A SUGGESTION TO A FLEX ITEM. A FACE CLASS WITHOUT ITS BOX CLASS IS
  PAINT WITH NO GEOMETRY.
- FINDINGS w4 (planned against main, wave-3 a..e in flight, f/g/h not
  re-filed). Verified STALE, do NOT re-file: "admin measure 1372@114"
  CONTRADICTS README §Widths (table=1440, authority over frame packs);
  reminders-modal leak (gone); dup ranked-results head; per-version
  Delete; matrix header Edit; roster Import-CSV; contact drawer groups;
  API-token shown-once; scorecard role=radio pills; import dedupe
  rename; public search button hidden by design; TBD room filter;
  portal B6; Overview/programme empty states. Filed w4-a..g (OPEN): B8
  selected-row edge missing + bleeds measure (margin-inline:-16px) on
  .chq-review-plan-row.is-active / .chq-participation-menu-item
  .is-current; portal EDIT drops "what speakers may edit" pills READ
  shows; files-library FILE/SESSION unpinned starves filename; .chq-
  settings-field-pair .chq-settings-field{width:100%} overrides every
  --chq-field-w-* token; TracksRooms "Add track" 2nd olive primary;
  public filters at 99px pill radius + outlined active chip (want 4px
  ctl radius + ink-fill chip); two gutters (268 vs 126) for one
  time/room stack. Shapes: AN EXTERNAL FRAME MEASUREMENT LOSES TO
  README.md ON CONFLICT. width:100% ON A TOKENISED FIELD DEFEATS THE
  TOKEN SYSTEM IT LIVES INSIDE. TWO SURFACES, TWO WIDTHS = THE MEASURE
  WAS NEVER A TOKEN. A PHONE FRAME'S FULL-WIDTH BAR IS NOT THE DESKTOP
  ADD AFFORDANCE. A STATE PAINTING THE FILL BUT NOT THE EDGE IS HALF A
  STANDARD.
