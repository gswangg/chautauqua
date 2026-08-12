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
- STAGE1-CLOSE w11-24 (DEC-420..492, compacted): ledger names its sha,
  FAIL-unowned vs PENDING-OWNED, ancestor-check via `git merge-base
  --is-ancestor` (a branch is not a landing); ONE email rule via
  findAccountUserId NEVER email alone; universal rows graded from
  ENUMERATION never sample (re-runnable artifact scanning the CLAMP
  EXPRESSION, not a const's existence); pagination ONE shape
  `page?:{limit,offset}` +count*+`id asc`; a cap the UI can't see LIES,
  render `total`; JSON feeds owe HTML's paging truth; two implementations
  of one invariant means one is wrong -- atomic SQL beats read-then-write.
- STAGE1-CLOSE w25-26 (DEC-493..504, compacted): walkthrough resolves the
  seeded event by SLUG; event-clock strings carry their event's tz. A
  ceiling never filled is not a measurement; evidence predating a rework
  is not evidence about it; lanes kill only their own PID. Tree moves
  mid-plan -- read the FILE, then read it AGAIN. iCalendar PARAMs sanitized
  at SERIALIZER; options validated against EFFECTIVE kind; an answer never
  outlives the rule that made it askable; paged JSON = ONE window;
  hand-listed manifests/procedures desync -- enumerate in a test.
- STAGE1-CLOSE w27-28 (DEC-505..514, compacted): tree moves mid-plan
  repeatedly (505/506 landed between reads) -- read the FILE, then read it
  AGAIN, then grade. Recurring shape: server accepts what its own UI would
  never send. 505 FieldPatch kind+section, kind change REFUSED 409 while
  answers exist. 506 ONE likeContains, escape-only, ESCAPE '\' at every
  site incl. unauthenticated search. 508 dropdown options required when
  kind CHANGES to dropdown, not merely when SENT. 509 plan numeric fields
  validated route-side both POST/PATCH, never uncast bind. 510 event dates
  strict ISO YYYY-MM-DD, ONE isIsoDate home. 511 LIKE-escaping locked by
  GLOBBED enumeration not spot checks. 513 hand-copied credentials
  contract-tested against vendored fixture both directions. 514 exit wave
  = ZERO product tasks (a lane's HEAD is the wave's BASE sha, so DEC-497
  voids evidence of its own fixes); w28 was NOT that wave.
- STAGE1-CLOSE w29 (DEC-515..519): w28 landed BETWEEN two reads AGAIN (sixth
  wave) -- 509/510/511/513 all appeared mid-pass. w29 is NOT the exit wave:
  DEC-514's zero-product rule fires only when a FRESH read finds no defect,
  and this pass found four. 515 an export that drops the abstract and every
  custom answer is lock-in, the thing the premise forbids -- the admin table
  already offers "any answer as a column". 516 a contract fixed in the route
  is not fixed in the query: DEC-502's slice still fetches 1200 rows to
  return 12. 517 ONE isEpochMs; a form whose close precedes its open dies
  silently -- order checks read the MERGED post-patch state. 518 even the
  test that guards a manifest must DERIVE it. 519 SUMMARY/DESCRIPTION/
  LOCATION are as significant as DTSTART -- rename a talk or a room and
  every subscriber's calendar keeps the old text forever.
