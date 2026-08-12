// task-w10-e (DEC-060/DEC-062 integrated post-merge verification).
//
// Harvest step: re-walked the out-of-area defect notes left by task-w8-c
// (producer.ts), task-w8-d (review.ts), task-w8-f (public.ts), and
// task-w8-g (data.ts) per this task's instructions. Both real defects
// found in that harvest -- (1) the blanket
// `<router>.use("*", requireOrganizer)` in events.ts/contacts.ts/
// portal-config.ts leaking onto sibling /api/v1 sub-apps, and (2) the
// unbatched `allowedIds` inArray(...) in submissions.ts's q/trackId
// candidate-id narrowing -- were already fixed and merged to main by
// task-w9-b (5fe58ad/0314789) before this task's worktree was created;
// confirmed "not reproducible" by inspecting the current tree (scoped
// `.use("/events", ...)` etc. in events.ts/contacts.ts/portal-config.ts,
// and the chunkIds(...) batching branch at submissions.ts's
// `allowedIds.size > ID_CHUNK_SIZE` check) and by a clean live run of
// scripts/walkthrough/{producer,review,public,data}.ts against a freshly
// migrated+seeded `wrangler dev` (see this task's commit body for the
// per-module results).
//
// test/api-route-composition.test.ts already regression-tests the fixed
// defect dynamically for 3 of the /api/v1-mounted sub-apps (events,
// contacts, portal-config) plus meRoutes. This file extends the same
// dynamic-composition approach to every OTHER sub-app src/index.ts mounts
// at the same "/api/v1" prefix (submissions, overview, views, agenda,
// tasks, fileApi) -- none of these import fs/node builtins so they mount
// cleanly without extra repo mocking, since hitting an organizer-gated
// route only exercises the auth middleware, never the handler body. If a
// future change to any of these sub-apps reintroduces a blanket
// `.use("*", ...)` role-gate, it will 403 the shared reviewer session
// hitting /api/v1/me below, catching the leak the same way task-w8-d's
// live walkthrough originally did.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { eventsRoutes } from "../src/routes/api/events";
import { portalConfigRoutes } from "../src/routes/api/portal-config";
import { submissionsRoutes } from "../src/routes/api/submissions";
import { contactsRoutes } from "../src/routes/api/contacts";
import { overviewRoutes } from "../src/routes/api/overview";
import { viewsRoutes } from "../src/routes/api/views";
import { agendaRoutes } from "../src/routes/agenda";
import { taskRoutes } from "../src/routes/tasks";
import { fileApiRoutes } from "../src/routes/files";
import { meRoutes } from "../src/routes/me";

function buildFullApiV1App(auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: async () => [{ email: "reviewer@example.com", firstName: null, lastName: null }],
            }),
          }),
        }),
      }),
    } as unknown as AppEnv["Variables"]["db"]);
    await next();
  });
  registerErrorHandler(app);
  // Mirrors src/index.ts's mount order for every sub-app sharing the
  // "/api/v1" prefix, plus meRoutes at "/" (whose own paths are literally
  // "/api/v1/me", the exact surface the original defect broke).
  app.route("/api/v1", eventsRoutes);
  app.route("/api/v1", portalConfigRoutes);
  app.route("/api/v1", submissionsRoutes);
  app.route("/api/v1", contactsRoutes);
  app.route("/api/v1", overviewRoutes);
  app.route("/api/v1", viewsRoutes);
  app.route("/api/v1", agendaRoutes);
  app.route("/api/v1", taskRoutes);
  app.route("/api/v1", fileApiRoutes);
  app.route("/", meRoutes);
  return app;
}

describe("full /api/v1 sub-app composition does not leak an organizer gate onto /api/v1/me", () => {
  it("a reviewer session reaches /api/v1/me with every /api/v1 sub-app mounted", async () => {
    const reviewerAuth: AuthInfo = { userId: "u-1", role: "reviewer", orgId: "org-1" };
    const app = buildFullApiV1App(reviewerAuth);

    const res = await app.request("/api/v1/me");
    expect(res.status).toBe(200);
  });

  it("a speaker (bearer-token) session reaches /api/v1/me with every /api/v1 sub-app mounted", async () => {
    const speakerAuth: AuthInfo = { userId: "u-3", role: "speaker", orgId: "org-1" };
    const app = buildFullApiV1App(speakerAuth);

    const res = await app.request("/api/v1/me");
    expect(res.status).toBe(200);
  });
});
