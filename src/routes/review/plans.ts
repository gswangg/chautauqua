// Review API (J4) producer endpoints: plan CRUD, reviewer assignment,
// progress, results and reminders. Extracted from the former monolithic
// src/routes/review.ts (see shared.ts for the parsing/authz helpers this
// sub-app depends on). This file was itself an 803-line merge-conflict
// hotspot (see review/index.ts for the same decomposition rationale one
// level up); it now composes four cohesive sub-apps into the single
// `reviewPlansRoutes` Hono sub-app that review/index.ts mounts — no
// behavior change, no new/removed routes:
//   - plans-crud.ts:       plan CRUD, advance-round, waves
//   - plans-reviewers.ts:  reviewer assignment add/list/remove, scope-preview
//   - plans-distribute.ts: assignment-distribution preview/apply
//   - plans-progress.ts:   progress, results, remind
// Route files export a named Hono sub-app; only src/index.ts mounts the
// combined tree (DEC-012/DEC-013).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { reviewPlansCrudRoutes } from "./plans-crud";
import { reviewPlansReviewersRoutes } from "./plans-reviewers";
import { reviewPlansDistributeRoutes } from "./plans-distribute";
import { reviewPlansProgressRoutes } from "./plans-progress";

export const reviewPlansRoutes = new Hono<AppEnv>();

reviewPlansRoutes.route("/", reviewPlansCrudRoutes);
reviewPlansRoutes.route("/", reviewPlansReviewersRoutes);
reviewPlansRoutes.route("/", reviewPlansDistributeRoutes);
reviewPlansRoutes.route("/", reviewPlansProgressRoutes);
