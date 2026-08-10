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
- DEC-012/013: route files export Hono sub-apps, only src/index.ts mounts
  (app.ts + scheduled.ts, DEC-035). Middleware sessionLoader/
  requireOrganizer/requireReviewer/requireSpeaker/csrfJson/csrfForm;
  errors {error:{code,message,fields?}}, lists {items,total,page,perPage}.
  DEC-015 migrations append-only; DEC-016 locked fields = real cols.
- Wave-3/4/5/6: route sub-apps src/routes/*.ts(x); repos src/server/repo/;
  ApiError http.ts; ctx factories context.ts; check app/src/lib/api.ts
  first. Compose (DEC-019) atomic, >100 recipients rejects. Public data
  only via repo/public.ts gate. Portal sub-apps share
  routes/portal/shared.tsx. Bearer chq_ in sessionLoader (CSRF-exempt),
  cookie-only mint. DEC-036 formWindowState(). DEC-037 email HTML ONLY
  escapeHtml/textToHtml. DEC-038 rate-limit.ts scoped KV. DEC-039 review
  resolves plans only via getPlanForOrg. DEC-040/041 form-answer uploads
  kind 'attachment', speaker edit routes/portal/edit.tsx. DEC-043/044
  reviewer mgmt /api/v1/users + plan_reviewer ids. DEC-050 locked fields
  PK '<formId>:<name>'. DEC-049 /admin worker-first via ASSETS; GET / SSR.
  DEC-047/048 resources kind 'resource'; seed writes .seed-assets/.
  DEC-070 organizer participant invites/visibility; DEC-071 portal_link
  absolute origin; DEC-072 login limits per-email+per-IP; DEC-073 slot
  roomId event-scoped; DEC-074 portal edit validateTrackChoice.
- Wave-7/8/9/10: DEC-051 compose attachIcs/ics_sequence; DEC-057 scoped
  limiter scope 'submit'; DEC-052 App.tsx-only React.lazy; DEC-054/055/056
  statuses deferred, showflow.csv, /docs/api SSR; DEC-058 perf CI budget
  (js+css<300KB gz); DEC-059 headshots downscale (superseded by DEC-067);
  DEC-060 verification modular scripts/walkthrough/{producer,review,
  speaker,public,data}.ts, DEC-053 conventions (cookie jar, chq_csrf,
  'x-chq-csrf:1'); DEC-061 closes §10; DEC-062 runner order producer->
  review->speaker->public->data; DEC-063 CI job 'walkthrough'. Unresolved
  Qs = 'PLANNER:'. DEC-064 claim consumes right before user insert;
  DEC-065 task uploads via GET /files/:fileId; DEC-066 reviewers download
  files iff plan_reviewer on event; DEC-067 /headshots/:fileId 404s
  unless a contact references it.
- Wave-11/12/13: tree moves MID-PLANNING — re-read refs/reflog before
  concluding a branch dropped (commit-body triage of a clean/empty diff
  drops branches). DEC-068 verification results in tracked, append-only
  docs/verification-log.md ('## <date> <branch> — <scope> @ <sha>';
  commit mandatory even on green). DEC-069 exit predicate: stage-1 done
  iff log has 'RESULT: PASS' (at/after newest code sha) for build+test,
  walkthrough, perf-smoke, SPEC §8/§9 audit, plus triage-closure ending
  'OPEN ITEMS: 0'; green counts only for its sha; goalComplete greps it.
- Wave-14 (CODE): w13 gates @ 0ee30dd invalidated (sha-scoped, DEC-069);
  wave-15 re-runs all gates + triage closure at post-merge sha, citing
  DEC-075 for 'OPEN ITEMS: 0' (w12-c items close via DEC-070 impl +
  walkthrough conversion + cross-org exports unit test).
