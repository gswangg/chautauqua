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
  compacted, MANDATE ~EXHAUSTED, re-verified closed each wave): pure-core
  no node:/cf; Hono sub-apps, errors {error:{code,message,fields?}}; bulk
  ops set-based; D1 PRIMITIVES; dates via event-time.ts OWNING EVENT's tz;
  pagination ONE shape+count*+id asc; atomic SQL beats read-then-write;
  uniqueIndex CONTRACT; decision w/no code a LIE; JOIN cascades; MINTING IS
  IO; boundary fails per RECIPIENT not REQUEST; FIND-OR-CREATE NEEDS A
  UNIQUE INDEX; UNBOUNDED SURFACE NEVER PAGED; READER W/NO WRITER RENDERS
  NOTHING; GUESSABLE URL 404 DEAD END; SUB-APP onError SWALLOWS PARENT'S
  MANNERS; SCAN BINDS ONE CALL SHAPE MISSES SIBLING; GUARD THAT NARROWS <
  NONE; MINT != DELIVERY; CATCH RETURNING A DEFAULT IS NOT A GUARD; A
  REVIEW LENS READS A SNAPSHOT NOT THE TREE; A CLOSURE PROVEN AT THE REPO
  IS NOT PROVEN AT THE ROUTE; A CAP CHECKED AFTER THE BUFFER IS NOT A CAP;
  A BULK ID ARRAY IS A SET OR A DOUBLE-SEND; A BOUND ON THE WRITE SIDE IS
  NOT A BOUND ON THE READ SIDE; PARSE RESULT DISCARDED != PARSED; A
  WATERMARK STORING ITS OWN START LOSES LATE-COMMITTING WRITES; THE
  DECISIONS' OWN PATH REFS ARE A CHEAP DRIFT DETECTOR.
- FINDINGS w34-37 (compacted, do NOT re-file). Closed defects across both waves; TENANT axis SPOT-
  CHECKED not ENUMERATED still open since w37. Shapes: A REDACTOR IS SHAPES NOT ONE REGEX; CONSUME-
  BEFORE-VALIDATE TURNS A TYPO INTO A DEAD LINK; A CSRF CHECK IS NOT AN AUTHZ CHECK; A PROOF NOBODY HAS
  SHOWN A VIOLATION TO IS NOT A PROOF -- ship a NEGATIVE CONTROL; A PER-IDENTITY BUCKET IS NOT A
  BUDGET; CURRENT-TENSE PROSE IS A LIE WITH A TIMESTAMP; GREPPING A MODULE FOR AN IDENTIFIER PROVES AN
  IMPORT NOT A PAINT; A MOCKED RESOLVER PROVES THE ROUTE CALLS IT, NOT THAT IT FILTERS; A THROWING DB
  CANNOT PROVE A REFUSAL NEEDING A READ -- use REAL ROWS (node:sqlite+drizzle sqlite-proxy); SPOT-
  CHECKED IS NOT ENUMERATED; A 5xx IS NOT A REFUSAL; A REFUSAL THAT MUTATES IS NOT A REFUSAL.
- FINDINGS w38 (compacted). CLOSED w38-a (own-property files.ts); b/c/d (assign-guard, ReviewerQueue
  perPage, cron unfiltered read) OWNED BY w38 BRANCHES, reconfirmed still open w39. Shapes: AN
  ALLOWLIST KEYED BY USER INPUT IS AN OWN-PROPERTY QUESTION. A WRITE GUARD THAT DOESN'T MATCH THE READ
  PREDICATE MINTS INVISIBLE ROWS. A CLIENT THAT COUNTS ITS PAGE LIES ABOUT THE WHOLE. A REFUSAL WHOSE
  REMEDIATION NAMES A PARAMETER THE CALLER CANNOT SUPPLY IS A BUG IN THE CALLER. A PREDICATE FAMILY IS
  A LATTICE: spot-check one, drift all. Re-verified CLOSED: mailer MIME, portal replace-file version
  chains, CFP-05 CTA, results caption, no `#day` anchors. docs/eval-findings.md residue ~EXHAUSTED.
- FINDINGS w39 (verified AT THE FILE). NEW, taken: (1) getContactStats dropped returningSpeakers+
  eventCount end-to-end, reversing DEC-432/DEC-809 with a SOURCE COMMENT, no superseding DEC --
  scripts/walkthrough/data.ts:356-361 still asserts the field and fail()=process.exit(1), so
  `npm run walkthrough` dies at J11 and every J12 check after never runs. (2) MergePage.tsx scans page
  1 of /contacts/duplicates (server clamps 200) for its pair -- a duplicate past group 200 reads "no
  longer duplicates" and cannot be merged; pairPosition.total is the page length, not the true total.
  (3) own-property family has 4 more sites: mail/render.ts MERGE_FIELD_ALIASES, acceptance.ts
  FORM_TASK_FIELD_SPECS (read at submissions/status.ts:97), contacts.ts INVITE_STATUS_RANK,
  forms.ts LOCKED_* -- all latent (keys are literals today), all documented as if `?? fallback` catches
  an unknown key, which a prototype key defeats.
  OPEN for next planner: /contacts/stats runs findDuplicateGroupsForOrg (full-org scan+JS grouping) on
  every Contacts mount while the duplicates rail fires the SAME scan again -- two O(N) scans per page
  view (SPEC §7 one-round-trip+p95); absent from scripts/perf-smoke.ts.
  Re-verified CLOSED: conditional field logic server-side; import "N good rows"; task `instructions`
  end-to-end; public gates content_status='approved'; top-companies renders; onboarding-grid renders.
  Shapes: A FIGURE THE API PROMISES AND A LATER WAVE DELETES IS A DECISION REVERSED WITHOUT A DECISION
  -- read the DEC before deleting a field. AN ASSERTION IN A SCRIPT NOBODY RUNS IS A RED GATE NOBODY
  SEES -- bind script contracts with vitest. A CLIENT THAT SEARCHES ITS PAGE FOR A ROW REPORTS "GONE"
  FOR "PAGE 2". A FALLBACK (`?? x`) IS NOT A GUARD WHEN THE PROTOTYPE ANSWERS.
