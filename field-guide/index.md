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
  --is-ancestor`, never a DEC doc or this guide, and re-read the FILE not an
  old grep (planned lanes land mid-read). Enumeration = re-runnable ARTIFACT
  scanning the CLAMP EXPRESSION not a const's existence; fieldId re-keyed
  like the field's id or silently dead; MAX_PUBLIC_ROWS = MAX_PUBLIC_PAGE x
  PER_PAGE, MEASURED not asserted; clamps collapse onto clampPerPage(50);
  JSON feeds owe HTML's paging truth; import cap IS the write-burst bound;
  ONE projection/ONE constants-home beats duplication; FAIL-unowned closes
  need the enumeration entry DELETED not relaxed; a knob the URL advertises
  must be honored by HTML and .json alike; two implementations of one
  invariant means one is wrong -- atomic SQL beats read-then-write.
- STAGE1-CLOSE w25 (DEC-493..498, compacted): walkthrough harness resolves
  the seeded event by SLUG, fills locked fields by the product's own rule.
  Event-clock strings carry their event's tz (formatIcsChip REQUIRED
  timeZone); audit timestamps stay viewer-local. A ceiling never filled is
  not a measurement -- perf seed reaches SPEC's top end via co-speakers.
  Closing ledger grades at file:line at ITS OWN sha, ancestor-checks a
  missing fix to its OWNING branch (PENDING-OWNED not FAIL-unowned), strikes
  an open item whose own cited source contradicts it. Phone/render evidence
  predating a rework is not evidence about it. Evidence lanes each own a
  port, kill only the PID you spawned, never pkill -f.
- STAGE1-CLOSE w26 (DEC-499..504): the tree moved mid-plan for the THIRD wave
  running -- w25-b/c/e landed between two greps of ONE pass (the first grep saw
  icsChip with no timeZone and no coSpeaker export; the second saw both). Read
  the FILE, then read it AGAIN before you write the task. 499 iCalendar PARAM
  values are sanitized at the SERIALIZER, not upstream: CN strips DQUOTE +
  every CTL (a public CFP name injects CRLF into every published .ics), while
  `;`/`:` stay legal -- over-stripping is its own bug. 500 options are
  validated against the EFFECTIVE kind (patch ?? stored): a rule nested under
  `if (input.kind !== undefined)` is DEAD on a PATCH that never sends kind,
  and `{"options":[]}` bricks a live dropdown silently. 501 an answer never
  outlives the rule that made it askable -- the validator strips hidden
  answers, so the WRITER must delete them, from the same computed set. 502 a
  paged JSON feed returns ONE window; HTML's cumulative show-more is not the
  feed's contract. 503 two hand-listed manifests of one set desync, and the
  one that desynced was the PHONE pass -- enumerate SURFACES in a test. 504 a
  quickstart that works only on the default port is not a quickstart. Ledger
  still owed: PENDING-OWNED (task-w25-f); w27 grades these six at their own
  sha.
