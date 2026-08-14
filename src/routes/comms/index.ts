// J5 compose pipeline (DEC-019): templates CRUD + atomic preview/send.
// Route file exports a named Hono<AppEnv> sub-app; only src/index.ts mounts
// it (DEC-012). Every endpoint is organizer-only + csrfJson on mutations.
//
// This directory replaces the former monolithic src/routes/comms.ts (an 804-
// line merge-contention hotspot) with cohesive submodules — no behavior
// change. `commsRoutes` below is still the ONE sub-app src/index.ts mounts,
// assembled from each submodule's own Hono<AppEnv> instance.

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { DEC_252, DEC_766, DEC_805, DEC_832, DEC_833 } from "../../decisions";
import { templatesRoutes } from "./templates";
import { previewRoutes } from "./preview";
import { sendRoutes } from "./send";
import { portalInvitesRoutes } from "./portal-invites";
import { emailLogRoutes } from "./email-log";

void DEC_252;
void DEC_766;
void DEC_805;
void DEC_832;
void DEC_833;

export const commsRoutes = new Hono<AppEnv>();
commsRoutes.route("/", templatesRoutes);
commsRoutes.route("/", previewRoutes);
commsRoutes.route("/", sendRoutes);
commsRoutes.route("/", portalInvitesRoutes);
commsRoutes.route("/", emailLogRoutes);

// Re-exported so existing call sites/tests that imported these directly from
// src/routes/comms keep working unchanged (src/routes/content-notes.ts,
// test/comms-batched-lookups.test.ts, test/comms-feedback-scope.test.ts,
// test/comms-invite-scope.test.ts).
export { noRecipientFields, unscheduledIcsFields, buildRenderTargets, requireFullMatch, missingToFields } from "./compose-core";
export { serializeTemplate } from "./templates";
export { requireOwnedEvent } from "./shared";
