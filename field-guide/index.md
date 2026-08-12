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
- STAGE1-CLOSE w11-26 (DEC-420..504, compacted): ledger names its sha,
  FAIL-unowned vs PENDING-OWNED, ancestor-check via `git merge-base
  --is-ancestor`; ONE email rule via findAccountUserId NEVER email alone;
  universal rows graded from ENUMERATION never sample; pagination ONE shape
  `page?:{limit,offset}` +count*+`id asc`; a cap the UI can't see LIES,
  render `total`; two implementations of one invariant means one is wrong
  -- atomic SQL beats read-then-write; walkthrough resolves seeded event by
  SLUG; event-clock strings carry their event's tz; a ceiling never filled
  is not a measurement; evidence predating a rework is not evidence about
  it; lanes kill only their own PID; tree moves mid-plan -- read the FILE,
  then AGAIN; iCalendar PARAMs sanitized at SERIALIZER; hand-listed
  manifests/procedures desync -- enumerate in a test.
- STAGE1-CLOSE w27-29 (DEC-505..519, compacted): recurring shape -- tree
  moves mid-plan repeatedly, server accepts what its own UI would never
  send, w28 NOT the exit wave (DEC-514 fires only on a FRESH read finding
  no defect; w29 found four). FieldPatch kind change REFUSED 409 while
  answers exist; ONE likeContains escape-only incl. unauth search; dropdown
  options required when kind CHANGES; plan numerics validated both
  POST/PATCH; event dates strict ISO, ONE isIsoDate home; LIKE-escaping via
  GLOBBED enumeration; credentials contract-tested vs vendored fixture both
  directions; export dropping custom answers is the lock-in forbidden; a
  route-fixed contract isn't a query-fixed one (full rows fetched for a
  slice); order checks read MERGED post-patch state; a manifest-guard test
  must DERIVE it; SUMMARY/DESCRIPTION/LOCATION as significant as DTSTART.
- STAGE1-CLOSE w30 (DEC-520..525): w29's a/b landed BETWEEN two reads again
  (seventh wave) -- 515/516 appeared mid-pass; d/e still in flight, not
  re-issued. 520 acceptance auto-creates its default task set with NO due
  date, so J6's cron, its overdue counts and its own grid column are dead for
  exactly those rows -- masked because the SEED sets due_date; a default set
  owes a default schedule. 521 one INSERT per (contact,task) pair = ~5k serial
  D1 statements per bulk accept; chunked multi-row VALUES + a NAMED bound that
  REFUSES before the first write (an invisible drop is worse than a 400).
  522 the big one: a date-only field is a DAY LABEL, not an instant. DISPLAY
  it as its day (read UTC) -- the portal and the reminder email said Feb 28
  where the admin grid said Mar 1. EXPAND it to an event-local instant at
  every HARD gate -- a CFP set to close Mar 1 closed at 16:00 Feb 28 and SAID
  so on the public page; same bug locks speaker edits and empties reviewer
  queues a day early. Soft signals (SQL overdue, 72h window) compare the label
  raw, BY DECISION. 523 the one wildcard events.ts documents as forbidden was
  live in portal-config, inert only by MOUNT ORDER -- so its test composes in
  the ADVERSARIAL order. 524 three date-input converters in one SPA, one of
  them NaN-silent. 525 the global pubcache bump is fail-safe by construction;
  KV's same-key write ceiling is stage-2 and unobservable on Miniflare -- an
  unverifiable fix is not a fix, so it is dispositioned, not spent.
