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

// DEC-746 (wave-77 amendment): task.audience is a real, defaulted column —
// 'targeted' when createTask received an explicit contactIds subset,
// 'everyone' otherwise. DEC-932's acceptance back-fill (status.ts) filters
// its driving select to audience = DEFAULT_TASK_AUDIENCE so a task an
// organizer deliberately targeted at a subset never silently becomes
// universal at the next acceptance.
// 'portal' (multi-portal): a library item created for portals -- it reaches
// people only through the portals that list it, never by back-fill.
export const TASK_AUDIENCES = ['everyone', 'targeted', 'portal'] as const;

export type TaskAudience = (typeof TASK_AUDIENCES)[number];

export const DEFAULT_TASK_AUDIENCE: TaskAudience = 'everyone';
