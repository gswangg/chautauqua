import { Hono } from "hono";
import type { AppEnv, Bindings } from "./server/env";
import { makeDb } from "./server/context";
import { sessionLoader } from "./server/middleware";
import { registerErrorHandler } from "./server/http";
import { authRoutes } from "./routes/auth";
import { formsRoutes } from "./routes/api/forms";

// Wave 2 wires the remaining routers (admin SPA, /api/v1/*, /submit,
// /portal, public surfaces, /embed, /files, /dev/mailbox — see DEC-005).
// src/index.ts is the ONLY place that mounts sub-apps (DEC-012).
const app = new Hono<AppEnv>();

// Request-scoped db + always-on session loader, ahead of every route.
app.use("*", async (c, next) => {
  c.set("db", makeDb(c.env));
  await next();
});
app.use("*", sessionLoader);

registerErrorHandler(app);

app.get("/health", (c) => c.json({ ok: true }));

app.get("/api/v1", (c) => c.json({ name: "chautauqua", version: "v1" }));

app.route("/", authRoutes);
app.route("/", formsRoutes);

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
