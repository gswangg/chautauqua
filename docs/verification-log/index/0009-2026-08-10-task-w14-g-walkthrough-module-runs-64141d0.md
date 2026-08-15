## 2026-08-10 task-w14-g — walkthrough module runs @ 64141d0

Full detail: docs/verification-log/task-w14-g-walkthrough-module-runs.md

scripts/walkthrough/speaker.ts and scripts/walkthrough/public.ts converted
from direct `wrangler d1 execute --local` fixture workarounds to the real
DEC-070 organizer endpoints (POST /api/v1/submissions/:id/participants,
PATCH /api/v1/submissions/:id/participants/:participantId). Added one new
authz probe (speaker session POSTing the invite endpoint -> 403).

RESULT: PASS

