// CFP form-builder API (J1), per DEC-008/DEC-012/DEC-013/DEC-015.
// Route file exports a named Hono<AppEnv> sub-app; only src/index.ts mounts
// it (DEC-012). Handlers stay thin: parse/authz -> repo -> pure core ->
// response. Every :id lookup is object-level org-scoped (no IDOR).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson, requireOrganizer } from "../../server/middleware";
import { ApiError, requireAtLeastOneField } from "../../server/http";
import { MAX_LONG_TEXT_LENGTH, MAX_NAME_LENGTH } from "../../forms/validate"; // DEC-417
import { overCapCountMessage } from "../../domain/cap-copy";
import { validateFieldDefInput, validateRuleReference, isPermutation, type FieldDefInput } from "../../forms/builder";
import type { FormFieldDef, FormFieldRole, FormFieldRule } from "../../forms/types";
import { FORM_FIELD_ROLES } from "../../forms/types";
import * as repo from "../../server/repo/forms";
import type { FormFieldRow } from "../../server/repo/forms";
import { listTracksForEvent } from "../../server/repo/events";
import { isDayLabelMs, isEpochOrderValid } from "./validators"; // DEC-517/DEC-522
import { DEC_300 } from "../../decisions";
import { countOf } from "../../domain/count-copy";
import { MAX_FORM_FIELDS } from "../../domain/form-copy";

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
  // DEC-627 (amendment, wave 6): every field on this PATCH is optional; an
  // empty body must be refused rather than reaching patchForm as a no-op.
  requireAtLeastOneField(body, ["title", "intro", "openDate", "closeDate", "tracks"]);

  const errors: Record<string, string> = {};
  const patch: repo.FormPatch = {};

  // DEC-731 (wave 8 amendment): "Form name" is the frame's plain-language
  // label for form.title -- the same field the public submit view reads as
  // the page title. Non-empty, same length cap grammar as intro.
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      errors.title = "must be a non-empty string";
    } else if (body.title.length > MAX_NAME_LENGTH) {
      errors.title = `must be at most ${MAX_NAME_LENGTH} characters`; // DEC-417
    } else {
      patch.title = body.title;
    }
  }
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
    if (body.openDate !== null && !isDayLabelMs(body.openDate)) {
      errors.openDate = "must be a UTC-midnight day label (ms-epoch multiple of 86400000)"; // DEC-522
    } else {
      patch.openDate = body.openDate;
    }
  }
  if (body.closeDate !== undefined) {
    if (body.closeDate !== null && !isDayLabelMs(body.closeDate)) {
      errors.closeDate = "must be a UTC-midnight day label (ms-epoch multiple of 86400000)"; // DEC-522
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

  // DEC-517: order check against the MERGED post-patch state -- whichever
  // side the body omits falls back to the form's already-stored value, so a
  // PATCH touching only closeDate is still checked against the stored
  // openDate.
  if (Object.keys(errors).length === 0) {
    const effectiveOpen = patch.openDate !== undefined ? patch.openDate : form.openDate;
    const effectiveClose = patch.closeDate !== undefined ? patch.closeDate : form.closeDate;
    if (!isEpochOrderValid(effectiveOpen, effectiveClose)) {
      errors.openDate = "openDate must be before or equal to closeDate";
      errors.closeDate = "closeDate must be after or equal to openDate";
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
  if (existing.length >= MAX_FORM_FIELDS) {
    throw new ApiError("invalid", `This form already has the maximum of ${MAX_FORM_FIELDS} questions.`, {
      label: overCapCountMessage(existing.length + 1, MAX_FORM_FIELDS, "field"),
    });
  }
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
  // DEC-627 (amendment, wave 6): every field on this PATCH is optional; an
  // empty body must be refused rather than reaching patchField as a no-op.
  requireAtLeastOneField(body as unknown as Record<string, unknown>, [
    "label",
    "helpText",
    "required",
    "kind",
    "section",
    "options",
    "rule",
    "role",
  ]);

  if (field.locked && body.required !== undefined && body.required !== field.required) {
    throw new ApiError("invalid", "Locked fields' required flag cannot be changed");
  }

  // DEC-505: locked built-in fields also cannot have their kind or section
  // changed — those are structural properties of the built-in.
  if (
    field.locked &&
    ((body.kind !== undefined && body.kind !== field.kind) ||
      (body.section !== undefined && body.section !== field.section))
  ) {
    throw new ApiError("invalid", "Locked fields' kind and section cannot be changed");
  }

  // DEC-625: a locked built-in field can never be given a visibility rule
  // (it can never be hidden, so a rule on it would be dead/misleading).
  if (field.locked && body.rule !== undefined) {
    throw new ApiError("invalid", "Locked built-in fields cannot be given a visibility rule", {
      rule: "Not allowed on a locked field",
    });
  }

  // DEC-592 (findings wave 13): role is a two-way door -- null clears it, a
  // FORM_FIELD_ROLES member grants it. Anything else is a 400 keyed `role`.
  if (body.role !== undefined && body.role !== null && !FORM_FIELD_ROLES.includes(body.role as FormFieldRole)) {
    throw new ApiError("invalid", "Validation failed", {
      role: `must be one of ${FORM_FIELD_ROLES.join(", ")}, or null`,
    });
  }
  const grantingRole = body.role !== undefined && body.role !== null;

  // Locked built-in fields can never be given a role (they're already
  // resolved by their own id/kind, and DEC-592's role-tagged fields are
  // always minted non-locked precisely so they can be reconfigured).
  if (grantingRole && field.locked) {
    throw new ApiError("invalid", "Locked built-in fields cannot be given a role", {
      role: "Not allowed on a locked field",
    });
  }

  // A field that carries or is being given a role must be a session-section
  // dropdown -- that's the shape every role-keyed reader (getFieldOptionsByRole,
  // the New-submission Format select, auto-schedule's duration fallback)
  // assumes.
  if (grantingRole) {
    const effectiveKind = typeof body.kind === "string" ? body.kind : field.kind;
    const effectiveSection = typeof body.section === "string" ? body.section : field.section;
    if (effectiveKind !== "dropdown" || effectiveSection !== "session") {
      throw new ApiError("invalid", "A role can only be granted to a session-section dropdown field", {
        role: "must be a session-section dropdown field",
      });
    }
  }

  // A kind/section change is refused while the field already carries a role
  // -- same refusal shape as the locked-field kind/section guard above; a
  // role-tagged field must clear its role first (via this same route) before
  // its kind or section can change.
  if (field.role != null) {
    const roleKindSectionErrors: Record<string, string> = {};
    if (body.kind !== undefined && body.kind !== field.kind) {
      roleKindSectionErrors.kind = "cannot be changed while the field carries a role";
    }
    if (body.section !== undefined && body.section !== field.section) {
      roleKindSectionErrors.section = "cannot be changed while the field carries a role";
    }
    if (Object.keys(roleKindSectionErrors).length > 0) {
      throw new ApiError("invalid", "Role-tagged fields' kind and section cannot be changed", roleKindSectionErrors);
    }
  }

  // DEC-592 (findings wave 13): at most one field per (form, role) -- a
  // grant that would create a second 400s naming the field that already
  // holds it.
  if (grantingRole) {
    const incumbent = await repo.findFieldByRole(c.var.db, field.formId, body.role as FormFieldRole);
    if (incumbent && incumbent.id !== fieldId) {
      throw new ApiError("invalid", `"${incumbent.label}" (${incumbent.id}) already has this role`, {
        role: `already granted to "${incumbent.label}" (${incumbent.id})`,
      });
    }
  }

  const siblings = (await repo.listFields(c.var.db, field.formId)).filter((f) => f.id !== fieldId);
  const siblingDefs = toDefList(siblings);
  const result = validateFieldDefInput(body, siblingDefs, { id: fieldId, kind: field.kind });
  if (!result.ok) {
    throw new ApiError("invalid", "Validation failed", result.errors);
  }

  // DEC-505: a kind change that would orphan already-collected answers is
  // refused outright — the producer must delete and re-create the question
  // instead (mirrors DEC-300's field-delete confirm, but kind changes have
  // no cascade option since the stored answer shape wouldn't fit the new kind).
  //
  // Amendment (wave 54): this OVERRULES DEC-505's original "section is pure
  // grouping" clause. Section is not pure grouping — it is the anonymisation
  // boundary DEC-a-later-decision reads (speaker-section answers are
  // stripped from what an anonymised reviewer sees; session-section answers
  // are not). So a section change with collected answers is refused with the
  // same conflict shape as a kind change, for the same reason: moving
  // answers between sections would change what anonymised reviewers can
  // see for data already collected. Both guards read ONE
  // describeFieldDependents call — never issue the query twice.
  const kindChanging = typeof body.kind === "string" && body.kind !== field.kind;
  const sectionChanging = typeof body.section === "string" && body.section !== field.section;
  if (kindChanging || sectionChanging) {
    const { answerCount } = await repo.describeFieldDependents(c.var.db, field.formId, fieldId);
    if (answerCount > 0) {
      if (kindChanging) {
        throw new ApiError(
          "conflict",
          `"${field.label}" has ${countOf(answerCount, "collected answer")}; changing its kind would orphan them. Delete and re-create the question instead.`,
          { answers: String(answerCount) },
        );
      }
      throw new ApiError(
        "conflict",
        `"${field.label}" has ${countOf(answerCount, "collected answer")}; moving it between the speaker and session sections would change what anonymised reviewers can see. Delete and re-create the question instead.`,
        { answers: String(answerCount) },
      );
    }
  }

  // DEC-505: removing an option that submissions have already answered would
  // orphan those answers — validate.ts refuses any stored answer whose value
  // is no longer in field.options, so the speaker's next save on an
  // untouched field would 409. Refuse the removal outright instead, naming
  // each blocked option and its answer count, before patchField runs.
  if (Array.isArray(body.options) && field.options != null) {
    const incoming = new Set(body.options as string[]);
    const removed = field.options.filter((opt) => !incoming.has(opt));
    if (removed.length > 0) {
      const optionCounts = await repo.countAnswersByOptionValue(c.var.db, fieldId);
      const blocked = removed.filter((opt) => (optionCounts.get(opt) ?? 0) > 0);
      if (blocked.length > 0) {
        const detail = blocked.map((opt) => `"${opt}" (${countOf(optionCounts.get(opt) ?? 0, "answer")})`).join(", ");
        throw new ApiError(
          "conflict",
          `${countOf(blocked.length, "option")} still has collected answers: ${detail}. Nothing was changed — delete and re-create the question to drop it, or leave the option in place.`,
          { options: String(blocked.length) },
        );
      }
    }
  }

  // DEC-505 (amendment, wave 49): this field's post-patch shape may
  // invalidate a SIBLING's stored rule (an option this field's kind/options
  // used to satisfy but no longer does, e.g. a removed dropdown option or a
  // dropdown->number kind change). validateRuleReference only ever ran the
  // OTHER direction (this field's own rule against siblings, at :300) --
  // never a sibling's rule against this field's new shape. Build the
  // effective post-patch def for this field and re-check every sibling
  // whose rule targets it; a newly-invalid rule 409s naming the sibling
  // unless ?cascade=1, which clears exactly those rules in the same write.
  const effectiveSelfDef: FormFieldDef = {
    id: fieldId,
    section: typeof body.section === "string" ? (body.section as FormFieldDef["section"]) : field.section,
    kind: typeof body.kind === "string" ? (body.kind as FormFieldDef["kind"]) : field.kind,
    label: typeof body.label === "string" ? body.label : field.label,
    required: field.required,
    position: field.position,
    options: body.options !== undefined ? (body.options === null ? undefined : (body.options as string[])) : field.options,
    rule: body.rule !== undefined ? (body.rule === null ? undefined : (body.rule as FormFieldRule)) : field.rule,
    role: field.role,
  };
  const dependentSiblings = siblings.filter((s) => s.rule?.fieldId === fieldId);
  const invalidatedSiblings = dependentSiblings.filter((s) => {
    const otherDefs = siblingDefs.filter((d) => d.id !== s.id).concat(effectiveSelfDef);
    return validateRuleReference(s.rule as FormFieldRule, otherDefs, s.id) !== undefined;
  });
  if (invalidatedSiblings.length > 0) {
    const cascade = c.req.query("cascade") === "1";
    if (!cascade) {
      throw new ApiError(
        "conflict",
        `This change would invalidate ${countOf(invalidatedSiblings.length, "dependent question")}'s visibility rule: ${invalidatedSiblings
          .map((s) => `"${s.label}"`)
          .join(", ")}. Confirm to clear them too.`,
        { dependents: invalidatedSiblings.map((s) => s.label).join(", ") },
      );
    }
  }

  const updated = await repo.patchField(c.var.db, fieldId, {
    label: typeof body.label === "string" ? body.label : undefined,
    helpText: body.helpText !== undefined ? (body.helpText === null ? null : String(body.helpText)) : undefined,
    required: field.locked ? undefined : typeof body.required === "boolean" ? body.required : undefined,
    options: body.options !== undefined ? (body.options === null ? null : (body.options as string[])) : undefined,
    rule: body.rule !== undefined ? (body.rule === null ? null : (body.rule as FormFieldRule)) : undefined,
    section: typeof body.section === "string" ? (body.section as FormFieldDef["section"]) : undefined,
    kind: typeof body.kind === "string" ? (body.kind as FormFieldDef["kind"]) : undefined,
    role: body.role !== undefined ? (body.role === null ? null : (body.role as FormFieldRole)) : undefined,
  });

  if (invalidatedSiblings.length > 0) {
    const clearedRules = await repo.clearFieldRules(
      c.var.db,
      invalidatedSiblings.map((s) => s.id),
    );
    return c.json({ ...toPublicField(updated), clearedRules });
  }

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

  // DEC-592 (findings wave 13): a role-tagged field is the ONE resolution
  // site every role-keyed reader depends on -- deleting it out from under
  // them would silently kill the public ?format= facet, the reviewer
  // queue's format, auto-schedule's duration fallback and the submissions
  // format/audienceLevel contract. Refuse and say what to do instead.
  if (field.role != null) {
    throw new ApiError("invalid", `"${field.label}" is used to resolve this event's ${field.role} answers; clear its role first, then delete it.`, {
      role: "clear its role first",
    });
  }

  const { dependentLabels, answerCount } = await repo.describeFieldDependents(c.var.db, field.formId, fieldId);
  const cascade = c.req.query("cascade") === "1";
  if ((dependentLabels.length > 0 || answerCount > 0) && !cascade) {
    throw new ApiError(
      "conflict",
      `"${field.label}" has ${countOf(dependentLabels.length, "dependent question")} and ${countOf(answerCount, "collected answer")}. Confirm to delete them too.`,
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
  return c.json({ items: reordered.map(toPublicField), total: reordered.length, page: 1, perPage: MAX_FORM_FIELDS });
});
