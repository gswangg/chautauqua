// Review API (J4), per DEC-018/DEC-012/DEC-013/DEC-017. Decomposed from a
// single 832-line file into cohesive sub-modules (plans.ts producer
// endpoints, reviewer.ts reviewer-facing endpoints, recusals.ts recusal
// endpoints, shared.ts common parsing/authz/result-shaping helpers) to stop
// them from being a merge-conflict hotspot. This module composes those
// sub-apps into the single `reviewRoutes` Hono sub-app that src/index.ts
// mounts — no behavior change, no new/removed routes.

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { reviewPlansRoutes } from "./plans";
import { reviewReviewerRoutes } from "./reviewer";
import { reviewRecusalRoutes } from "./recusals";
import { reviewEvaluationsRoutes } from "./evaluations";

export const reviewRoutes = new Hono<AppEnv>();

reviewRoutes.route("/", reviewPlansRoutes);
reviewRoutes.route("/", reviewReviewerRoutes);
reviewRoutes.route("/", reviewRecusalRoutes);
reviewRoutes.route("/", reviewEvaluationsRoutes);
