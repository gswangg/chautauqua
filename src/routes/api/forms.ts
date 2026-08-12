// CFP form-builder API (J1), per DEC-008/DEC-012/DEC-013/DEC-015.
// Route file exports a named Hono<AppEnv> sub-app; only src/index.ts mounts
// it (DEC-012). Handlers stay thin: parse/authz -> repo -> pure core ->
// response. Every :id lookup is object-level org-scoped (no IDOR).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson, requireOrganizer } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { MAX_LONG_TEXT_LENGTH } from "../../forms/validate"; // DEC-417
import { validateFieldDefInput, isPermutation, type FieldDefInput } from "../../forms/builder";
import type { FormFieldDef, FormFieldRule } from "../../forms/types";
import * as repo from "../../server/repo/forms";
import type { FormFieldRow } from "../../server/repo/forms";
import { listTracksForEvent } from "../../server/repo/events";
import { DEC_300 } from "../../decisions";

void DEC_300; // DELETE /api/v1/fields/:fieldId cascade-confirm below

export const formsRoutes = new Hono<AppEnv>();

function toPublicField(field: FormFieldRow) {
  const { formId: _formId, ...rest } = field;
  return rest;
}

function toDefList(fields: FormFieldRow[]): FormFieldDef[] {
  return fields.map(({ formId: _formId, locked: _locked, ...def }) => def);
}

function serializeForm(
  form: repo.FormRow,
  fields: FormFieldRow[],
  forms: { id: string; title: string; isDefault: boolean }[],
) {
  return {
    id: form.id,
    eventId: form.eventId,
    title: form.title,
    intro: form.intro,
    isDefault: form.isDefault,
    openDate: form.openDate,
    closeDate: form.closeDate,
    tracks: form.tracks,
    fields: fields.map(toPublicField),
    forms,
  };
}

async function requireOwnedForm(c: { var: { db: import("../../server/context").Db; auth?: { orgId: string } } }, formId: string) {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  const form = await repo.findFormForOrg(c.var.db, formId, auth.orgId);
  if (!form) throw new ApiError("not_found", "Form not found");
  return form;
}

async function requireOwnedField(c: { var: { db: import("../../server/context").Db; auth?: { orgId: string } } }, fieldId: string) {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  const field = await repo.findFieldForOrg(c.var.db, fieldId, auth.orgId);
  if (!field) throw new ApiError("not_found", "Field not found");
  return field;
}

// GET /api/v1/events/:eventId/forms — the event's CFP form + ordered
// fields; creates the default form (locked built-ins) on first read.
formsRoutes.get("/api/v1/events/:eventId/forms", requireOrganizer, async (c) => {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  const eventId = c.req.param("eventId");
  const event = await repo.findEventForOrg(c.var.db, eventId, auth.orgId);
  if (!event) throw new ApiError("not_found", "Event not found");

  const { form, fields } = await repo.getOrCreateForm(c.var.db, eventId);
  const forms = await repo.listFormsForEvent(c.var.db, eventId);
  return c.json(serializeForm(form, fields, forms));
});

// PATCH /api/v1/forms/:formId — intro text, openDate, closeDate, tracks
// offered (form.tracks_json per DEC-015).
formsRoutes.patch("/api/v1/forms/:formId", requireOrganizer, csrfJson, async (c) => {
  const formId = c.req.param("formId");
  const form = await requireOwnedForm(c, formId);

  const body = await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  });

  const errors: Record<string, string> = {};
  const patch: repo.FormPatch = {};

  if (body.intro !== undefined) {
    if (body.intro !== null && typeof body.intro !== "string") {
      errors.intro = "must be a string";
    } else if (body.intro !== null && body.intro.length > MAX_LONG_TEXT_LENGTH) {
      errors.intro = `must be at most ${MAX_LONG_TEXT_LENGTH} characters`; // DEC-417
    } else {
      patch.intro = body.intro;
    }
  }
  if (body.openDate !== undefined) {
    if (body.openDate !== null && typeof body.openDate !== "number") {
      errors.openDate = "must be a ms-epoch number";
    } else {
      patch.openDate = body.openDate;
    }
  }
  if (body.closeDate !== undefined) {
    if (body.closeDate !== null && typeof body.closeDate !== "number") {
      errors.closeDate = "must be a ms-epoch number";
    } else {
      patch.closeDate = body.closeDate;
    }
  }
  if (body.tracks !== undefined) {
    if (body.tracks !== null && (!Array.isArray(body.tracks) || !body.tracks.every((t: unknown) => typeof t === "string"))) {
      errors.tracks = "must be an array of track ids";
    } else if (body.tracks !== null) {
      const deduped = [...new Set(body.tracks as string[])];
      const eventTracks = await listTracksForEvent(c.var.db, form.eventId);
      const validIds = new Set(eventTracks.map((t) => t.id));
      const unknown = deduped.find((id) => !validIds.has(id));
      if (unknown !== undefined) {
        errors.tracks = `unknown track id: ${unknown}`;
      } else {
        patch.tracks = deduped;
      }
    } else {
      patch.tracks = null;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiError("invalid", "Validation failed", errors);
  }

  const updated = await repo.patchForm(c.var.db, formId, patch);
  const fields = await repo.listFields(c.var.db, formId);
  const forms = await repo.listFormsForEvent(c.var.db, updated.eventId);
  return c.json(serializeForm(updated, fields, forms));
});

// POST /api/v1/forms/:formId/fields — create a custom field.
formsRoutes.post("/api/v1/forms/:formId/fields", requireOrganizer, csrfJson, async (c) => {
  const formId = c.req.param("formId");
  await requireOwnedForm(c, formId);

  const body = (await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  })) as FieldDefInput;

  const existing = await repo.listFields(c.var.db, formId);
  const existingDefs = toDefList(existing);
  const result = validateFieldDefInput(body, existingDefs);
  if (!result.ok) {
    throw new ApiError("invalid", "Validation failed", result.errors);
  }
  // Required top-level fields not covered by validateFieldDefInput's
  // optional-patch semantics: section, kind, label are mandatory on create.
  const createErrors: Record<string, string> = {};
  if (body.section === undefined) createErrors.section = "required";
  if (body.kind === undefined) createErrors.kind = "required";
  if (body.label === undefined) createErrors.label = "required";
  if (Object.keys(createErrors).length > 0) {
    throw new ApiError("invalid", "Validation failed", createErrors);
  }

  const created = await repo.createField(c.var.db, formId, {
    section: body.section as FormFieldDef["section"],
    kind: body.kind as FormFieldDef["kind"],
    label: body.label as string,
    helpText: typeof body.helpText === "string" ? body.helpText : undefined,
    required: typeof body.required === "boolean" ? body.required : false,
    options: Array.isArray(body.options) ? (body.options as string[]) : undefined,
    rule: body.rule ? (body.rule as FormFieldRule) : undefined,
  });

  return c.json(toPublicField(created), 201);
});

// PATCH /api/v1/fields/:fieldId — edit a custom field; locked built-ins
// reject edits to required/removal.
formsRoutes.patch("/api/v1/fields/:fieldId", requireOrganizer, csrfJson, async (c) => {
  const fieldId = c.req.param("fieldId");
  const field = await requireOwnedField(c, fieldId);

  const body = (await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  })) as FieldDefInput;

  if (field.locked && body.required !== undefined && body.required !== field.required) {
    throw new ApiError("invalid", "Locked fields' required flag cannot be changed");
  }

  const siblings = (await repo.listFields(c.var.db, field.formId)).filter((f) => f.id !== fieldId);
  const siblingDefs = toDefList(siblings);
  const result = validateFieldDefInput(body, siblingDefs, fieldId);
  if (!result.ok) {
    throw new ApiError("invalid", "Validation failed", result.errors);
  }

  const updated = await repo.patchField(c.var.db, fieldId, {
    label: typeof body.label === "string" ? body.label : undefined,
    helpText: body.helpText !== undefined ? (body.helpText === null ? null : String(body.helpText)) : undefined,
    required: field.locked ? undefined : typeof body.required === "boolean" ? body.required : undefined,
    options: body.options !== undefined ? (body.options === null ? null : (body.options as string[])) : undefined,
    rule: body.rule !== undefined ? (body.rule === null ? null : (body.rule as FormFieldRule)) : undefined,
  });

  return c.json(toPublicField(updated));
});

// DELETE /api/v1/fields/:fieldId — remove a custom field; locked built-ins
// reject removal. DEC-300: a field with dependent visibility rules or
// collected answers 409s naming them unless ?cascade=1, which clears the
// rules and deletes the answers as part of the same delete.
formsRoutes.delete("/api/v1/fields/:fieldId", requireOrganizer, csrfJson, async (c) => {
  const fieldId = c.req.param("fieldId");
  const field = await requireOwnedField(c, fieldId);

  if (field.locked) {
    throw new ApiError("invalid", "Locked built-in fields cannot be removed");
  }

  const { dependentLabels, answerCount } = await repo.describeFieldDependents(c.var.db, field.formId, fieldId);
  const cascade = c.req.query("cascade") === "1";
  if ((dependentLabels.length > 0 || answerCount > 0) && !cascade) {
    throw new ApiError(
      "conflict",
      `"${field.label}" has ${dependentLabels.length} dependent question(s) and ${answerCount} collected answer(s). Confirm to delete them too.`,
      { dependents: dependentLabels.join(", "), answers: String(answerCount) },
    );
  }

  const { clearedRules, deletedAnswers } = await repo.deleteFieldCascade(c.var.db, field.formId, fieldId);
  return c.json({ ok: true, clearedRules, deletedAnswers });
});

// POST /api/v1/forms/:formId/fields/reorder — orderedIds must be a
// permutation of the form's field ids.
formsRoutes.post("/api/v1/forms/:formId/fields/reorder", requireOrganizer, csrfJson, async (c) => {
  const formId = c.req.param("formId");
  await requireOwnedForm(c, formId);

  const body = await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  });

  const existing = await repo.listFields(c.var.db, formId);
  const existingIds = existing.map((f) => f.id);
  if (!isPermutation(existingIds, body?.orderedIds)) {
    throw new ApiError("invalid", "orderedIds must be a permutation of the form's field ids", {
      orderedIds: "must be a permutation of the form's field ids",
    });
  }

  const reordered = await repo.reorderFields(c.var.db, formId, body.orderedIds as string[]);
  return c.json({ items: reordered.map(toPublicField) });
});
