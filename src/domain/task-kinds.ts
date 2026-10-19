// Task-kind vocabulary (DEC-613 wave-70 amendment). ONE set, shared by every
// consumer that previously kept its own copy:
//   - src/domain/acceptance.ts (OnboardingTaskTemplate.kind)
//   - src/routes/tasks.ts (kind validation on task create)
//   - src/server/repo/portal/tasks.ts (PortalTaskAssignment.kind)
//   - app/src/pages/speakers/types.ts (OnboardingTask.kind)
//   - app/src/pages/speakers/speakerDetail.ts (SpeakerDetailTask.kind)
import { DEC_613 } from '../decisions';

void DEC_613; // wave-70 amendment: one shared task-kind vocabulary, not five copies

// 'share_kit' (multi-portal): promotion copy and links a speaker or sponsor
// shares, then marks as shared.
export const TASK_KINDS = ['general', 'file_request', 'form', 'share_kit'] as const;

export type TaskKind = (typeof TASK_KINDS)[number];

// The kinds an organizer creates directly on Speakers (New task). A share
// kit is a portal library item (Settings · Portals › Libraries).
export const DIRECT_TASK_KINDS = ['general', 'file_request', 'form'] as const satisfies readonly TaskKind[];

// DEC-422 (wave-77 amendment): the largest assignee set one task write may
// name -- not a page size that happens to match. Both doors onto the
// task_assignment write (create's contactIds and assign's contactIds in
// src/routes/tasks.ts) pass this as parseBoundedIdArray's maxCount, so a
// caller sees the same refusal at the same count no matter which door it
// used.
export const MAX_TASK_ASSIGNEES = 200;

// task.audience says how a task reaches people:
//   'targeted' -- the people an organizer picked by name (DEC-746 wave-77);
//   'portal'   -- a library item that reaches people only through the
//                 portals that list it (multi-portal).
// 'everyone' is retired (multi-portal decision 76): it meant "every accepted
// speaker, back-filled at each acceptance", a second rule engine beside
// portals. migrations/0047 turned every such task into a 'targeted' list of
// the people who already had it, and nothing reads or writes it now; it stays
// in the union only because the column's SQL default still names it.
export const TASK_AUDIENCES = ['everyone', 'targeted', 'portal'] as const;

export type TaskAudience = (typeof TASK_AUDIENCES)[number];
