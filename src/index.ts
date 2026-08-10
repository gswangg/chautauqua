import { Hono } from "hono";
import type { AppEnv, Bindings } from "./server/env";
import { makeDb } from "./server/context";
import { sessionLoader } from "./server/middleware";
import { registerErrorHandler } from "./server/http";
import { authRoutes } from "./routes/auth";
import { eventsRoutes } from "./routes/api/events";
import { emailLogRoutes } from "./routes/api/email-log";
import { devMailboxRoutes, shouldMountDevMailbox } from "./routes/dev/mailbox";

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
app.route("/api/v1", eventsRoutes);
app.route("/", emailLogRoutes);

// DEC-005: /dev/mailbox is dev-only, mounted only when env.DEV_MODE === '1'.
// Bindings are only known per-request in a Worker, so the guard runs ahead
// of the route match and 404s (via c.notFound()) rather than delegating —
// with DEV_MODE unset the routes are indistinguishable from not existing.
app.use("/dev/mailbox", async (c, next) => {
  if (!shouldMountDevMailbox(c.env)) return c.notFound();
  await next();
});
app.use("/dev/mailbox/*", async (c, next) => {
  if (!shouldMountDevMailbox(c.env)) return c.notFound();
  await next();
});
app.route("/", devMailboxRoutes);

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
