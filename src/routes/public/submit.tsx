// Public CFP submission SSR (J1 share link + J2 submit), per DEC-005
// (/submit/:eventSlug), DEC-006 (confirmation email via the Mailer port),
// DEC-008 (form engine + server-side validation), DEC-012 (thin handlers:
// parse/authz -> repo -> pure core -> response), DEC-014 (drafts + claim
// token), DEC-016 (locked fields persist to real columns). Route files
// export a named Hono sub-app; only src/index.ts mounts it (DEC-012).
//
// This file is a thin composition point ONLY -- it exists so callers keep
// importing one `publicSubmitRoutes` sub-app with all three routes' exact
// paths, while the routes themselves live in per-route modules (split
// purely to reduce merge contention; no behavior change, all exports
// unchanged):
//   - ./submit-get.tsx    GET  /submit/:eventSlug
//   - ./submit-draft.tsx  POST /submit/:eventSlug/save-draft
//   - ./submit-post.tsx   POST /submit/:eventSlug (final submit)
//   - ./submit-guards.ts  same-origin + per-email rate-limit guards shared
//     by save-draft and final submit
//   - ./submit-messages.ts DEC-124 error-copy rewriters shared by save-draft
//     and final submit
//   - ./submit-views.tsx  view components (SubmitPage, ConfirmationPage, etc.)
//   - ./submit-body.ts    request-parsing helpers
import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { DEC_252 } from "../../decisions";
import {
  DEC_014,
  DEC_016,
  DEC_036,
  DEC_040,
  DEC_132,
  DEC_366,
  DEC_367,
  DEC_371,
  DEC_373,
  DEC_374,
  DEC_377,
} from "../../decisions";
import { publicSubmitGetRoutes } from "./submit-get";
import { publicSubmitDraftRoutes } from "./submit-draft";
import { publicSubmitPostRoutes } from "./submit-post";

void DEC_252;

// touch DEC constants so the dependency is compile-checked (field guide convention)
void DEC_014;
void DEC_016;
void DEC_036;
void DEC_040;
void DEC_132;
void DEC_366;
void DEC_367;
void DEC_371;
void DEC_373;
void DEC_374;
void DEC_377;

// DEC-374: the strict hex-only guard for the per-event accent is the one
// exported from ./shell (validAccent) -- anything that doesn't match becomes
// the default brand olive, never interpolated unchecked into a style
// attribute. Every public SSR surface shares that single guard so the CFP
// page and the branded event pages can never disagree about what a valid
// accent is.

export const publicSubmitRoutes = new Hono<AppEnv>();

publicSubmitRoutes.route("/", publicSubmitGetRoutes);
publicSubmitRoutes.route("/", publicSubmitDraftRoutes);
publicSubmitRoutes.route("/", publicSubmitPostRoutes);

// Re-exported for callers that imported the DEC-124 error-copy rewriters (or
// the same-origin/rate-limit guards) directly off submit.tsx before the
// split — no behavior change, same names, same signatures.
export { trackChoiceMessage } from "./submit-messages";
