// CRM sourcing pipeline API (CRM-07/08, DEC-157). Route file exports a named
// Hono<AppEnv> sub-app; only src/index.ts mounts it (DEC-012). Every
// endpoint is organizer-only + csrfJson on mutations, org-scoped via
// auth.orgId, with object-level ownership checks on every :id lookup (no
// IDOR). This module must never import a mailer — pipeline moves/notes
// never send email (product principle 4).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson, requireOrganizer } from "../../server/middleware";
import { ApiError } from "../../server/http";
import * as repo from "../../server/repo/pipeline";
import { findContactForOrg } from "../../server/repo/contacts";
import { clampPage, listPerPage } from "../../lib/pagination";
import { PIPELINE_FIT_MIN, PIPELINE_FIT_MAX, PIPELINE_RATIONALE_MAX_LEN } from "../../domain/pipeline-fit";
import { MAX_TEXT_LENGTH, MAX_LONG_TEXT_LENGTH } from "../../forms/validate"; // DEC-417

export const pipelineRoutes = new Hono<AppEnv>();

pipelineRoutes.use("/pipeline", requireOrganizer);
pipelineRoutes.use("/pipeline/*", requireOrganizer);

function currentOrgId(c: { var: { auth?: { orgId: string } } }): string {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth.orgId;
}

// DEC-821: fitScore is an integer 1-5 or null; rationale is bounded text or
// null. Neither field is ever coerced -- an out-of-range number, a non-
// integer, or an over-length string is a loud, named field error.
export function validateFitScore(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < PIPELINE_FIT_MIN || value > PIPELINE_FIT_MAX) {
    throw new ApiError("invalid", "Validation failed", {
      fitScore: `must be an integer ${PIPELINE_FIT_MIN}-${PIPELINE_FIT_MAX}, or null`,
    });
  }
  return value;
}

export function validateRationale(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new ApiError("invalid", "Validation failed", { rationale: "must be text, or null" });
  }
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (trimmed.length > PIPELINE_RATIONALE_MAX_LEN) {
    throw new ApiError("invalid", "Validation failed", {
      rationale: `must be ${PIPELINE_RATIONALE_MAX_LEN} characters or fewer`,
    });
  }
  return trimmed;
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null) {
    throw new ApiError("invalid", "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

function serializeEntry(row: repo.PipelineListItem) {
  return {
    id: row.id,
    contactId: row.contactId,
    firstName: row.firstName,
    lastName: row.lastName,
    company: row.company,
    email: row.email,
    stage: row.stage,
    updatedAt: row.updatedAt,
    // DEC-803: stageSince IS updatedAt (only moves write it); declineReason
    // is null for every non-declined entry.
    stageSince: row.stageSince,
    declineReason: row.declineReason,
    // DEC-821: absence is a visible 'Unrated' state, never an implied zero.
    fitScore: row.fitScore,
    rationale: row.rationale,
  };
}

function serializeActivity(row: repo.PipelineActivityRow) {
  return {
    kind: row.kind,
    body: row.body,
    fromStage: row.fromStage,
    toStage: row.toStage,
    authorName: row.authorName,
    createdAt: row.createdAt,
  };
}

async function requireOwnedEntry(c: { var: { db: AppEnv["Variables"]["db"] } }, id: string, orgId: string) {
  const entry = await repo.findEntryForOrg(c.var.db, id, orgId);
  if (!entry) throw new ApiError("not_found", "Pipeline entry not found");
  return entry;
}

pipelineRoutes.get("/pipeline", async (c) => {
  const orgId = currentOrgId(c);
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage")); // DEC-465
  const [items, total] = await Promise.all([
    repo.listPipelineForOrg(c.var.db, orgId, { limit: perPage, offset: (page - 1) * perPage }),
    repo.countPipelineForOrg(c.var.db, orgId),
  ]);
  return c.json({ items: items.map(serializeEntry), total, page, perPage });
});

pipelineRoutes.post("/pipeline", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const auth = c.var.auth!;
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  if (typeof body.contactId !== "string" || body.contactId.trim() === "") {
    throw new ApiError("invalid", "Validation failed", { contactId: "required" });
  }
  const stage = body.stage === undefined ? "identified" : body.stage;
  if (!repo.isPipelineStage(stage)) {
    throw new ApiError("invalid", "Validation failed", { stage: `must be one of ${repo.PIPELINE_STAGES.join(", ")}` });
  }

  const fitScore = validateFitScore(body.fitScore);
  const rationale = validateRationale(body.rationale);

  const contact = await findContactForOrg(c.var.db, body.contactId, orgId);
  if (!contact) throw new ApiError("not_found", "Contact not found");

  const authorName = await repo.resolveAuthorName(c.var.db, auth.userId);
  const entry = await repo.enrollContact(c.var.db, orgId, contact.id, stage, { userId: auth.userId, name: authorName }, { fitScore, rationale });

  return c.json(
    serializeEntry({
      id: entry.id,
      contactId: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      company: contact.company,
      email: contact.email,
      stage: entry.stage,
      updatedAt: entry.updatedAt,
      stageSince: entry.updatedAt,
      declineReason: null,
      fitScore: entry.fitScore,
      rationale: entry.rationale,
    }),
    201,
  );
});

pipelineRoutes.get("/pipeline/:id", async (c) => {
  const orgId = currentOrgId(c);
  const entry = await requireOwnedEntry(c, c.req.param("id"), orgId);
  const contact = await findContactForOrg(c.var.db, entry.contactId, orgId);
  if (!contact) throw new ApiError("not_found", "Contact not found");
  const activity = await repo.listActivityForEntry(c.var.db, entry.id);

  return c.json({
    entry: {
      id: entry.id,
      contactId: entry.contactId,
      stage: entry.stage,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    },
    contact: {
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      company: contact.company,
      email: contact.email,
    },
    activity: activity.map(serializeActivity),
  });
});

pipelineRoutes.patch("/pipeline/:id", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const auth = c.var.auth!;
  const entry = await requireOwnedEntry(c, c.req.param("id"), orgId);
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  // DEC-980: `stage` is optional -- absent or equal to the entry's current
  // stage means this PATCH is a fit-only edit, not a move, and must never
  // call moveEntry (no activity row, no updatedAt/stageSince bump). Only a
  // present-and-different stage is a real move.
  const hasStage = "stage" in body && body.stage !== undefined;
  if (hasStage && !repo.isPipelineStage(body.stage)) {
    throw new ApiError("invalid", "Validation failed", { stage: `must be one of ${repo.PIPELINE_STAGES.join(", ")}` });
  }
  const isMove = hasStage && body.stage !== entry.stage;

  // DEC-821: fit fields are optional on this PATCH -- when present they're
  // validated and persisted alongside a move (if any), but fit never itself
  // moves a card between stages.
  const hasFitScore = "fitScore" in body;
  const hasRationale = "rationale" in body;
  const fitScore = validateFitScore(body.fitScore);
  const rationale = validateRationale(body.rationale);

  if (!isMove && !hasFitScore && !hasRationale) {
    throw new ApiError("invalid", "Validation failed", { patch: "must change stage, fitScore, or rationale" });
  }

  // DEC-803: a move into 'declined' must carry a reason -- rejected here,
  // before any write, not left to the UI to enforce alone. This rule only
  // applies to an actual move into 'declined', never a same-stage PATCH.
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (isMove && body.stage === "declined" && reason === "") {
    throw new ApiError("invalid", "Validation failed", { reason: "required when declining" });
  }
  if (reason.length > MAX_TEXT_LENGTH) {
    throw new ApiError("invalid", "Validation failed", { reason: `Max ${MAX_TEXT_LENGTH}` }); // DEC-417
  }

  let current = entry;
  if (isMove) {
    const authorName = await repo.resolveAuthorName(c.var.db, auth.userId);
    current = await repo.moveEntry(
      c.var.db,
      entry,
      body.stage as repo.PipelineStage,
      { userId: auth.userId, name: authorName },
      body.stage === "declined" ? reason : undefined,
    );
  }

  const withFit =
    hasFitScore || hasRationale
      ? await repo.updateEntryFit(c.var.db, current.id, {
          ...(hasFitScore ? { fitScore } : {}),
          ...(hasRationale ? { rationale } : {}),
        })
      : current;

  const contact = await findContactForOrg(c.var.db, withFit.contactId, orgId);
  if (!contact) throw new ApiError("not_found", "Contact not found");

  // DEC-803: a fit-only PATCH on an already-declined entry never invents
  // this value -- read the real newest move-to-declined activity, same as
  // listPipelineForOrg does for the board.
  const declineReason =
    withFit.stage !== "declined" ? null : isMove ? reason : await repo.declineReasonForEntry(c.var.db, withFit.id);

  return c.json(
    serializeEntry({
      id: withFit.id,
      contactId: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      company: contact.company,
      email: contact.email,
      stage: withFit.stage,
      updatedAt: withFit.updatedAt,
      // DEC-803: stageSince is the stored updatedAt from before any fit-only
      // write -- updateEntryFit never touches updatedAt, so `current`
      // (post-move, pre-fit) carries the correct stageSince either way.
      stageSince: current.updatedAt,
      declineReason,
      fitScore: withFit.fitScore,
      rationale: withFit.rationale,
    }),
  );
});

pipelineRoutes.post("/pipeline/:id/notes", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const auth = c.var.auth!;
  const entry = await requireOwnedEntry(c, c.req.param("id"), orgId);
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  if (typeof body.body !== "string" || body.body.trim() === "") {
    throw new ApiError("invalid", "Validation failed", { body: "required" });
  }
  if (body.body.length > MAX_LONG_TEXT_LENGTH) {
    throw new ApiError("invalid", "Validation failed", { body: `Max ${MAX_LONG_TEXT_LENGTH}` }); // DEC-417
  }

  const authorName = await repo.resolveAuthorName(c.var.db, auth.userId);
  const activity = await repo.addNote(c.var.db, entry, body.body, { userId: auth.userId, name: authorName });

  return c.json(serializeActivity(activity), 201);
});
