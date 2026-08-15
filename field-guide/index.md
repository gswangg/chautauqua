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
- FINDINGS w5 (compacted; docs/design/*.dc.html IS the frame pack). Filed
  w5-a..g: plans-hub framed elements, compose step-4 report, .zip-as-SLIDE,
  danger-btn semantic red, role select behind a mode, Session details grid.
  Shapes: AN INTERIM SPEC DIES THE DAY ITS FRAME LANDS. A CONTROL BEHIND A
  MODE IS A CONTROL THE SCREEN DOESN'T HAVE.
- FINDINGS w6 (compacted): canEditSubmission DISCARDS status and locked
  accepted speakers out at close (restored, w/ canUploadDeliverables deleted
  as dup); reviewer scope null meant both "none"/"many", now a LIST w/ one
  formatter; login-band detail line hard-coded per headline, now a pair;
  `npm run deploy` NO LONGER absent by design; eval-findings.md archived.
  Affirmed (DEC-932/746): acceptance back-fill is DENSE by design. Shapes: A
  DISCARDED PARAMETER IS A RULE THAT STOPPED BINDING. A NULL MEANING BOTH
  "NONE" AND "MANY" TELLS THE USER "ALL". A MANDATE THAT OUTLIVES ITS FRAME
  PACK IS A MAP OF A DEMOLISHED CITY.
- FINDINGS w7 (planned on main; task-w5-a..g AND task-w6-a..e are all still
  unmerged branches — none of their twelve targets is re-filed here). Filed
  w7-a..d, each read off the tree: Settings' ONE portal action
  (PortalSettingsPanel.tsx:212 -> /portal) is bounced to /admin by speakerGate
  (portal/shared.tsx:55), so ruling A22's blessed row has no capability at all —
  a read-only GET /portal/preview (branding + welcome + resources, zero
  contact-scoped reads) is built instead of the wording fix A22 anticipated;
  docs/AUDIT.md prose drifted in four places (a /logout confirmation screen
  deleted in wave 25, an export list that names `sessions` — not a kind — and
  omits evaluations/email-log, a Resend-is-unbuilt bullet contradicted by
  src/mail/email-binding.ts, a missing AIRTABLE_ORG_ID throw), and EXPORT_KINDS
  joins routes + absence markers as a machine-checked claim; the agenda's only
  empty-state escape points at `/settings#…` — neither the route (/admin/settings)
  nor the grammar (?section=tracks-rooms) — and six sibling /admin anchors reload
  the whole SPA; YourDataPanel prints `chautauqua.cc/docs/api` as literal copy on
  every self-hosted instance while FormsPage.tsx:252 already derives the host.
  Shapes: AN ACTION ITS OWN ROLE CANNOT REACH IS NOT AN ACTION. A SELF-AUDIT
  MAINTAINED BY MEMORY IS THE DOCUMENT MOST LIKELY TO BE WRONG. A LINK TARGET
  NOBODY NAVIGATED IS A ROUTE NOBODY CHECKED. A HOSTNAME IN COPY IS TRUE ON
  EXACTLY ONE DEPLOYMENT.
