# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1 (DEC-002..365, COMPLETE): pure-core src/{auth,domain,forms,
  mail,lib} import nothing node:/cf; 012/013 route files export Hono
  sub-apps, errors {error:{code,message,fields?}}; bulk ops set-based.
- REDESIGN w1-10 (DEC-366..419, FUNCTION FROZEN): tokens frozen, ONE
  dialog contract, phone @700px; D1 binds PRIMITIVES (epoch-ms
  NUMBER); dates via event-time.ts OWNING EVENT's tz never toISOString;
  public lists LIMIT+COUNT(DISTINCT).
- STAGE1-CLOSE w11-20 (DEC-420..470, compacted): ledger names its sha,
  FAIL-unowned vs PENDING-OWNED; ONE email rule via findAccountUserId
  (contactId OR email) NEVER email alone; universal rows graded from
  ENUMERATION never sample; pagination ONE shape `page?:{limit,offset}`
  +count*+`id asc`; a cap the UI can't see LIES, render `total`.
- STAGE1-CLOSE w21-24 (DEC-471..492, compacted): A BRANCH IS NOT A LANDING --
  grade every row from file:line at the sha or `git merge-base
  --is-ancestor`. Enumeration = re-runnable ARTIFACT scanning the CLAMP
  EXPRESSION not a const's existence; JSON feeds owe HTML's paging truth;
  two implementations of one invariant means one is wrong -- atomic SQL
  beats read-then-write.
- STAGE1-CLOSE w25 (DEC-493..498, compacted): walkthrough resolves the
  seeded event by SLUG; event-clock strings carry their event's tz. A
  ceiling never filled is not a measurement. Ledger grades at file:line at
  ITS OWN sha, ancestor-checks a missing fix (PENDING-OWNED not
  FAIL-unowned). Evidence predating a rework is not evidence about it;
  lanes kill only their own PID.
- STAGE1-CLOSE w26 (DEC-499..504, compacted): tree moves mid-plan -- read the
  FILE, then read it AGAIN. 499 iCalendar PARAMs sanitized at SERIALIZER.
  500 options validated against EFFECTIVE kind. 501 an answer never
  outlives the rule that made it askable. 502 paged JSON = ONE window.
  503/504 hand-listed manifests/procedures desync -- enumerate in a test.
- STAGE1-CLOSE w27 (DEC-505..507, compacted): FOURTH wave the tree moved
  mid-plan. 505 a control the UI offers must be one the server persists
  (FieldPatch gained kind+section; kind change REFUSED 409 while answers
  exist). 506 ONE likeContains home, escape-only, paired with ESCAPE '\' at
  every site incl. unauthenticated search. 507 stage-1 exit: evidence
  predating a fix cannot close it -- re-measure at a fresh sha, log names end
  -stage1.
- STAGE1-CLOSE w28 (DEC-508..514): FIFTH wave the tree moved mid-plan -- 505
  AND 506 both landed BETWEEN reads of this pass. Read the FILE, then read
  it AGAIN, then grade. Three new defects, ONE shape: server accepts what
  its own UI would never send. 508 opening kind to PATCH (505) re-opened
  500's hole from the far side -- options required when kind CHANGES to
  dropdown, not merely when SENT; exemption keys on "already a dropdown".
  509 plan maxEvaluations/openDate/closeDate reach D1 uncast-checked;
  max_evaluations=0 empties every reviewer queue in silence though the SPA
  validator says ">= 1". 510 event dates pass an ORDER check, no FORMAT
  check, yet computeDays/isDayWithinEventRange assume YYYY-MM-DD -- agenda
  500s or drops every slot; regex already existed on the READ path. 511 a
  landed invariant needs a GLOBBED enumeration, not spot checks that let it
  rot twice. 513 hand-copied credentials desync from the vendored fixture --
  derive both sides, correct README not docs/. 514: exit wave carries ZERO
  product tasks -- a lane's HEAD is the wave's BASE sha, so DEC-497 voids
  evidence of its own fixes; w28 is NOT that wave, claims no closure.
