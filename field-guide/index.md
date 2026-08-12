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
  --is-ancestor`, re-read the FILE not an old grep. Enumeration = re-runnable
  ARTIFACT scanning the CLAMP EXPRESSION not a const's existence; MAX_PUBLIC_
  ROWS = MAX_PUBLIC_PAGE x PER_PAGE, MEASURED not asserted; JSON feeds owe
  HTML's paging truth; ONE projection/ONE constants-home beats duplication;
  two implementations of one invariant means one is wrong -- atomic SQL beats
  read-then-write.
- STAGE1-CLOSE w25 (DEC-493..498, compacted): walkthrough harness resolves
  the seeded event by SLUG. Event-clock strings carry their event's tz
  (formatIcsChip REQUIRED timeZone); audit timestamps stay viewer-local. A
  ceiling never filled is not a measurement. Closing ledger grades at
  file:line at ITS OWN sha, ancestor-checks a missing fix to its OWNING
  branch (PENDING-OWNED not FAIL-unowned). Phone/render evidence predating a
  rework is not evidence about it. Evidence lanes kill only their own PID.
- STAGE1-CLOSE w26 (DEC-499..504, compacted): tree moves mid-plan -- read the
  FILE, then read it AGAIN. 499 iCalendar PARAM values sanitized at the
  SERIALIZER (CN strips DQUOTE+CTL, `;`/`:` stay legal). 500 options
  validated against the EFFECTIVE kind (patch ?? stored), not a check dead
  under `if (input.kind !== undefined)`. 501 an answer never outlives the
  rule that made it askable -- writer deletes what the validator hid, same
  computed set. 502 paged JSON = ONE window, not HTML's cumulative show-more.
  503 hand-listed manifests desync -- enumerate SURFACES in a test. 504 a
  quickstart must run the same predev on every port.
- STAGE1-CLOSE w27 (DEC-505..507): the tree moved mid-plan for the FOURTH wave
  -- w26-a/b landed BETWEEN two reads of one pass (builder.ts had no effective-
  kind rule at read 1, had it at read 2), while c/d/e/f were still absent.
  Read the FILE, then read it AGAIN. 505 a control the UI offers must be a
  control the server persists: FieldModal edits kind+section, FieldPatch
  carried neither, so PATCH returned 200 and changed nothing -- and a kind
  change is REFUSED (409, DEC-300's shape) while answers exist, because
  stored answers were validated against the old kind. 506 three LIKE call
  sites had neither escaping nor ESCAPE '\' while TWO copies of likeContains
  had both: `?q=%` on the unauthenticated speakers search returned the whole
  roster. One home, escape-only -- folding the PATTERN without folding the
  COLUMN is redundant for ASCII and strictly loses non-ASCII matches. 507
  stage-1 exit: evidence predating the fixes cannot close them, so every lane
  re-measures at this sha, and verification-log filenames MUST end -stage1 --
  docs/verification-log/ already holds first-campaign task-w27-*.md that an
  unsuffixed name overwrites.
