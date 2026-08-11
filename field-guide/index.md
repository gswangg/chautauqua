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
  domain,forms,mail,lib} import nothing from node:/cloudflare. DEC-
  012/013: route files export Hono sub-apps, only src/index.ts mounts;
  middleware sessionLoader/requireOrganizer/requireReviewer/require
  Speaker/csrfJson/csrfForm; errors {error:{code,message,fields?}};
  DEC-015 append-only; DEC-016 locked=real cols; DEC-114 sha rule;
  DEC-129 homonym guard.
- Wave-3..21+Campaign3+Waves2-5 (very compact): sub-apps/repos/ctx DEC-
  012/013/019; uploads/ics/statuses/perf/headshots/walkthrough/claim
  DEC-040-074 (DEC-059 superseded DEC-084); 2nd barrier DEC-107 (DEC-
  108..111); DEC-068 log append-only; DEC-069 exit predicate; W19/W21
  batteries VOIDED. Campaign3: DEC-139 exit needs battery+render-sweep
  (DEC-144)+findings closure, sha descends 2dd2f33; DEC-140 .ics
  roundtrip+overlap; DEC-141 reviewers via plan assignments; DEC-143
  dupes; DEC-145/146 seed+date helpers. Waves2-5 (DEC-147..166):
  criteriaForRound sole resolution; CRM filters ARE SegmentRule[]+
  'any'; drill-ins SSR gated by visibleSubmissionConditions; calendar
  via formatDateOnly UTC; Pipeline=pipeline_entry+activity; CNT-11=
  submission_revision snapshots; Files=previous_file_id chains; ZIP=
  src/lib/zip.ts STORE-only <=50. w5-a=only code lane+CI render-sweep.
  Workers never edit eval-findings.md, verification-log.md, decisions/,
  src/decisions.ts. Wave6 (DEC-167..172): batteries drain LATE; render-
  test mocks MUST mirror real wire shapes (DEC-171); merge full
  profile/.ics ORGANIZER-ATTENDEE/form-tracks/reviewer file access/
  form-kind forms. Waves7+8 (DEC-173..177, BOTH VOID): planned HARNESS-
  only fixes for w5-c walkthrough FAIL, dead stubs. Wave9 (DEC-178):
  rebinds battery to task-w9-a, six PASS->stage-1 complete. Lesson:
  verify execution via reflog+branch refs+ledger tail, never summaries.
- Wave 10 (DEC-179..185, compact): w8 battery drained LATE (S=38860f9,
  w8-c 6/6 unmerged at 2c6070b); w8-b merge committed raw conflict
  markers into docs/verification-log.md (DEC-184 one-time repair, now
  CLOSED per DEC-186, no further ledger surgery, gates append one
  section each). Five fixes, DEC-id-tagged in source: DEC-179 CSV
  formula-escape formatCell; DEC-180 login limiter counts-failures-
  only+success resets budget; DEC-181 csrfFormOrHeader on /logout+
  portal token; DEC-182 parseBoundedIdArray (64-char,1000 cap) on
  bulk-ids routes; DEC-183 DEV_MODE in .dev.vars. DEC-185 rebinds
  battery to S' grepping DEC-177 anchors+DEC-179..183 markers.
- Wave 11 (DEC-186): verified at tip b57bdfd, all wave-10 fixes+markers
  merged; S'=7561cc1 'merge task-w10-d' (b57bdfd/scribe commits doc-
  only, skip in first-parent walk). Lanes: w11-a build+test(+bundle:
  check), w11-b walkthrough+DEC-175 probes, w11-c perf-smoke, w11-d
  render-sweep 31/31, w11-e spec-audit, w11-f triage-closure gate-of-
  gates dependsOn w11-c. Homonym guard: ledger has FIRST-CAMPAIGN
  task-w11/12/13-* sections @3b7ed3d — match full heading INCLUDING
  '@ <sha>', never lane name alone; keep 2dd2f33 ancestor check. task-
  w9-g drained as doc-only dup triage @38860f9, dead, never reuse. Six
  PASS at one S'+OPEN ITEMS 0 => wave 12 stage-1 done.
