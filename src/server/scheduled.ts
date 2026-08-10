// Worker cron entry point, extracted from src/index.ts for cohesion (no
// behavior change). DEC-023: due-date-driven onboarding task reminders —
// never wired to a status-change path (DEC-009).

import type { Bindings } from "./env";
import { runDueReminders } from "../routes/tasks";

export async function handleScheduled(
  controller: ScheduledController,
  env: Bindings,
  _ctx: ExecutionContext,
): Promise<void> {
  console.log("scheduled trigger fired", controller.cron);
  await runDueReminders(env);
}
