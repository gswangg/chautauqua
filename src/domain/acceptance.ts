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

/** DEC-008 form-field kinds usable in a field spec (no 'file' — the portal
 * task-form POST has no upload path). */
export type FormTaskFieldKind = "text" | "long_text" | "dropdown" | "checkbox" | "number";

export interface FormTaskFieldSpec {
  section: "speaker";
  kind: FormTaskFieldKind;
  label: string;
  required: boolean;
  options?: string[];
}

/**
 * DEC-111: pure-data field specs for the two must-have acceptance form
 * tasks, keyed by the exact task/form title. Consumed by the repo layer to
 * find-or-create a backing schema.form + schema.formField rows, never
 * referenced for I/O here.
 */
export const FORM_TASK_FIELD_SPECS: Readonly<Record<string, readonly FormTaskFieldSpec[]>> = {
  "Hotel stay requirement form": [
    {
      section: "speaker",
      kind: "dropdown",
      label: "Do you need a hotel room?",
      required: true,
      options: ["Yes", "No"],
    },
    { section: "speaker", kind: "text", label: "Check-in date", required: false },
    { section: "speaker", kind: "text", label: "Check-out date", required: false },
    { section: "speaker", kind: "long_text", label: "Special requests", required: false },
  ],
  "Flight reimbursement form": [
    {
      section: "speaker",
      kind: "dropdown",
      label: "Do you need flight reimbursement?",
      required: true,
      options: ["Yes", "No"],
    },
    { section: "speaker", kind: "text", label: "Departure airport", required: false },
    {
      section: "speaker",
      kind: "number",
      label: "Estimated reimbursement amount (USD)",
      required: false,
    },
    { section: "speaker", kind: "long_text", label: "Notes", required: false },
  ],
};

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
