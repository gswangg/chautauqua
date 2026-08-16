// Submissions API (J3 backend, DEC-016 contract). Route files export a
// named Hono sub-app; only src/index.ts mounts it (DEC-012). Handlers stay
// thin: parse/authz -> repo function -> response.
//
// DEC-009 invariant #1: status changes never send email. This module MUST
// NEVER import a mailer — verified by a source-scan test in
// test/api-submissions.test.ts.

import { Hono, type Context } from "hono";
import type { AppEnv, AuthInfo } from "../../server/env";
import type { Db } from "../../server/context";
import { requireOrganizer, csrfJson } from "../../server/middleware";
import {
  ApiError,
  parseBoundedIdArray,
  parseBoundedText,
  parseBoundedOptionalText,
  readOptionalJsonBody,
} from "../../server/http";
import {
  cloneSubmission,
  createSubmission,
  ensureOnboardingTasks,
  getEventOrgId,
  getSubmissionContent,
  getSubmissionDetail,
  getSubmissionOwnership,
  getSubmissionStatus,
  isValidStatusLiteral,
  listSubmissions,
  parseListQuery,
  updateSubmissionFields,
  updateSubmissionStatuses,
} from "../../server/repo/submissions";
import { isValidContentStatus, updateContentStatuses } from "../../server/repo/files-content-status";
import { settleInDeclarationOrder } from "../../lib/settle";
import { isActiveParticipant } from "../../domain/acceptance";
import { plural } from "../../domain/count-copy";
import { overCapCountMessage, participantCapRefusalMessage } from "../../domain/cap-copy";
import {
  DUPLICATE_PARTICIPANT,
  OVER_CAP,
  getParticipantCount,
  getParticipantOwnership,
  removeParticipantRow,
  getParticipantRow,
  getSubmissionLeadParticipantId,
  inviteParticipant,
  setParticipantInviteStatus,
  setParticipantRole,
  setParticipantVisible,
} from "../../server/repo/participants";
import { PARTICIPANT_ROLE_OPTIONS, MAX_PARTICIPANTS_PER_SUBMISSION } from "../../domain/participant-roles";
import { findContactForOrg } from "../../server/repo/contacts";
import { resolveActorName } from "../../server/repo/users";
import { appendSubmissionRevision, countRevisions, getRevision, listRevisions } from "../../server/repo/revisions";
import { listSubmissionHistory } from "../../server/repo/submissions/history";
import { isValidEmail, normalizeEmail } from "../../domain/email";
import { clampPage, listPerPage } from "../../lib/pagination";
import { bumpIcsSequences } from "../../server/repo/ics-sequence";
import { deleteSubmissionAnswer, getEventTracks, replaceSubmissionTracks, upsertSubmissionAnswers } from "../../server/repo/submit";
import { getFormatFieldOptions } from "../../server/repo/forms";
import { getEventFieldIdByRole, getFieldOptionsByRole } from "../../server/repo/form-roles";
import type { FormFieldRole } from "../../forms/types";
import { MAX_SUBMISSION_TRACK_IDS } from "../../domain/ids";
import { MAX_FILTER_ID_LENGTH } from "../../lib/query-bounds";
import { LOCKED_TITLE_MAX_LENGTH, LOCKED_ABSTRACT_MAX_LENGTH } from "../../forms/types";
import { commitSubmissionDelete, planSubmissionDelete } from "../../server/repo/submission-delete";
import { makeFileStore } from "../../server/context";
import { DEC_460, DEC_461, DEC_462, DEC_519, DEC_598, DEC_755, DEC_757, DEC_886 } from "../../decisions";

// Compile-checked dependency marker: the delete route below (guarded
// cascade behind a confirmation page, refusing any submission with a
// SUBMITTED evaluation) implements DEC-886.
void DEC_886;

// Compile-checked dependency marker: the POST create route's trackIds/format
// handling below implements DEC-755 (New submission dialog's Track and
// Format controls actually persist).
void DEC_755;

// Compile-checked dependency marker: the trackIds validate+replace below
// (organizer editing a submission's tracks) implements DEC-598.
void DEC_598;

// Compile-checked dependency marker: the ics_sequence bumps on title/
// description writes below implement DEC-519.
void DEC_519;

// Compile-checked dependency markers: the contact.email validation below
// implements DEC-462; the revisions pagination below implements DEC-460/461.
void DEC_460;
void DEC_461;
void DEC_462;

// Compile-checked dependency marker: editorName below resolves the editor's
// display name (never a raw email/id) via resolveActorName, implementing
// DEC-757.
void DEC_757;

export const submissionsRoutes = new Hono<AppEnv>();

function requireAuth(c: Context<AppEnv>): AuthInfo {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth;
}

async function assertEventOwnership(db: Db, eventId: string, orgId: string) {
  const eventOrgId = await getEventOrgId(db, eventId);
  if (!eventOrgId) throw new ApiError("not_found", "Event not found");
  if (eventOrgId !== orgId) throw new ApiError("not_found", "Event not found");
}

// DEC-598/DEC-755: the ONE trackIds validation rule — array of
// 1-MAX_FILTER_ID_LENGTH-char id strings, max MAX_SUBMISSION_TRACK_IDS, an
// empty array is a legal "no tracks" request, and every id must belong to
// THIS event or it's a 400 naming the unknown ids. Shared by POST (create)
// and PATCH so the two routes can never drift.
async function parseTrackIdsField(db: Db, eventId: string, raw: unknown): Promise<string[]> {
  if (
    !Array.isArray(raw) ||
    raw.some((t) => typeof t !== "string" || t.length === 0 || t.length > MAX_FILTER_ID_LENGTH)
  ) {
    throw new ApiError("invalid", `trackIds must be an array of id strings (1-${MAX_FILTER_ID_LENGTH} chars)`, {
      trackIds: `Invalid id (max ${MAX_FILTER_ID_LENGTH} chars)`,
    });
  }
  // DEC-598 (wave-10 amendment): trackIds are a SET at every boundary — dedupe
  // BEFORE the cap check so the cap counts DISTINCT ids (a repeated id must
  // never inflate someone past the cap, or worse, reach the writer and raise
  // SQLITE_CONSTRAINT on the [submissionId, trackId] primary key).
  const trackIds = Array.from(new Set(raw as string[]));
  if (trackIds.length > MAX_SUBMISSION_TRACK_IDS) {
    throw new ApiError("invalid", `trackIds must not exceed ${MAX_SUBMISSION_TRACK_IDS} entries`, {
      trackIds: overCapCountMessage(trackIds.length, MAX_SUBMISSION_TRACK_IDS, "track"),
    });
  }
  const eventTracks = await getEventTracks(db, eventId);
  const validTrackIds = new Set(eventTracks.map((t) => t.id));
  const unknown = trackIds.filter((t) => !validTrackIds.has(t));
  if (unknown.length > 0) {
    throw new ApiError("invalid", "trackIds must belong to this event", {
      trackIds: `Unknown ${plural(unknown.length, "track id")}: ${unknown.join(", ")}`,
    });
  }
  return trackIds;
}

// DEC-755: format has no submission column — it's a submission_answer keyed
// by the session_format-role field (src/server/repo/form-roles.ts). A
// supplied value must match one of the event's default-form format field's
// own options; if the event's form has no such field, a supplied format is
// a 400, never a silent drop. Shared by POST (create) and PATCH so both
// routes enforce the same rule.
// DEC-755 amendment (wave 10, task w10-b): `raw === null` is a request to
// CLEAR the answer, not an invalid value — returns null rather than 400ing,
// and the caller deletes the submission_answer row instead of upserting.
async function parseFormatField(db: Db, eventId: string, raw: unknown): Promise<string | null> {
  if (raw === null) return null;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new ApiError("invalid", "format must be a non-empty string", { format: "Invalid format" });
  }
  const options = await getFormatFieldOptions(db, eventId);
  if (options === null) {
    throw new ApiError("invalid", "This event's form has no session format field", {
      format: "Not configured",
    });
  }
  if (!options.includes(raw)) {
    throw new ApiError("invalid", "format must be one of the field's options", { format: "Invalid option" });
  }
  return raw;
}

// DEC-900 amendment (findings wave 13): audienceLevel has no submission
// column either -- it's a submission_answer keyed by the audience_level-role
// field, mirroring parseFormatField above EXACTLY (same CLEAR-on-null
// semantics, same "no such field" and "not one of the options" 400s, just
// keyed `audienceLevel`). Shared by POST (create) and PATCH.
async function parseAudienceLevelField(db: Db, eventId: string, raw: unknown): Promise<string | null> {
  if (raw === null) return null;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new ApiError("invalid", "audienceLevel must be a non-empty string", { audienceLevel: "Invalid audience level" });
  }
  const options = await getFieldOptionsByRole(db, eventId, "audience_level");
  if (options === null) {
    throw new ApiError("invalid", "This event's form has no audience level field", {
      audienceLevel: "Not configured",
    });
  }
  if (!options.includes(raw)) {
    throw new ApiError("invalid", "audienceLevel must be one of the field's options", {
      audienceLevel: "Invalid option",
    });
  }
  return raw;
}

// DEC-755 amendment (wave 10, task w10-b) / DEC-900 amendment (findings wave
// 13): resolves the event's default form's `role`-tagged field id and either
// upserts `value` onto it or, when `value` is null, deletes the answer row --
// the ONE write path shared by format and audienceLevel, POST create and
// PATCH below. `value` is `undefined` when the caller didn't touch the field
// at all (no-op); parseFormatField/parseAudienceLevelField above have
// already 400'd when the event's form has no such field, so a non-null
// resolved fieldId here is guaranteed whenever value !== undefined.
async function writeRoleAnswer(
  db: Db,
  eventId: string,
  submissionId: string,
  role: FormFieldRole,
  value: string | null,
): Promise<void> {
  const fieldId = await getEventFieldIdByRole(db, eventId, role);
  if (!fieldId) {
    const key = role === "session_format" ? "format" : "audienceLevel";
    throw new ApiError("invalid", `This event's form has no ${role.replace("_", " ")} field`, {
      [key]: "Not configured",
    });
  }
  if (value === null) {
    await deleteSubmissionAnswer(db, submissionId, fieldId);
  } else {
    await upsertSubmissionAnswers(db, submissionId, { [fieldId]: value });
  }
}

// GET /api/v1/events/:eventId/submissions
submissionsRoutes.get("/events/:eventId/submissions", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);

  const raw = c.req.query();
  const statusTokens = c.req.queries("status");
  let parsed;
  try {
    parsed = parseListQuery({ ...raw, status: statusTokens });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ApiError("invalid", message);
  }
  const result = await listSubmissions(c.var.db, eventId, parsed);

  return c.json({
    items: result.items,
    total: result.total,
    page: parsed.page,
    perPage: parsed.perPage,
    // DEC-913: chips + re-uploaded headline ride the same envelope as the
    // rows — one grouped aggregate, computed in listSubmissions above.
    contentStatusCounts: result.contentStatusCounts,
    reuploadedCount: result.reuploadedCount,
  });
});

// GET /api/v1/submissions/:id
submissionsRoutes.get("/submissions/:id", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const id = c.req.param("id");
  const ownership = await getSubmissionOwnership(c.var.db, id);
  if (!ownership) throw new ApiError("not_found", "Submission not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("not_found", "Submission not found");

  const detail = await getSubmissionDetail(c.var.db, id);
  if (!detail) throw new ApiError("not_found", "Submission not found");
  return c.json(detail);
});

interface CreateSubmissionBody {
  title?: unknown;
  description?: unknown;
  contact?: { email?: unknown; firstName?: unknown; lastName?: unknown } | null;
  trackIds?: unknown;
  format?: unknown;
  audienceLevel?: unknown;
}

// POST /api/v1/events/:eventId/submissions
submissionsRoutes.post("/events/:eventId/submissions", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);

  const body = (await readOptionalJsonBody(c)) as unknown as CreateSubmissionBody;
  const title = parseBoundedText(body.title, "title", { max: LOCKED_TITLE_MAX_LENGTH, required: true }); // DEC-124
  const description = parseBoundedOptionalText(body.description, "description", {
    max: LOCKED_ABSTRACT_MAX_LENGTH,
  }); // DEC-124

  let contact: { email: string; firstName: string; lastName: string } | null = null;
  if (body.contact) {
    const rawEmail = typeof body.contact.email === "string" ? body.contact.email : "";
    const firstName = typeof body.contact.firstName === "string" ? body.contact.firstName.trim() : "";
    const lastName = typeof body.contact.lastName === "string" ? body.contact.lastName.trim() : "";
    if (!isValidEmail(rawEmail)) {
      throw new ApiError("invalid", "Validation failed", { "contact.email": "must be a valid email address" });
    }
    contact = { email: normalizeEmail(rawEmail), firstName, lastName };
  }

  // DEC-755: validate BEFORE creating the submission row so a bad trackIds/
  // format value never leaves a half-created submission behind.
  // DEC-598 (wave-34 amendment): the three validators below are independent
  // reads that consume nothing from each other and sit behind the
  // ownership check that already resolved above -- issue them as ONE wave
  // via settleInDeclarationOrder (never Promise.all, which would reject
  // with whichever settles first and silently change which field error the
  // caller sees). Rejections are re-thrown in DECLARATION order:
  // trackIds, format, audienceLevel.
  const [trackIds, format, audienceLevel] = await settleInDeclarationOrder([
    body.trackIds !== undefined ? parseTrackIdsField(c.var.db, eventId, body.trackIds) : Promise.resolve(undefined),
    body.format !== undefined ? parseFormatField(c.var.db, eventId, body.format) : Promise.resolve(undefined),
    body.audienceLevel !== undefined
      ? parseAudienceLevelField(c.var.db, eventId, body.audienceLevel)
      : Promise.resolve(undefined),
  ]);

  const id = await createSubmission(c.var.db, eventId, auth.orgId, { title, description, contact });

  // DEC-755/DEC-598/DEC-717: the ONE writer for submission_track (used by
  // PATCH too) and the ONE writer for submission_answer — never a second,
  // create-only writer for either.
  if (trackIds !== undefined) {
    await replaceSubmissionTracks(c.var.db, id, trackIds);
  }
  if (format !== undefined) {
    await writeRoleAnswer(c.var.db, eventId, id, "session_format", format);
  }
  if (audienceLevel !== undefined) {
    await writeRoleAnswer(c.var.db, eventId, id, "audience_level", audienceLevel);
  }

  const detail = await getSubmissionDetail(c.var.db, id);
  return c.json(detail, 201);
});

// POST /api/v1/submissions/:id/clone
submissionsRoutes.post("/submissions/:id/clone", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const id = c.req.param("id");
  const ownership = await getSubmissionOwnership(c.var.db, id);
  if (!ownership) throw new ApiError("not_found", "Submission not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("not_found", "Submission not found");

  const { id: cloneId, droppedFileAnswers } = await cloneSubmission(c.var.db, id);
  const detail = await getSubmissionDetail(c.var.db, cloneId);
  if (!detail) throw new Error(`clone submission ${cloneId}: getSubmissionDetail returned null`);
  return c.json({ ...detail, droppedFileAnswers }, 201);
});

interface UpdateSubmissionBody {
  title?: unknown;
  description?: unknown;
  trackIds?: unknown;
  format?: unknown;
  audienceLevel?: unknown;
}

// PATCH /api/v1/submissions/:id — organizer-only edit of title/description/
// tracks (CNT-09: admin session editing; DEC-598: tracks, closing CNT-D6 —
// a submission created in the admin previously could never be given a
// track, which silently removed it from track-scoped reviewer assignment,
// the public track filter and the agenda's track identity). Org-ownership
// check mirrors the clone route above. An empty patch (none of
// title/description/trackIds provided) is rejected rather than silently
// no-op'ing (fail loudly). The global bumpPublicVersionMiddleware
// (src/server/pubcache.ts) purges the public cache on any successful
// mutating request, so no separate purge call is needed here.
submissionsRoutes.patch("/submissions/:id", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const id = c.req.param("id");
  const ownership = await getSubmissionOwnership(c.var.db, id);
  if (!ownership) throw new ApiError("not_found", "Submission not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("not_found", "Submission not found");

  const body = (await readOptionalJsonBody(c)) as unknown as UpdateSubmissionBody;
  const fields: { title?: string; description?: string | null } = {};

  if (body.title !== undefined) {
    fields.title = parseBoundedText(body.title, "title", { max: LOCKED_TITLE_MAX_LENGTH, required: true }); // DEC-124
  }
  if (body.description !== undefined) {
    fields.description = parseBoundedOptionalText(body.description, "description", {
      max: LOCKED_ABSTRACT_MAX_LENGTH,
    }); // DEC-124
  }

  // DEC-598 (wave-34 amendment): trackIds/format/audienceLevel below (plus
  // the DEC-158 pre-edit content snapshot) are four independent reads —
  // none consumes another's result, and all sit behind the ownership check
  // above that has already resolved — issued as ONE wave via
  // settleInDeclarationOrder (never Promise.all, which would reject with
  // whichever settles first and silently change which field error the
  // caller sees). Rejections are re-thrown in DECLARATION order: trackIds,
  // format, audienceLevel, then getSubmissionContent.
  // DEC-598: trackIds is a full-set replace, and an empty array is a valid
  // "remove every track" request — unlike parseBoundedIdArray (used for the
  // bulk-status ids array), an empty trackIds array must NOT 400.
  // DEC-755: format is fixable after create — same field-options validation
  // as the POST create route.
  // DEC-900 amendment (findings wave 13): audienceLevel mirrors format
  // exactly — same field-options validation, same CLEAR-on-null semantics.
  const [trackIds, format, audienceLevel, content] = await settleInDeclarationOrder([
    body.trackIds !== undefined
      ? parseTrackIdsField(c.var.db, ownership.eventId, body.trackIds)
      : Promise.resolve(undefined),
    body.format !== undefined ? parseFormatField(c.var.db, ownership.eventId, body.format) : Promise.resolve(undefined),
    body.audienceLevel !== undefined
      ? parseAudienceLevelField(c.var.db, ownership.eventId, body.audienceLevel)
      : Promise.resolve(undefined),
    // DEC-158 (CNT-11): snapshot the pre-edit content so we can tell whether
    // this PATCH actually changed title/description before appending history.
    getSubmissionContent(c.var.db, id),
  ]);

  if (
    Object.keys(fields).length === 0 &&
    trackIds === undefined &&
    format === undefined &&
    audienceLevel === undefined
  ) {
    throw new ApiError(
      "invalid",
      "At least one of title, description, trackIds, format, or audienceLevel is required",
      {
        title: "Provide title, description, trackIds, format, or audienceLevel",
      },
    );
  }

  const before = content;
  if (!before) throw new ApiError("not_found", "Submission not found");

  if (Object.keys(fields).length > 0) {
    await updateSubmissionFields(c.var.db, id, fields);
  }

  const newTitle = fields.title ?? before.title;
  const newDescription = fields.description !== undefined ? fields.description : before.description;
  if (newTitle !== before.title || newDescription !== before.description) {
    const editorName = await resolveActorName(c.var.db, auth.userId);
    await appendSubmissionRevision(c.var.db, {
      submissionId: id,
      editorUserId: auth.userId,
      editorName,
      title: newTitle,
      description: newDescription,
    });
    await bumpIcsSequences(c.var.db, [id]); // DEC-519: title/description are VEVENT fields
  }

  // DEC-598: full-set replace through the same submission_track writer the
  // portal-edit path uses (src/server/repo/submit.ts:replaceSubmissionTracks)
  // — never title/description-only ics/revision semantics, tracks are not a
  // VEVENT field and don't affect ics sequence or content history.
  if (trackIds !== undefined) {
    await replaceSubmissionTracks(c.var.db, id, trackIds);
  }

  // DEC-755: format has no submission column — the same submission_answer
  // writer POST create uses (writeRoleAnswer deletes the row on null).
  if (format !== undefined) {
    await writeRoleAnswer(c.var.db, ownership.eventId, id, "session_format", format);
  }
  // DEC-900 amendment (findings wave 13): audienceLevel through the same
  // generalized writer, keyed on the audience_level-role field.
  if (audienceLevel !== undefined) {
    await writeRoleAnswer(c.var.db, ownership.eventId, id, "audience_level", audienceLevel);
  }

  const detail = await getSubmissionDetail(c.var.db, id);
  return c.json(detail);
});

// GET /api/v1/submissions/:id/revisions — organizer-only content history
// (CNT-11, DEC-158), newest-first standard list envelope.
submissionsRoutes.get("/submissions/:id/revisions", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const id = c.req.param("id");
  const ownership = await getSubmissionOwnership(c.var.db, id);
  if (!ownership) throw new ApiError("not_found", "Submission not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("not_found", "Submission not found");

  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage")); // DEC-465

  const [items, total] = await Promise.all([
    listRevisions(c.var.db, id, { limit: perPage, offset: (page - 1) * perPage }),
    countRevisions(c.var.db, id),
  ]);

  return c.json({ items, total, page, perPage });
});

// GET /api/v1/submissions/:id/history — organizer-only, DEC-892: the real
// timeline (submitted / edited / reviewed / emailed), merged and sorted
// server-side by listSubmissionHistory. Unpaginated, same rationale as
// GET .../evaluations — bounded by this one submission's own activity.
submissionsRoutes.get("/submissions/:id/history", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const id = c.req.param("id");
  const ownership = await getSubmissionOwnership(c.var.db, id);
  if (!ownership) throw new ApiError("not_found", "Submission not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("not_found", "Submission not found");

  const entries = await listSubmissionHistory(c.var.db, id);
  const items = entries.map((e) => ({ id: e.id, at: e.at.getTime(), kind: e.kind, label: e.label, detail: e.detail }));
  return c.json({ items, total: items.length, page: 1, perPage: items.length });
});

// POST /api/v1/submissions/:id/revisions/:revisionId/restore — organizer-only.
// Applies the snapshot's title+description through the same update path as
// the PATCH handler above, so the restore itself lands its own history row
// attributed to the restorer. Never sends email.
submissionsRoutes.post(
  "/submissions/:id/revisions/:revisionId/restore",
  requireOrganizer,
  csrfJson,
  async (c) => {
    const auth = requireAuth(c);
    const id = c.req.param("id");
    const revisionId = c.req.param("revisionId");
    const ownership = await getSubmissionOwnership(c.var.db, id);
    if (!ownership) throw new ApiError("not_found", "Submission not found");
    if (ownership.orgId !== auth.orgId) throw new ApiError("not_found", "Submission not found");

    const revision = await getRevision(c.var.db, id, revisionId);
    if (!revision) throw new ApiError("not_found", "Revision not found");

    const before = await getSubmissionContent(c.var.db, id);
    if (!before) throw new ApiError("not_found", "Submission not found");

    // DEC-124: revision restore replays a title/description the product
    // already accepted (either as the current row's own prior content, or a
    // value that itself passed the create/PATCH caps when it was written) —
    // so it is intentionally NOT re-bounded here by LOCKED_TITLE_MAX_LENGTH/
    // LOCKED_ABSTRACT_MAX_LENGTH.
    await updateSubmissionFields(c.var.db, id, { title: revision.title, description: revision.description });

    if (revision.title !== before.title || revision.description !== before.description) {
      const editorName = await resolveActorName(c.var.db, auth.userId);
      await appendSubmissionRevision(c.var.db, {
        submissionId: id,
        editorUserId: auth.userId,
        editorName,
        title: revision.title,
        description: revision.description,
      });
      await bumpIcsSequences(c.var.db, [id]); // DEC-519: title/description are VEVENT fields
    }

    const detail = await getSubmissionDetail(c.var.db, id);
    return c.json(detail);
  },
);

interface InviteParticipantBody {
  contactId?: unknown;
  role?: unknown;
}

// POST /api/v1/submissions/:id/participants — invite a participant onto an
// existing submission (DEC-070; closes w12-c PLANNER item #1: previously
// the only way to construct a participant row with invite_status='invited'
// was a direct D1 write from the walkthrough script). Per product
// principle 4, this does NOT send an email — notifying the invitee is a
// separate, explicit comms action.
submissionsRoutes.post("/submissions/:id/participants", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const id = c.req.param("id");
  const ownership = await getSubmissionOwnership(c.var.db, id);
  if (!ownership) throw new ApiError("not_found", "Submission not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("not_found", "Submission not found");

  const body = (await readOptionalJsonBody(c)) as unknown as InviteParticipantBody;
  const contactId = typeof body.contactId === "string" ? body.contactId.trim() : "";
  if (!contactId) {
    throw new ApiError("invalid", "contactId is required", { contactId: "Required" });
  }
  const role = typeof body.role === "string" && body.role.trim() ? body.role.trim() : undefined;
  // DEC-784: role is validated against the same imported vocabulary the
  // speaker-portal picker offers -- an unknown value is a loud field error,
  // never silently defaulted to 'speaker'.
  if (role !== undefined && !PARTICIPANT_ROLE_OPTIONS.some((opt) => opt.value === role)) {
    throw new ApiError("invalid", "Unknown participant role", { role: "Invalid role" });
  }

  const contact = await findContactForOrg(c.var.db, contactId, auth.orgId);
  if (!contact) {
    throw new ApiError("invalid", "Contact not found in this org", { contactId: "Invalid contact" });
  }

  const result = await inviteParticipant(c.var.db, {
    submissionId: id,
    contactId,
    role,
    titleAtTime: contact.title,
    orgAtTime: contact.company,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
  });
  if (result === DUPLICATE_PARTICIPANT) {
    throw new ApiError("invalid", "This contact is already a participant on this submission", {
      contactId: "Already invited",
    });
  }
  if (result === OVER_CAP) {
    // Read AFTER the refusal (not before) purely to compose an accurate
    // message -- inviteParticipant already made the enforcement decision
    // off its own pre-write count, this is display-only. Same shared
    // grammar (src/domain/cap-copy.ts:participantCapRefusalMessage) the
    // speaker portal's addCoPresenter door uses, so a stored count is never
    // presented as a position inside a remaining allowance.
    const count = await getParticipantCount(c.var.db, id);
    throw new ApiError("invalid", "This submission already has the maximum number of participants allowed", {
      contactId: participantCapRefusalMessage(count, MAX_PARTICIPANTS_PER_SUBMISSION),
    });
  }

  // DEC-278: a participant added to an already-'accepted' submission never
  // goes through updateSubmissionStatuses' fireAcceptance branch (that only
  // fires once, at the original accept transition), so the who-owes-me-what
  // dashboard would otherwise never see them. inviteParticipant currently
  // always writes inviteStatus='invited' (not active), so this is a no-op
  // today — kept anyway as the correct guard for any future default change.
  const submissionStatus = await getSubmissionStatus(c.var.db, id);
  if (submissionStatus === "accepted" && isActiveParticipant(result.inviteStatus)) {
    await ensureOnboardingTasks(c.var.db, ownership.eventId, id, [contactId], new Date());
  }

  return c.json(result, 201);
});

// DELETE /api/v1/submissions/:id/participants/:participantId — remove a
// co-presenter from a submission (user-filed, gate-8 cycle: the detail
// page's Remove action shipped with no server half — its render test mocks
// the API, so the missing route only surfaced live on prod). The LEAD is
// never removable here (same protection as the PATCH sibling's role guard);
// recording a decline is the PATCH route's inviteStatus job — this removes
// the row outright.
submissionsRoutes.delete(
  "/submissions/:id/participants/:participantId",
  requireOrganizer,
  csrfJson,
  async (c) => {
    const auth = requireAuth(c);
    const id = c.req.param("id");
    const participantId = c.req.param("participantId");
    const ownership = await getSubmissionOwnership(c.var.db, id);
    if (!ownership) throw new ApiError("not_found", "Submission not found");
    if (ownership.orgId !== auth.orgId) throw new ApiError("not_found", "Submission not found");
    const scope = await getParticipantOwnership(c.var.db, participantId);
    if (!scope || scope.submissionId !== id) {
      throw new ApiError("not_found", "Participant not found on this submission");
    }
    const leadId = await getSubmissionLeadParticipantId(c.var.db, id);
    if (participantId === leadId) {
      throw new ApiError("invalid", "The lead participant cannot be removed", {
        role: "Cannot remove the lead",
      });
    }
    const deleted = await removeParticipantRow(c.var.db, participantId, id);
    return c.json({ deleted });
  },
);

interface ParticipantVisibilityBody {
  visible?: unknown;
  inviteStatus?: unknown;
  role?: unknown;
}

// DEC-789 write half: the closed invite-status vocabulary the roster UI
// (task w3-h) reads from and writes back through this same PATCH.
const INVITE_STATUS_VALUES = new Set(["none", "invited", "accepted", "declined"]);

// PATCH /api/v1/submissions/:id/participants/:participantId — toggle a
// participant's public visibility. (w12-c PLANNER item #2: previously
// participant.visible was only ever written at submission-create time.)
submissionsRoutes.patch(
  "/submissions/:id/participants/:participantId",
  requireOrganizer,
  csrfJson,
  async (c) => {
    const auth = requireAuth(c);
    const id = c.req.param("id");
    const participantId = c.req.param("participantId");
    const ownership = await getSubmissionOwnership(c.var.db, id);
    if (!ownership) throw new ApiError("not_found", "Submission not found");
    if (ownership.orgId !== auth.orgId) throw new ApiError("not_found", "Submission not found");

    const scope = await getParticipantOwnership(c.var.db, participantId);
    if (!scope || scope.submissionId !== id) {
      throw new ApiError("not_found", "Participant not found on this submission");
    }

    const body = (await readOptionalJsonBody(c)) as unknown as ParticipantVisibilityBody;
    if (body.visible === undefined && body.inviteStatus === undefined && body.role === undefined) {
      throw new ApiError("invalid", "visible, inviteStatus or role is required", { visible: "Required" });
    }
    if (body.visible !== undefined) {
      if (typeof body.visible !== "boolean") {
        throw new ApiError("invalid", "visible must be a boolean", { visible: "Required" });
      }
      await setParticipantVisible(c.var.db, participantId, body.visible, scope.submissionId);
    }
    if (body.inviteStatus !== undefined) {
      // DEC-789: organizer-only write against the closed
      // none|invited|accepted|declined set -- an unknown value is a loud
      // 400, never silently coerced or dropped.
      if (typeof body.inviteStatus !== "string" || !INVITE_STATUS_VALUES.has(body.inviteStatus)) {
        throw new ApiError("invalid", "inviteStatus must be one of none|invited|accepted|declined", {
          inviteStatus: "Invalid invite status",
        });
      }
      await setParticipantInviteStatus(c.var.db, participantId, body.inviteStatus, scope.submissionId);
    }
    if (body.role !== undefined) {
      // DEC-900 amendment (findings wave 13): same closed vocabulary the
      // POST invite sibling validates against at :491-497 above.
      if (typeof body.role !== "string" || !PARTICIPANT_ROLE_OPTIONS.some((opt) => opt.value === body.role)) {
        throw new ApiError("invalid", "Unknown participant role", { role: "Invalid role" });
      }
      // DEC-900 amendment (findings wave 13): the LEAD is never retargeted
      // from this route -- refuse both a request naming the lead row and a
      // request whose new value is the lead role ('speaker'), since either
      // would silently change who this submission's lead is.
      const leadId = await getSubmissionLeadParticipantId(c.var.db, scope.submissionId);
      if (participantId === leadId) {
        throw new ApiError("invalid", "The lead participant's role cannot be changed from this route", {
          role: "Cannot change the lead's role",
        });
      }
      if (body.role === "speaker") {
        throw new ApiError("invalid", "speaker is reserved for the lead participant", {
          role: "Cannot make a co-presenter the lead",
        });
      }
      await setParticipantRole(c.var.db, participantId, body.role, scope.submissionId);
    }
    const row = await getParticipantRow(c.var.db, participantId);
    // DEC-278/DEC-813: the Speakers grid's toggleInviteStatus control (this
    // route) can flip a participant to an active invite status on a
    // submission that is already 'accepted' -- the same acceptance-firing
    // gap as the invite-a-new-participant path above, so it gets the same
    // ensureOnboardingTasks guard rather than leaving the new speaker
    // visible with zero onboarding tasks.
    if (row && (await getSubmissionStatus(c.var.db, id)) === "accepted" && isActiveParticipant(row.inviteStatus)) {
      await ensureOnboardingTasks(c.var.db, ownership.eventId, id, [row.contactId], new Date());
    }
    return c.json(row);
  },
);

interface StatusUpdateBody {
  ids?: unknown;
  status?: unknown;
}

// POST /api/v1/events/:eventId/submissions/status
submissionsRoutes.post("/events/:eventId/submissions/status", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);

  const body = (await readOptionalJsonBody(c)) as unknown as StatusUpdateBody;
  const ids = parseBoundedIdArray(body.ids, "ids"); // DEC-182
  if (!isValidStatusLiteral(body.status)) {
    throw new ApiError("invalid", "status must be one of the DEC-003 submission statuses", {
      status: "Invalid status",
    });
  }

  const result = await updateSubmissionStatuses(c.var.db, eventId, ids, body.status, new Date());
  return c.json(result);
});

// -----------------------------------------------------------------------
// GET /api/v1/events/:eventId/submissions/delete-plan — DEC-921 blast-radius
// preview + POST /api/v1/events/:eventId/submissions/delete — DEC-886/921
// guarded cascade
// -----------------------------------------------------------------------
// Self-contained block (kept separate from the status route above so this
// merges cleanly alongside an in-flight content-status list-filter lane
// touching the same file).

interface DeleteBody {
  ids?: unknown;
}

// The confirmation page's read-only preview of planSubmissionDelete —
// projected explicitly so the internal-only fileR2Keys field (the route
// deletes those R2 objects after committing the row delete) never reaches
// the wire.
submissionsRoutes.get("/events/:eventId/submissions/delete-plan", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);

  const raw = c.req.query("ids") ?? "";
  const ids = parseBoundedIdArray(
    raw.split(",").filter((s) => s.length > 0),
    "ids",
  ); // DEC-182 — same bounded id parsing the POST body uses

  const plan = await planSubmissionDelete(c.var.db, eventId, ids);

  return c.json({
    eligible: plan.eligible.map((item) => ({
      submissionId: item.submissionId,
      ref: item.ref,
      title: item.title,
      counts: item.counts,
      scheduled: item.scheduled,
    })),
    refused: plan.refused,
  });
});

submissionsRoutes.post("/events/:eventId/submissions/delete", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);

  const body = (await readOptionalJsonBody(c)) as unknown as DeleteBody;
  const ids = parseBoundedIdArray(body.ids, "ids"); // DEC-182

  const plan = await planSubmissionDelete(c.var.db, eventId, ids);

  // DEC-713 ordering (amended wave 50): row-delete commits FIRST, then the
  // R2 objects are deleted. The two failure modes are not symmetric — a
  // committed row pointing at missing bytes 404s forever and silently
  // breaks the "history complete and downloadable" guarantee, while an
  // object outliving its row is just an unreferenced blob, invisible and
  // reclaimable. A deleteMany throw after the commit is logged and
  // swallowed: a committed delete must never be reported as a failure.
  const deleted = await commitSubmissionDelete(
    c.var.db,
    eventId,
    plan.eligible.map((item) => item.submissionId),
  );

  const store = makeFileStore(c.env.FILES);
  const keys = plan.eligible.flatMap((item) => item.fileR2Keys);
  try {
    await store.deleteMany(keys);
  } catch (err) {
    console.error(
      `submissions/delete: deleteMany failed for event ${eventId} after row commit (${keys.length} keys)`,
      err,
    );
  }

  return c.json({ deleted, refused: plan.refused });
});

interface ContentStatusUpdateBody {
  ids?: unknown;
  contentStatus?: unknown;
}

// POST /api/v1/events/:eventId/submissions/content-status — DEC-825 amendment
// bulk content-approval write, organizer-only.
submissionsRoutes.post(
  "/events/:eventId/submissions/content-status",
  requireOrganizer,
  csrfJson,
  async (c) => {
    const auth = requireAuth(c);
    const eventId = c.req.param("eventId");
    await assertEventOwnership(c.var.db, eventId, auth.orgId);

    const body = (await readOptionalJsonBody(c)) as unknown as ContentStatusUpdateBody;
    const ids = parseBoundedIdArray(body.ids, "ids"); // DEC-182
    if (!isValidContentStatus(body.contentStatus)) {
      throw new ApiError(
        "invalid",
        "contentStatus must be 'pending', 'approved' or 'changes_requested'",
        { contentStatus: "Invalid contentStatus" },
      );
    }

    const result = await updateContentStatuses(c.var.db, eventId, ids, body.contentStatus);
    return c.json(result);
  },
);
