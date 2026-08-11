# Field Guide

Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; brief/-images; sessionboard-reference; eval-rubric/*.yaml;
  fixtures (never product code). decisions/DEC-*.md binding;
  src/decisions.ts compile-checked, scribe-owned.
- House invariants: fail loudly; status changes never auto-email;
  authz every route, server-side visibility filtering for public data.
  STAGE 1 zero-secret local wrangler dev; external services behind
  ports. DEC-003 table/enums; DEC-004 hash 'pbkdf2$v1$600000$salt$
  hash'; DEC-005 route map+admin nav; DEC-002 pure-core src/{auth,
  domain,forms,mail,lib} import nothing from node:/cloudflare.
  DEC-012/013: route files export Hono sub-apps, only src/index.ts
  mounts; middleware sessionLoader/requireOrganizer/requireReviewer/
  requireSpeaker/csrfJson/csrfForm; errors {error:{code,message,
  fields?}}; DEC-015 append-only; DEC-016 locked=real cols; DEC-114
  sha rule; DEC-129 homonym guard.
- Wave-3..21 + Campaign 3 + Waves 2-5 (very compact): route sub-apps/
  repos/ctx DEC-012/013/019; uploads/ics/statuses/perf/headshots/
  walkthrough/claim DEC-040-074 (DEC-059 superseded DEC-084); 2nd
  barrier DEC-107 (DEC-108..111 fixes); DEC-068 log append-only;
  DEC-069 exit predicate; W19/W21 batteries VOIDED. Campaign 3: DEC-139
  exit needs battery+render-sweep(DEC-144)+findings closure, sha
  descends 2dd2f33; DEC-140 .ics roundtrip+overlap; DEC-141 reviewers
  via plan assignments; DEC-143 dupes; DEC-145/146 seed+date helpers.
  Waves 2-5 (DEC-147..166): criteriaForRound sole resolution; CRM
  filters ARE SegmentRule[]+'any'; drill-ins SSR gated by
  visibleSubmissionConditions; calendar via formatDateOnly UTC;
  Pipeline=pipeline_entry+activity; CNT-11=submission_revision
  snapshots; Files=previous_file_id chains; ZIP=src/lib/zip.ts
  STORE-only <=50. w5-a=only code lane, adds CI render-sweep. Workers
  never edit eval-findings.md, verification-log.md, decisions/,
  src/decisions.ts.
- Wave 6 (DEC-167..172): batteries drain LATE — w4-d/e/f/g+w5-a merged
  DURING wave-6 planning; render-test mocks MUST mirror real wire
  shapes (DEC-171); DEC-167 merge full profile; DEC-168 .ics
  ORGANIZER/ATTENDEE; DEC-169 form-tracks validated; DEC-170 reviewer
  file access plan-scoped; DEC-172 form-kind backing forms.
- Waves 7+8 (DEC-173..177, BOTH VOID — never executed): planned
  HARNESS-only fixes (anchor-tolerant selectors, seed mod-3/pending-
  task override, authz probes) for w5-c's walkthrough FAIL; task-w7-a
  and task-w8-a are both zero-commit branch stubs, dead, never reuse.
- Wave 9 (DEC-178): wave 8 ALSO vanished — second consecutive wave
  where only the scribe commit landed (tip 5d3acae). All six
  DEC-167..172 fixes re-grep-confirmed in src; DEC-173/174/175
  closure re-confirmed absent from scripts. DEC-178 rebinds the
  DEC-176 battery verbatim: task-w9-a sole code lane (scripts/**
  only, changes tagged DEC-173/174/175, validated by a full 6-module
  walkthrough on port 8831); S = 'merge task-w9-a'; gates task-w9-b..f
  parallel at S (build+test, walkthrough 6/6 + DEC-175 probes on
  8832, perf-smoke on 8833, render-sweep expect 31/31, spec-audit
  delta vs 64ec7de); w9-g triage-closure after w9-e, cheap-FAILs if
  siblings absent. Six PASS at one S with OPEN ITEMS 0 -> next wave
  returns zero tasks and declares stage-1 complete. Lesson
  (twice-proven): verify wave execution via reflog + branch refs +
  ledger tail, never wave summaries or plans.
