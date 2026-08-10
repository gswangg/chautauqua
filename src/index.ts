import { Hono } from "hono";
import type { Bindings } from "./env";

// Wave 2 wires the real routers (admin SPA, /api/v1/*, /submit, /portal,
// public surfaces, /embed, /login, /claim, /files, /dev/mailbox — see
// DEC-005). This scaffold only proves the Worker boots.
const app = new Hono<{ Bindings: Bindings }>();

app.get("/health", (c) => c.json({ ok: true }));

app.get("/api/v1", (c) => c.json({ name: "chautauqua", version: "v1" }));

export default {
  fetch: app.fetch,
  async scheduled(
    controller: ScheduledController,
    env: Bindings,
    ctx: ExecutionContext,
  ): Promise<void> {
    // No-op stub; wave 2 tasks wire cron-driven jobs (e.g. reminders).
    console.log("scheduled trigger fired", controller.cron);
  },
};
