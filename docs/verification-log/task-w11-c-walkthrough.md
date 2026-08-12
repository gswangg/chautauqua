# 2026-08-10 task-w11-c — walkthrough @ 3b7ed3d

Full detail for the `## 2026-08-10 task-w11-c — walkthrough @ 3b7ed3d` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `RESULT` summary).

DEC-069 J1-J12 walkthrough gate, log-only lane (DEC-077: no product/
test/script/config changes made in this task). Fresh worktree of `main`
at the task-w11-a merge commit `3b7ed3d` ("merge task-w11-a") — this is
the newest commit on `main` at branch time and is code-bearing per
DEC-091/114 (it lands `scripts/walkthrough/speaker.ts`'s DEC-112/113
closeout probes, commits `e98e4c9` "Walkthrough: add DEC-112 runtime
probes for DEC-108 invite-visibility and DEC-111 form-task self-heal"
and `2d686bd` "walkthrough/speaker.ts: land DEC-112 closeout probes per
DEC-113"). Confirmed present in-tree before running anything: `grep -n
"chq-session-card\|speakers-block\|Flight\|Hotel"
scripts/walkthrough/speaker.ts` shows the Hotel/Flight backing-form
task assertions (lines ~357-368, ~541-566) and the invite A/B/C
fixture flow feeding the public chq-session-card/speakers-block scoped
assertions (exercised in `scripts/walkthrough/public.ts`) — the
DEC-112/113 probes are on `main`, not absent.

Sequence run: `npm ci --prefer-offline --no-audit --no-fund --silent`
(node_modules already present), `npm run build` (PASS, dual `tsc
--noEmit` + `vite build` clean, 125 modules / 17 chunks). Reset local
D1/R2 state (`rm -rf .wrangler`), `npm run db:migrate` (10 migrations
0000-0009 applied clean), `npm run seed` (contacts/submissions/forms/
tasks/R2 objects — 6 R2 puts — all succeeded). `npx wrangler dev --port
8821` came up healthy (`GET / 200 OK`). `npm run walkthrough -- --url
http://localhost:8821` ran all six `WALKTHROUGH_AREAS` in order
producer -> review -> speaker -> public -> data -> scale: **ALL SIX
PASS**, zero `FAIL`/`PLANNER:` lines anywhere in the output.

Runtime proof of DEC-108 (invite-visibility gate — pending/declined
invitees absent from public surfaces, accepted invitee present):
speaker.ts creates three throwaway submissions A (accept), B (decline),
C (leave unanswered), invites the seeded speaker as co-presenter on all
three via the DEC-070 `POST /api/v1/submissions/:id/participants`
endpoint, resolves A/B via the participant-response endpoint (C left
pending), then organizer-accepts + content-approves all three. Observed
`ok` lines: `speaker1's name appears in A's public session card but not
B's or C's (DEC-108 invite_status gate)` and `speaker1's block on
/e/<slug>/speakers lists A's title but not B's or C's (DEC-108
invite_status gate)`. public.ts independently re-confirms the same
gate server-side: `ok   J10 DEC-108 invite-visibility gate: accepted
invitee shown, pending and declined invitees absent`.

Runtime proof of DEC-111 (backing-form onboarding tasks self-healed
with a real `formId`, not a stale 400 "not a form task"; both Hotel and
Flight tasks open GET 200; Flight task actually completes): `ok
find my 'Hotel stay requirement form' task's assignment id via
/portal/tasks (DEC-111 self-healed form)`, `ok   GET
/portal/tasks/:assignmentId/form for 'Hotel stay requirement form'
returns 200 (DEC-111: real formId self-healed at task creation, not a
400 'not a form task') — GET only, task is left Pending`, `ok   find my
'Flight reimbursement form' task's assignment id via /portal/tasks
(DEC-111 self-healed form)`, `ok   GET
/portal/tasks/:assignmentId/form for 'Flight reimbursement form'
returns 200 (DEC-111: real formId, not 400 'not a form task')`, `ok
POST valid answers for 'Flight reimbursement form' (required dropdown
'Yes', csrfForm-formatted body) completes the assignment`. Per DEC-111,
the Hotel task is intentionally left GET-only/Pending (it is exercised
as the organizer-authored task lookup) while the Flight task carries
the full completion round-trip.

No mid-run code-bearing merge landed on `main`: `git -C
/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua log -1
main` still reports `3b7ed3d` after the walkthrough finished. Dev
server killed after the run. Log-only lane (DEC-077): this task's own
diff touches only `docs/verification-log.md` — no product/test/script/
config change was needed or made.

RESULT: PASS
