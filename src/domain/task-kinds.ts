// Task-kind vocabulary (DEC-613 wave-70 amendment). ONE set, shared by every
// consumer that previously kept its own copy:
//   - src/domain/acceptance.ts (OnboardingTaskTemplate.kind)
//   - src/routes/tasks.ts (kind validation on task create)
//   - src/server/repo/portal/tasks.ts (PortalTaskAssignment.kind)
//   - app/src/pages/speakers/types.ts (OnboardingTask.kind)
//   - app/src/pages/speakers/speakerDetail.ts (SpeakerDetailTask.kind)
import { DEC_613 } from '../decisions';

void DEC_613; // wave-70 amendment: one shared task-kind vocabulary, not five copies

export const TASK_KINDS = ['general', 'file_request', 'form'] as const;

export type TaskKind = (typeof TASK_KINDS)[number];

// DEC-422 (wave-77 amendment): the largest assignee set one task write may
// name -- not a page size that happens to match. Both doors onto the
// task_assignment write (create's contactIds and assign's contactIds in
// src/routes/tasks.ts) pass this as parseBoundedIdArray's maxCount, so a
// caller sees the same refusal at the same count no matter which door it
// used.
export const MAX_TASK_ASSIGNEES = 200;
