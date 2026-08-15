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
- FINDINGS w34-69 (all LANDED, heavily compacted, do NOT re-file): tenant
  axis, evaluation lattice, date grammars, B7 zero-states, DateField,
  error vocabulary (V9), FormFieldDef.maximum narrowing validateAnswers,
  locked-field caps unified, minutes/score/clock single sources,
  redactIdentity anchoring, headshot allowlist, err.fields readers on
  major SPA panels, login-rate-limit keying, files.ts MB constants
  unified, MAX_FORM_FIELDS/MAX_BREAKS_PER_EVENT relocated to src/domain.
  w69: SWARM REBOOTED at gate-7 (branch prefix task-w1-*), w67 landed,
  w68 was nowhere on main and re-filed as w1-c..f. Shapes: A SCAN'S
  POPULATION IS BLIND TO THE HELPER IT DIDN'T ENUMERATE; A FIELD PARSED
  AND NEVER READ IS THE CAP NOBODY IS TOLD ABOUT; A DOC-COMMENT SWEARING
  "NEVER HAND-TYPED" IS USUALLY IN THE SAME SENTENCE AS THE HAND-TYPED
  NUMBER; A CAP ENFORCED AT EVERY HAND-TYPED FORM IS STILL A LIE IF THE
  BULK IMPORTER WRITES THE SAME COLUMN; A VALIDATOR THAT REFUSES A VALUE
  THE CONTROL WAS HAPPY TO PRODUCE IS THE SURFACE LYING BY OMISSION; A
  SWARM REBOOT VOIDS EVERY IN-FLIGHT BRANCH: CHECK .git/refs/heads
  AGAINST main's FILES, ASSUME THE PRIOR WAVE LANDED NOTHING.
- FINDINGS w2 (wave-1 train was MID-FLIGHT when planned: only w1-a on
  main; w1-b..e branches unmerged; w1-f/g had no refs. Verified, do not
  re-file): eval-findings.md STALE on three items checked -- DateField
  silent date drop FIXED, public search Enter-only occlusion FIXED, "EMB
  cards omit title/company" is a RECORDED RULING (DEC-968), not a defect.
  NEW class, five instances + one inversion: (1) password.ts hashes an
  unbounded password at an anonymous, failures-only-rate-limited surface;
  (2) builder.ts bounds each option but not the option COUNT, never
  type/length-checks rule.value for a text trigger; (3) review/shared.ts
  parseCriteriaList bounds nothing while PlanEditor.tsx:156 hand-declares
  `MAX_CRITERIA = 7` -- a cap living ONLY in the browser; (4)
  contacts/crud.ts's `if (typeof value === 'string') checkLen(...)` SKIPS
  the non-string into the DB; (5) views.ts's isValidSavedViewConfig
  accepts q/columns/trackId of any size, no cap on views per event; (6)
  form-render.tsx's number `max` declared a bound validate.ts never read.
  Shapes: A SCAN THAT POLICES WHERE CAPS LIVE IS BLIND TO THE COLLECTION
  THAT HAS NO CAP AT ALL. A CAP THAT EXISTS ONLY IN THE SPA IS A
  SUGGESTION -- DIFF THE CONTROL'S CONSTANT AGAINST THE VALIDATOR'S. A
  TYPEOF GUARD IN FRONT OF A CHECK IS A SKIP BRANCH UNTIL YOU MAKE IT A
  REFUSAL BRANCH. AN EXCLUSION WRITTEN AS TEMPORARY BECOMES POLICY THE
  WAVE AFTER IT IS WRITTEN. NEXT: collection-cap LEDGER scan over every
  Array.isArray/Object.entries body parse (needs w2-c..f merged, else
  red); per-COLUMN cap-parity scan still needs w1-b/c/d.
