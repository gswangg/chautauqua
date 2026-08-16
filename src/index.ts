import { createBaseApp, guardDevMailbox } from "./server/app";
import { handleScheduled } from "./server/scheduled";
import { authRoutes } from "./routes/auth";
import { accountRoutes } from "./routes/account";
import { eventsRoutes } from "./routes/api/events";
import { portalConfigRoutes } from "./routes/api/portal-config";
import { emailLogRoutes } from "./routes/api/email-log";
import { mailStatusRoutes } from "./routes/api/mail-status";
import { formsRoutes } from "./routes/api/forms";
import { submissionsRoutes } from "./routes/api/submissions";
import { contactsRoutes } from "./routes/api/contacts";
import { importRoutes } from "./routes/api/import";
import { pipelineRoutes } from "./routes/api/pipeline";
import { overviewRoutes } from "./routes/api/overview";
import { publicSurfacesRoutes } from "./routes/api/public-surfaces";
import { viewsRoutes } from "./routes/api/views";
import { embedsRoutes } from "./routes/api/embeds";
import { commsRoutes } from "./routes/comms";
import { agendaRoutes } from "./routes/agenda";
import { breaksRoutes } from "./routes/api/breaks";
import { publicSubmitRoutes } from "./routes/public/submit";
import { portalRoutes } from "./routes/portal/index";
import { portalPreviewRoutes } from "./routes/portal/preview";
import { publicRoutes } from "./routes/public";
import { portalTasksRoutes } from "./routes/portal/tasks";
import { portalEditRoutes } from "./routes/portal/edit";
import { devMailboxRoutes } from "./routes/dev/mailbox";
import { taskRoutes } from "./routes/tasks";
import { reviewRoutes } from "./routes/review";
import { meRoutes } from "./routes/me";
import { fileApiRoutes, fileServeRoutes } from "./routes/files";
import { contentNoteRoutes } from "./routes/content-notes";
import { portalProfileRoutes, headshotServeRoutes } from "./routes/portal/profile";
import { tokensRoutes } from "./routes/api/tokens";
import { exportsRoutes } from "./routes/api/exports";
import { usersRoutes } from "./routes/api/users";
import { rootRoutes } from "./routes/root";
import { docsRoutes } from "./routes/docs";
import { docsSiteRoutes } from "./routes/docs-site";

// Wave 2 wires the remaining routers (admin SPA, /api/v1/*, /submit,
// /portal, public surfaces, /embed, /files, /dev/mailbox — see DEC-005).
// src/index.ts is the ONLY place that mounts sub-apps (DEC-012); base app
// bootstrap (context, session loader, error handler, meta endpoints, the
// dev-mailbox guard) lives in ./server/app.ts.
const app = createBaseApp();

app.route("/", authRoutes);
app.route("/", accountRoutes);
app.route("/api/v1", eventsRoutes);
app.route("/api/v1", portalConfigRoutes);
app.route("/api/v1", submissionsRoutes);
app.route("/api/v1", contactsRoutes);
app.route("/api/v1", importRoutes);
app.route("/api/v1", pipelineRoutes);
app.route("/api/v1", overviewRoutes);
app.route("/api/v1", publicSurfacesRoutes);
app.route("/api/v1", viewsRoutes);
app.route("/api/v1", embedsRoutes);
app.route("/api/v1", agendaRoutes);
app.route("/api/v1", breaksRoutes);
app.route("/api/v1", taskRoutes);
app.route("/api/v1", fileApiRoutes);
app.route("/api/v1", contentNoteRoutes);
app.route("/api/v1", mailStatusRoutes);
app.route("/", fileServeRoutes);
app.route("/", emailLogRoutes);
app.route("/", formsRoutes);
app.route("/", commsRoutes);
app.route("/", publicSubmitRoutes);
app.route("/", reviewRoutes);
app.route("/", meRoutes);
app.route("/", tokensRoutes);
app.route("/", exportsRoutes);
app.route("/", usersRoutes);
// w7-a (DEC-747 amendment): mounted BEFORE portalRoutes so /portal/preview
// matches ahead of speakerGate's gated sub-apps — its own guard is organizer-
// only (the inverse of speakerGate), never falling through to a redirect.
app.route("/portal", portalPreviewRoutes);
app.route("/portal", portalRoutes);
// w4-a/w4-b (DEC-028): parallel portal sub-apps + the public headshot route.
app.route("/portal", portalProfileRoutes);
app.route("/portal", portalTasksRoutes);
app.route("/portal", portalEditRoutes);
app.route("/", headshotServeRoutes);
app.route("/", publicRoutes);
app.route("/", docsRoutes);
app.route("/", docsSiteRoutes);
app.route("/", rootRoutes);

guardDevMailbox(app);
app.route("/", devMailboxRoutes);

// DEC-637: exported (in addition to the default fetch/scheduled export) so
// tests can enumerate the real mounted route table via app.routes without
// re-parsing this file's source.
export { app };

export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
};
