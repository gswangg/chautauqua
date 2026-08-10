import { createBaseApp, guardDevMailbox } from "./server/app";
import { handleScheduled } from "./server/scheduled";
import { authRoutes } from "./routes/auth";
import { eventsRoutes } from "./routes/api/events";
import { emailLogRoutes } from "./routes/api/email-log";
import { formsRoutes } from "./routes/api/forms";
import { submissionsRoutes } from "./routes/api/submissions";
import { contactsRoutes } from "./routes/api/contacts";
import { overviewRoutes } from "./routes/api/overview";
import { viewsRoutes } from "./routes/api/views";
import { commsRoutes } from "./routes/comms";
import { agendaRoutes } from "./routes/agenda";
import { publicSubmitRoutes } from "./routes/public/submit";
import { portalRoutes } from "./routes/portal/index";
import { publicRoutes } from "./routes/public";
import { portalTasksRoutes } from "./routes/portal/tasks";
import { devMailboxRoutes } from "./routes/dev/mailbox";
import { taskRoutes } from "./routes/tasks";
import { reviewRoutes } from "./routes/review";
import { meRoutes } from "./routes/me";
import { fileApiRoutes, fileServeRoutes } from "./routes/files";
import { portalProfileRoutes, headshotServeRoutes } from "./routes/portal/profile";

// Wave 2 wires the remaining routers (admin SPA, /api/v1/*, /submit,
// /portal, public surfaces, /embed, /files, /dev/mailbox — see DEC-005).
// src/index.ts is the ONLY place that mounts sub-apps (DEC-012); base app
// bootstrap (context, session loader, error handler, meta endpoints, the
// dev-mailbox guard) lives in ./server/app.ts.
const app = createBaseApp();

app.route("/", authRoutes);
app.route("/api/v1", eventsRoutes);
app.route("/api/v1", submissionsRoutes);
app.route("/api/v1", contactsRoutes);
app.route("/api/v1", overviewRoutes);
app.route("/api/v1", viewsRoutes);
app.route("/api/v1", agendaRoutes);
app.route("/api/v1", taskRoutes);
app.route("/api/v1", fileApiRoutes);
app.route("/", fileServeRoutes);
app.route("/", emailLogRoutes);
app.route("/", formsRoutes);
app.route("/", commsRoutes);
app.route("/", publicSubmitRoutes);
app.route("/", reviewRoutes);
app.route("/", meRoutes);
app.route("/portal", portalRoutes);
// w4-a/w4-b (DEC-028): parallel portal sub-apps + the public headshot route.
app.route("/portal", portalProfileRoutes);
app.route("/portal", portalTasksRoutes);
app.route("/", headshotServeRoutes);
app.route("/", publicRoutes);

guardDevMailbox(app);
app.route("/", devMailboxRoutes);

export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
};
