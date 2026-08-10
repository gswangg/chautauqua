import { createBaseApp, guardDevMailbox } from "./server/app";
import { handleScheduled } from "./server/scheduled";
import { authRoutes } from "./routes/auth";
import { eventsRoutes } from "./routes/api/events";
import { emailLogRoutes } from "./routes/api/email-log";
import { formsRoutes } from "./routes/api/forms";
import { submissionsRoutes } from "./routes/api/submissions";
import { publicSubmitRoutes } from "./routes/public/submit";
import { portalRoutes } from "./routes/portal/index";
import { devMailboxRoutes } from "./routes/dev/mailbox";
import { taskRoutes } from "./routes/tasks";

// Wave 2 wires the remaining routers (admin SPA, /api/v1/*, /submit,
// /portal, public surfaces, /embed, /files, /dev/mailbox — see DEC-005).
// src/index.ts is the ONLY place that mounts sub-apps (DEC-012); base app
// bootstrap (context, session loader, error handler, meta endpoints, the
// dev-mailbox guard) lives in ./server/app.ts.
const app = createBaseApp();

app.route("/", authRoutes);
app.route("/api/v1", eventsRoutes);
app.route("/api/v1", submissionsRoutes);
app.route("/api/v1", taskRoutes);
app.route("/", emailLogRoutes);
app.route("/", formsRoutes);
app.route("/", publicSubmitRoutes);
app.route("/portal", portalRoutes);

guardDevMailbox(app);
app.route("/", devMailboxRoutes);

export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
};
