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
- FINDINGS w4 (compacted; a..g landed/re-verified over w5): B8 selected-row
  edge/bleed measure; portal EDIT dropped pills READ shows; files-library
  FILE/SESSION unpinned; settings-field-pair width:100% override; TracksRooms
  dup primary; public filters radius/chip; two gutters for one stack. Shapes:
  AN EXTERNAL FRAME MEASUREMENT LOSES TO README.md ON CONFLICT. width:100%
  ON A TOKENISED FIELD DEFEATS THE TOKEN SYSTEM IT LIVES INSIDE. A PHONE
  FRAME'S FULL-WIDTH BAR IS NOT THE DESKTOP ADD AFFORDANCE.
- FINDINGS w5 (planned on main; w3-b/e/f/g/h + w4-a..f still unmerged — their
  targets re-verified ABSENT from main, so nothing here re-files them).
  docs/design/*.dc.html IS the frame pack now (gate-7's v9 line refs do NOT
  resolve here — re-read the vendored file before filing). Filed w5-a..g:
  reviewer plans-hub row has 2 of 5 framed elements + H1 names the page not
  the work (Review :695-733/:937); compose step-4 is paragraphs, not the
  framed report (Comms :495-536); .zip passes as a SLIDE while the frame
  refuses it and ships it as a handout (Content :448/:480) and the refusal is
  an inline ribbon, not the 560 modal (:431-457); .chq-confirm-btn-danger
  paints #7a2a1e — A SEMANTIC RED IN A PALETTE THAT HAS NONE, unseen ~70
  waves, no hex scan; people-rows flex space-between, role select hidden
  behind a mode (Settings :978); Session details stacks h3s not the 150/1fr
  label-left grid, roles as bare text (Submissions :259-300/:665); ONE
  reserved contact key wears another's label ("Dietary" = travel_logistics),
  test translates the mismatch (Contacts :899-904). Shapes: AN INTERIM SPEC DIES
  THE DAY ITS FRAME LANDS. A PER-KIND ALLOWLIST IS THE ONLY WAY TWO FRAMES
  CAN BOTH BE TRUE. A VOCABULARY WITH NO SCAN IS A CONVENTION. A CONTROL
  BEHIND A MODE IS A CONTROL THE SCREEN DOESN'T HAVE.
