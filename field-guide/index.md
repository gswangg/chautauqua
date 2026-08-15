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
- FINDINGS w2-w4 (compacted, all filed/landed): DateField/search, EMB cards
  RULING, password/builder/PlanEditor caps, form-render `max` unread, logout,
  portal reselect, CSV dup, results co-presenters, settings rail, B8
  selected-row bleed, portal EDIT pills, files-library unpinned, public
  filters, gutters. Shapes: A CAP ONLY IN THE SPA IS A SUGGESTION. width:100%
  ON A TOKENISED FIELD DEFEATS THE TOKEN SYSTEM. AN EXTERNAL FRAME
  MEASUREMENT LOSES TO README.md ON CONFLICT.
- FINDINGS w5 (compacted; docs/design/*.dc.html IS the frame pack, gate-7 v9
  refs do NOT resolve — re-read the vendored file before filing). Filed
  w5-a..g: reviewer plans-hub 2/5 framed elements + wrong H1; compose step-4
  paragraphs not framed report; .zip passes as SLIDE, refusal inline not
  modal; .chq-confirm-btn-danger a SEMANTIC RED IN A PALETTE THAT HAS NONE;
  role select hidden behind a mode; Session details wrong grid; reserved
  contact key mislabeled. Shapes: AN INTERIM SPEC DIES THE DAY ITS FRAME
  LANDS. A CONTROL BEHIND A MODE IS A CONTROL THE SCREEN DOESN'T HAVE.
- FINDINGS w6 (planned on main; task-w5-a..f are still unmerged branches, so
  none of their seven targets is re-filed here). Filed w6-a..e: canEditSubmission
  DISCARDS status (`void status`, edit-lock.ts:21) and locks accepted speakers out
  at close, against SPEC.md:298 + clarifications.md:39 + the portal frame's own
  post-acceptance "Edit your session" (Public and Portal.dc.html:597-620) —
  restored, and canUploadDeliverables deleted as the same rule under a second
  name; a reviewer on 2+ tracks resolves to null (progress.ts:42) and both
  consumers paint null as "All tracks" — scope is now a LIST with ONE shared
  label formatter, server-side only so w5-a's file is untouched; the login band's
  detail line is hard-coded (auth-views.tsx:87) so a RATE-LIMITED sign-in advises
  checking credentials that are fine — band copy is a {headline, detail?} pair and
  the rejection takes the frame's two lines; `npm run deploy` absent is NO LONGER
  by design (wrangler.jsonc carries real D1/KV ids, send_email, chautauqua.cc) and
  README's stage-2 list contradicts its own live-demo paragraph; eval-findings.md
  is the PREVIOUS generation's v7/v8/v9 mandate — archived and re-based.
  NOT filed, affirmed instead (DEC-932/DEC-746): acceptance back-filling every
  event task to the newly accepted is the DENSE model on purpose — the SPA never
  calls /tasks/:id/assign at all, and test/onboarding-task-backfill.test.ts
  already pins insert-only. Shapes: A DISCARDED PARAMETER IS A RULE THAT STOPPED
  BINDING. A NULL THAT MEANS BOTH "NONE" AND "MANY" TELLS THE USER "ALL". A DETAIL
  LINE WRITTEN FOR ONE HEADLINE IS FALSE UNDER THE NEXT. A DEFERRAL OUTLIVES THE
  DAY ITS PLATFORM LANDS. A MANDATE THAT OUTLIVES ITS FRAME PACK IS A MAP OF A
  DEMOLISHED CITY.
