# Field Guide

Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.

- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs = verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; brief/-images; sessionboard-reference; eval-rubric/*.yaml; fixtures
  (never referenced by product code). decisions/DEC-*.md binding;
  src/decisions.ts compile-checked, scribe-owned.
- House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility filtering for public data. STAGE 1:
  zero-secret local wrangler dev; external services behind ports. DEC-003
  table/enums; DEC-004 hash 'pbkdf2$v1$600000$salt$hash'; DEC-005 route
  map + admin nav (exact strings). Pure-core (DEC-002): src/{auth,domain,
  forms,mail,lib} import nothing from node:/cloudflare.
  DEC-012/013: route files export Hono sub-apps, only src/index.ts mounts
  (app.ts + scheduled.ts, DEC-035). Middleware sessionLoader/
  requireOrganizer/requireReviewer/requireSpeaker/csrfJson/csrfForm;
  errors {error:{code,message,fields?}}, lists {items,total,page,perPage}.
  DEC-015 migrations append-only; DEC-016 locked = real cols.
- Wave-3..6: route sub-apps src/routes/*.ts(x); repos src/server/repo/;
  ApiError http.ts; ctx factories context.ts; check app/src/lib/api.ts
  first. Compose (DEC-019) atomic, >100 recipients rejects. Public data
  only via repo/public.ts gate. Bearer chq_ in sessionLoader (CSRF-exempt),
  cookie-only mint. DEC-036 formWindowState(); DEC-037 email HTML ONLY
  escapeHtml/textToHtml; DEC-038 rate-limit.ts scoped KV; DEC-039
  getPlanForOrg; DEC-040/041/047/048 uploads kind 'attachment'/'resource';
  DEC-043/044 /api/v1/users + plan_reviewer ids; DEC-050 locked PK
  '<formId>:<name>'; DEC-049 /admin worker-first via ASSETS, GET / SSR;
  DEC-070..074 participant invites/visibility, portal_link absolute,
  login per-email+IP, slot roomId scoped, validateTrackChoice.
- Wave-7..10: DEC-051 attachIcs/ics_sequence; DEC-057 limiter scope
  'submit'; DEC-052 App.tsx-only React.lazy; DEC-054/055/056 statuses
  deferred, showflow.csv, /docs/api SSR; DEC-058 perf budget (js+css
  <300KB gz); DEC-059 headshots downscale (superseded DEC-067); DEC-060
  modular scripts/walkthrough/{producer,review,speaker,public,data}.ts;
  DEC-053 conventions (cookie jar, chq_csrf, 'x-chq-csrf:1'); DEC-061/062
  closes §10, order producer->review->speaker->public->data; DEC-063 CI
  'walkthrough'. Unresolved Qs='PLANNER:'. DEC-064 claim consumes before
  user insert; DEC-065 uploads via GET /files/:fileId; DEC-066 reviewers
  dl iff plan_reviewer; DEC-067 headshots 404 unless referenced.
- Wave-11..16: DEC-068 verification append-only docs/verification-log.md.
  DEC-069 exit predicate: stage-1 done iff log has sha-scoped
  'RESULT: PASS' for build+test, walkthrough, perf-smoke, SPEC §8/§9
  audit, plus triage-closure 'OPEN ITEMS: 0'. w14-g (single code
  barrier, DEC-076) merged @ a05f17f. DEC-077: gate lanes CODE-FROZEN —
  defects become RESULT: FAIL/open items, never fix commits (stales
  sibling gates); scribe bookkeeping is non-code-bearing under DEC-069.
  Ports: 8801 walkthrough, 8803 perf, never 8787.
- Wave-17 (EXIT): DEC-069 predicate evaluated GREEN, stage 1 declared
  complete. Newest code-bearing sha remains a05f17f (task-w14-g); w16-d
  corroborated via git diff 7c4101c..HEAD --stat (bookkeeping only).
  Green: build+test w15-b@7c4101c+w16-a@7ac6aef; walkthrough
  w15-c@7c4101c+w16-b@7ac6aef; perf-smoke w15-d@7c4101c; spec-audit
  w15-e@7c4101c+w16-d@7ac6aef; triage w15-f@ce451d9 OPEN ITEMS: 0. All 8
  review-lens findings re-verified fixed in-tree (DEC-064..067,
  071..074, cites in wave-17 summary). Late w16-c/w16-e merges are
  log-only, cannot invalidate; any FUTURE code-bearing commit reopens
  DEC-069, requiring fresh gates before re-declaring.
