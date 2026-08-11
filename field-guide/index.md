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
  012/013 route files export Hono sub-apps, only src/index.ts mounts,
  middleware sessionLoader/requireOrganizer/requireReviewer/require
  Speaker/csrfJson/csrfForm, errors {error:{code,message,fields?}};
  DEC-015 append-only; DEC-016 locked=real cols; DEC-114 sha rule;
  DEC-129 homonym guard match full heading incl. '@ <sha>'.
- Wave3-15+Campaign3 (compact history): sub-apps/repos/ctx DEC-012/013/
  019; uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-
  074; 2nd barrier DEC-107; DEC-068/069 log+exit predicate; DEC-139
  exit battery+render-sweep(144)+findings closure; criteriaForRound
  sole resolution (DEC-147..178); CRM=SegmentRule[]+'any'; calendar
  via formatDateOnly UTC; Pipeline=pipeline_entry+activity; Files=
  previous_file_id chains; ZIP=STORE-only<=50. Workers never edit
  eval-findings.md/verification-log.md/decisions/. Batteries drain
  LATE, dead stubs VOID on rebind. DEC-179-196: CSV formula-escape;
  login-limiter failures-only; csrfFormOrHeader/logout; parseBounded
  IdArray(64-char,1000 cap); DEC-187 .dev.vars via ensure-dev-vars.ts
  (never overwrite/read/print). Sha chain 7561cc1->7f7477e->1033d45.
- Wave16-20 (DEC-197..206, compact): lowercase+ci-dup emails, password-
  free welcome+/account/password SSR, pubcache+KV limiter non-atomicity
  ACCEPTED stage-1. w18 LATE DRAINERS a85ddcc/6807b67 landed during
  w19-20 planning; '@1033d45' VOID. Battery FROZEN @6807b67, 6/6 PASS.
- Wave21-22 (compact): DEC-207-209 conflict-marker repair, battery@6807b67;
  DEC-210-217 four review-lens defects fixed, reset-password endpoint+
  PlanEditor reveal, lower(email) migration, /account/password manifest.
- Wave23-24 (compact): DEC-218-220 w22-a/b/d late-drained, w22-e/f wrongly
  called dead->VOID, rebound w23-a/b/c, battery-after-verify rule, reset-
  password self-target ok. DEC-221/222: w22-e/f were NOT dead — THIRD
  late-drain (0a263d2=w22-e); w23 remit already on main -> w23-a/b/c
  VOIDed zero-commit; late w23 merge=drift FAIL-stop; FROZEN 0a263d2,
  6 gates task-w24-a..f, ports 8961/8962. LESSON: recheck reflog before
  trusting "dead stub".
- Wave 25 (DEC-223..225): FOURTH late-drain — w23-a (871ee28, reset-
  password test) and w23-b (b2dc2c1, PlanEditor resettingUserId guard)
  landed after DEC-222 froze 0a263d2; w24-a FAIL-stopped correctly,
  w24-b..f never produced evidence. DEC-223 ACCEPTS the late content
  (verified sane) and re-freezes LITERAL b2dc2c103309433732bc689b933
  610fc7cfb3b06. DEC-224: w24 battery VOID; accounting now LATE-DRAIN-
  IMMUNE — wave-26 exit counts ONLY docs/verification-log/task-w25-*.md;
  stray task-w24-* log merges allow-listed non-code-bearing, never
  drift; never make "branch will be dropped" a load-bearing premise.
  DEC-225: battery task-w25-a..f, one log each, ports 8963/8964 (8961/
  8962 may be held by stragglers), sha check tolerates decisions//
  field-guide//docs/verification-log//eval-findings//decisions.ts-
  appends. LESSON: search-tool rendering can mangle '//' comments into
  '/' — confirm suspected syntax errors with a raw file Read first.
