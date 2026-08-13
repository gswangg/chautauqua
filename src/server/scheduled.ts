// Worker cron entry point, extracted from src/index.ts for cohesion (no
// behavior change). DEC-023: due-date-driven onboarding task reminders —
// never wired to a status-change path (DEC-009).

import type { Bindings } from "./env";
import { runDueReminders } from "../routes/tasks";
import { runAirtableSync } from "../sync/airtable";
import { makeDb } from "./context";

export async function handleScheduled(
  controller: ScheduledController,
  env: Bindings,
  _ctx: ExecutionContext,
): Promise<void> {
  console.log("scheduled trigger fired", controller.cron);
  // DEC-812: each job runs in its own try/catch so one job's failure can
  // never cancel the other — the tick still fails loudly at the end by
  // rethrowing an aggregate error naming every job that failed.
  const failures: string[] = [];

  // Reminders first: a sync failure must not cost anyone their reminder.
  try {
    await runDueReminders(env);
  } catch (err) {
    console.error("scheduled job failed: runDueReminders", err);
    failures.push("runDueReminders");
  }

  // One-way Airtable push (no-op unless AIRTABLE_* secrets are configured).
  try {
    await runAirtableSync(env, makeDb(env));
  } catch (err) {
    console.error("scheduled job failed: runAirtableSync", err);
    failures.push("runAirtableSync");
  }

  if (failures.length > 0) {
    throw new Error(`scheduled tick: job(s) failed: ${failures.join(", ")}`);
  }
}
