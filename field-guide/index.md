# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1 (DEC-002..365, COMPLETE): pure-core src/{auth,domain,forms,
  mail,lib} import nothing node:/cf; 004 hash 'pbkdf2$v1$100000$salt$
  hash'; 012/013 route files export Hono sub-apps, errors
  {error:{code,message,fields?}}; bulk ops set-based/CLOSED, LOG-ONLY.
- REDESIGN w1-10 (DEC-366..419, FUNCTION FROZEN): tokens frozen, NO
  RED/shadows/new deps; styles.css+theme.ts=ONE lane; ONE dialog
  contract, phone @700px, 44px controls; D1 binds PRIMITIVES (epoch-ms
  NUMBER); 2px olive focus ring; dates via event-time.ts OWNING
  EVENT's tz never toISOString; ONE parseBoundedText, 400 never 500;
  public lists LIMIT+COUNT(DISTINCT).
- STAGE1-CLOSE w11-17 (DEC-420..453, compacted): 426 WCAG AA THIRD;
  433 public ?page= TWO bounds; 434 ONE isDevMode(env); 438 ledger
  names its sha, FAIL-unowned vs PENDING-OWNED; 447 LEDGER TRAP:
  closing wave = ONE source-changing lane, ledger behind it; 448 a
  PASS ledger is evidence about ITS OWN sha only; 453 never grade a
  MEASURED budget row from code presence; 452 fix waves cut NO ledger.
- STAGE1-CLOSE w18-19 (DEC-454..464, compacted): CALL-SITE PRESENCE
  != coverage. 454 ONE email rule at EVERY contact.email
  write/lookup; 455 trim()==="" is ABSENT; 456 account lookup is
  findAccountUserId(contactId OR email) NEVER email alone; 457 KV
  keys never carry raw external input; 459 "all"/"every"/"never" rows
  graded from an ENUMERATION never a sample. 460 pagination hand list
  found SHORT by w17-f's enumeration (14 unbounded, NO "naturally
  small" exemptions); 461 ONE shape: `page?:{limit,offset}`, sibling
  count*, ORDER BY `id asc`, default perPage 200. 462-464:
  session-email fixed, react-router advisory closed, w19=5 lanes NO
  ledger.
- STAGE1-CLOSE w20 (DEC-465..470, compacted): only task-w20-c actually
  merged (w21 found the other four branches unlanded, see 472). 465
  ONE listPerPage(raw) in src/lib/pagination.ts, five clampPerPage
  copies to delete. 466 DEC-460's hand list SHORT BY THREE; criterion
  MECHANICAL, re-derived never inherited. 467 user.email obeys DEC-454
  too. 468 cap the UI can't see LIES -- render `total`. 469 unmeasured
  budget row is decoration. 470 w20=fix wave NO ledger.
- STAGE1-CLOSE w21 (DEC-471..474): w20 planned 5 source lanes; ONLY
  task-w20-c reached main (reflog tip `merge task-w20-c`; no
  listPerPage, pipeline still `clampPerPage(q ?? 200)`, PipelineBoard
  still `{entries.length}`) -- yet decisions/ + src/decisions.ts +
  this guide all narrated DEC-465..469 as done. 472: A BRANCH IS NOT A
  LANDING. Grade every row from file:line at the sha or
  `git merge-base --is-ancestor`, NEVER from a DEC doc, a
  `void DEC_NNN`, or this guide; unmerged-but-owned = NOT PASS. 471:
  re-running DEC-466's OWN criterion found 2 more sites its prose
  never named -- `/api/v1/submissions/:id/files` +
  `/api/v1/files/:fileId/comments` ship bare `{items}` while the SPA
  types them ListEnvelope, so `res.total` is `number` in TS and
  undefined on the wire. 473: enumeration = ARTIFACT (re-runnable
  command + raw output + 1 row per site in 4 fixed classes + live 2k
  probe), not prose beside a mechanical claim. 474: w21 = 1 source
  lane + 4 evidence lanes + ledger last.
