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
  FAIL-unowned vs PENDING-OWNED, PASS is evidence about ITS OWN sha
  only; ONE email rule everywhere via findAccountUserId(contactId OR
  email) NEVER email alone; universal rows graded from ENUMERATION
  never sample; pagination ONE shape `page?:{limit,offset}`+count*+
  `id asc`, ONE listPerPage(raw); a cap the UI can't see LIES, render
  `total`.
- STAGE1-CLOSE w21-22 (DEC-471..480, compacted): A BRANCH IS NOT A LANDING --
  grade every row from file:line at the sha or `git merge-base
  --is-ancestor`, never a DEC doc or this guide; enumeration = re-runnable
  ARTIFACT not prose; fieldId re-keyed like the field's id or silently dead;
  MAX_PUBLIC_ROWS = MAX_PUBLIC_PAGE x PER_PAGE, MEASURED not asserted; ONE
  import cap; every list endpoint graded by executable enumeration test.
- STAGE1-CLOSE w23-24 (DEC-481..492, compacted): re-grade from file:line at
  wave start, never a doc comment (481) or a brief written before mid-plan
  merges (w23/w24 both had planned lanes land mid-read -- re-read the FILE,
  not an old grep). Clamps collapse onto clampPerPage(50) not listPerPage
  (482); enumeration scans the CLAMP EXPRESSION not a const's existence
  (483); JSON feeds owe HTML's paging truth (484); import cap IS the
  write-burst bound, O(rows) (485); ONE projection/ONE constants-home beats
  duplication (486/487); FAIL-unowned closes need the enumeration entry
  DELETED not just relaxed (488); a knob the URL advertises must be honored
  by HTML and .json alike, offered only where true (489/490); a bound is
  stated in real units, COUNTED by a test (491); two implementations of one
  invariant means one is wrong -- atomic SQL beats read-then-write, and
  unbounded per-row loops go set-based and capped (492). No ledger either
  wave (452/470); w25 owns the closing ledger.
- STAGE1-CLOSE w25 (DEC-493..498): the tree moved AGAIN mid-plan -- w24-a/b/c/d
  merged between two greps of ONE planning pass (488/489/490/491 IN on re-read,
  492 still out), so re-read the FILE before you write the task, never the grep
  from ten minutes ago. 493 the walkthrough harness is product evidence:
  resolve the seeded event by SLUG (items[0] of a desc(startDate) list is a
  throwaway event) and fill a locked field by the product's own rule -- a
  harness failing for its own reasons reads exactly like a product failing.
  494 an event-clock string carries its event's tz or it lies; formatIcsChip
  takes a REQUIRED timeZone (live repro: "12:00 PM" for a 09:00 Pacific
  session), while audit timestamps stay viewer-local. 495 a ceiling that is
  never filled is not a measurement -- the perf seed reaches SPEC's 800-speaker
  top end via co-speakers, not more sessions. 496 the closing ledger grades at
  file:line at ITS OWN sha, classifies a missing fix by ancestor-check on the
  OWNING branch (PENDING-OWNED(task-w24-e), not FAIL-unowned), and STRIKES
  w21-f open item #1: its own cited source reads "Neither row is
  UNMEASURABLE-BY-CONSTRUCTION at this sha." 497 phone evidence predating the
  embed rework is not evidence about it. 498 five evidence lanes share one
  machine: own your assigned port, kill only the PID you spawned, never pkill -f.
