// J6 acceptance planning (DEC-009): a pure function that describes the
// onboarding tasks a newly-accepted submission should create. Callers persist
// the returned descriptors; this module performs no I/O and no email.

export type TaskKind = "general" | "file_request" | "form";

export interface OnboardingTaskTemplate {
  title: string;
  kind: TaskKind;
  required: boolean;
}

/** DEC-009 canonical onboarding task set, in order. */
export const DEFAULT_ONBOARDING_TASKS: readonly OnboardingTaskTemplate[] = [
  { title: "Hotel stay requirement form", kind: "form", required: true },
  { title: "Flight reimbursement form", kind: "form", required: true },
  { title: "Finalize talk description", kind: "general", required: false },
  { title: "Finalize bio + headshot", kind: "file_request", required: false },
  { title: "Announce participation", kind: "general", required: false },
];

export interface PlanAcceptanceInput {
  submissionId: string;
  eventId: string;
  participantContactIds: string[];
  existingTaskTitlesByContact: Record<string, string[]>;
}

export interface PlannedTaskAssignment {
  contactId: string;
  taskTitle: string;
  taskKind: TaskKind;
  required: boolean;
}

export interface PlanAcceptanceResult {
  taskAssignments: PlannedTaskAssignment[];
}

/**
 * Plans the DEFAULT_ONBOARDING_TASKS assignments for each participant
 * contact, skipping any (contact, title) pair already present in
 * existingTaskTitlesByContact. Planning is idempotent: running it again with
 * the previously-planned titles folded into existingTaskTitlesByContact
 * yields an empty taskAssignments list.
 */
export function planAcceptance(input: PlanAcceptanceInput): PlanAcceptanceResult {
  const taskAssignments: PlannedTaskAssignment[] = [];
  for (const contactId of input.participantContactIds) {
    const existingTitles = new Set(input.existingTaskTitlesByContact[contactId] ?? []);
    for (const template of DEFAULT_ONBOARDING_TASKS) {
      if (existingTitles.has(template.title)) continue;
      taskAssignments.push({
        contactId,
        taskTitle: template.title,
        taskKind: template.kind,
        required: template.required,
      });
    }
  }
  return { taskAssignments };
}
