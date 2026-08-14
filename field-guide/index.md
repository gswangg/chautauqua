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
- FINDINGS w34-38 (compacted, do NOT re-file). Closed defects across all four waves; TENANT axis now
  covers PATH params (w37) but BODY/QUERY ids were open until w40-a below. Shapes: A REDACTOR IS SHAPES
  NOT ONE REGEX; CSRF != AUTHZ; A PROOF NOBODY HAS SHOWN A VIOLATION TO IS NOT A PROOF; A THROWING DB
  CANNOT PROVE A REFUSAL NEEDING A READ -- use REAL ROWS (node:sqlite+drizzle sqlite-proxy); A 5xx IS
  NOT A REFUSAL; A REFUSAL THAT MUTATES IS NOT A REFUSAL; AN ALLOWLIST KEYED BY USER INPUT IS AN OWN-
  PROPERTY QUESTION; A WRITE GUARD THAT DOESN'T MATCH THE READ PREDICATE MINTS INVISIBLE ROWS; A
  PREDICATE FAMILY IS A LATTICE: spot-check one, drift all.
- FINDINGS w39 (compacted). CLOSED: MergePage page-1 scan for pairs past group 200. STILL OPEN w40:
  getContactStats dropped returningSpeakers+eventCount w/no superseding DEC, breaking
  `npm run walkthrough` at J11 (scripts/walkthrough/data.ts:356-361); own-property family latent sites
  (mail/render.ts, acceptance.ts, contacts.ts, forms.ts); /contacts/stats + duplicates rail both run
  findDuplicateGroupsForOrg (two O(N) scans/mount). Shapes: A FIGURE THE API PROMISES AND A LATER WAVE
  DELETES IS A DECISION REVERSED WITHOUT A DECISION; AN ASSERTION IN A SCRIPT NOBODY RUNS IS A RED GATE
  NOBODY SEES; A CLIENT THAT SEARCHES ITS PAGE FOR A ROW REPORTS "GONE" FOR "PAGE 2".
- FINDINGS w40 (verified AT THE FILE; w39 branches a-d were still IN FLIGHT, not on main — not re-filed).
  NEW, taken: (1) Scorecard.tsx:157 counts the queue PAGE (queueDoneCounts(res.items)) while ReviewerQueue
  beside it reads the envelope — DEC-845's w38 ruling was applied to the component that prompted it, not to
  the endpoint's other reader; same file's submitAndAdvance takes items[0] of a list that KEEPS rated rows,
  so after the last score it re-opens a scored card and the done state never arrives. (2) DuplicatesView.tsx:92
  states its page length under a header stating the org total; groups past 200 have no pager and can never be
  merged. (3) PlanEditor.tsx:1667 states `reviewers.length` (plan_reviewer ROWS, page-capped) as "N reviewers"
  while /plans/:id/progress already returns one row per USER with a true total the component discards (:416).
  (4) PipelineBoard EnrollDialog (:504) is a <select> over `/contacts?perPage=200` — past 200 contacts the
  picker cannot pick, silently; the co-presenter search (`/contacts?q=`) is the idiom that already exists.
  STALE, corrected: "TENANT axis SPOT-CHECKED not ENUMERATED" — w37's four probes DO enumerate it for PATH
  params; the real residue is ids arriving in BODY/QUERY (w40-a).
  STILL OPEN for the next planner: /contacts/stats + the rail's /contacts/duplicates run findDuplicateGroupsForOrg
  TWICE per Contacts mount (two O(N) org scans, two round trips); deferred this wave because w39-a/c own
  stats.ts/merge.ts/crud.ts. Also: getContactStats THROWS the duplicate-scan refusal past 20k contacts, taking
  total/topCompanies/speakerCount down with it.
  Shapes: A RULING BINDS THE ENDPOINT, NOT THE COMPONENT THAT PROMPTED IT — fix the reader family, not the
  reader. A "NEXT" THAT TAKES ITEM[0] OF A LIST THAT KEEPS DONE ITEMS NEVER TERMINATES. A ROW COUNT IS NOT A
  PEOPLE COUNT. A PICKER FED BY PAGE 1 CANNOT PICK. A POPULATION DERIVED BY PATH SHAPE IS BLIND TO THE ID IN
  THE BODY.
