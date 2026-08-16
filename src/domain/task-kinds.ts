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

// DEC-746 (wave-77 amendment): task.audience is a real, defaulted column —
// 'targeted' when createTask received an explicit contactIds subset,
// 'everyone' otherwise. DEC-932's acceptance back-fill (status.ts) filters
// its driving select to audience = DEFAULT_TASK_AUDIENCE so a task an
// organizer deliberately targeted at a subset never silently becomes
// universal at the next acceptance.
export const TASK_AUDIENCES = ['everyone', 'targeted'] as const;

export type TaskAudience = (typeof TASK_AUDIENCES)[number];

export const DEFAULT_TASK_AUDIENCE: TaskAudience = 'everyone';
