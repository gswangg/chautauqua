// CNT-01: a task's instructions is a free-text brief for the assignee,
// distinct from `description`. Capped separately from MAX_LONG_TEXT_LENGTH
// per this task's spec (2,000 chars, not 20,000). Enforced server-side in
// src/routes/tasks.ts's parseInstructions; the client-side Instructions
// textarea (app/src/pages/speakers/TaskModal.tsx) imports this SAME
// constant for its maxLength so the control and the validator can never
// drift apart.
export const MAX_TASK_INSTRUCTIONS_LENGTH = 2000;
