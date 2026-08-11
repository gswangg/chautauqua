// Portal tasks + resources (J7 depth), per DEC-029 + DEC-028 (shared
// gate/layout) + DEC-023 (assignment status semantics owned by
// src/server/repo/tasks.ts) + DEC-020 (upload validation/caps). Route file
// exports a named Hono sub-app; only src/index.ts mounts it (DEC-012).
//
// KNOWN RUNTIME DEPENDENCY: task_assignment.response_json/file_id live in
// src/db/schema.ts on main but their D1 migration is owned by in-flight
// w3-a (DEC-017) — this module creates NO migration. The form/upload
// completion actions below will fail loudly at runtime (SQL error) until
// that migration lands; this is accepted/expected for the same wave.

import { Hono, type Context } from "hono";
import type { AppEnv, AuthInfo } from "../../server/env";
import { speakerGate, PortalLayout, type PortalBrandingChrome } from "./shared";
import { csrfForm } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { makeFileStore } from "../../server/context";
import { newId } from "../../domain/ids";
import { updateAssignmentStatus } from "../../server/repo/tasks";
import { insertFile } from "../../server/repo/files";
import {
  assertOwnAssignment,
  getAssignmentScope,
  getMyResources,
  getMyTaskAssignments,
  getPortalData,
  getResourceDownloadScope,
  saveTaskFileCompletion,
  saveTaskFormResponse,
  type PortalAssignmentScope,
  type PortalTaskAssignment,
} from "../../server/repo/portal";
import { listFields, type FormFieldRow } from "../../server/repo/forms";
import { validateAnswers } from "../../forms/validate";
import { isVisible } from "../../forms/visibility";
import type { AnswerMap } from "../../forms/types";
import { FormFieldsSection, FieldRulesScript, fieldInputName } from "../../views/form-render";
import { isImageContentType, isValidFileKind, sanitizeFilenameForKey, validateUpload } from "../../domain/files";
import {
  parseCookies,
  newCsrfToken,
  buildCsrfCookie,
  isSecureRequest,
  CSRF_COOKIE_NAME,
} from "../../auth/cookies";
import { DEC_016, DEC_020, DEC_023, DEC_028, DEC_029 } from "../../decisions";

export const portalTasksRoutes = new Hono<AppEnv>();

// touch DEC constants so the dependency is compile-checked (field guide convention)
void DEC_016;
void DEC_020;
void DEC_023;
void DEC_028;
void DEC_029;

portalTasksRoutes.use("*", speakerGate);

function requireAuth(c: Context<AppEnv>): AuthInfo {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth;
}

function ensureCsrfCookie(c: Context<AppEnv>): { token: string; setCookieIfNew: string | null } {
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const existing = cookies[CSRF_COOKIE_NAME];
  if (existing) return { token: existing, setCookieIfNew: null };
  const token = newCsrfToken();
  return {
    token,
    setCookieIfNew: buildCsrfCookie(token, { secure: isSecureRequest(c.req.url) }),
  };
}

// -----------------------------------------------------------------------
// Pages
// -----------------------------------------------------------------------

function TaskRow(props: { assignment: PortalTaskAssignment; csrfToken: string; error?: string }) {
  const { assignment: t, csrfToken, error } = props;
  return (
    <li>
      <strong>{t.title}</strong>
      {t.required ? <em> (required)</em> : null}
      {t.dueDate ? <span> — due {new Date(t.dueDate).toISOString().slice(0, 10)}</span> : null}
      {" — "}
      {t.status === "complete" ? "Completed" : "Pending"}
      {t.description ? <p>{t.description}</p> : null}
      {error ? (
        <p role="alert" class="field-error">
          {error}
        </p>
      ) : null}
      {t.status === "complete" ? null : (
        <>
          {t.kind === "general" ? (
            <form method="post" action={`/portal/tasks/${t.id}/complete`}>
              <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
              <button type="submit">Mark complete</button>
            </form>
          ) : null}
          {t.kind === "file_request" ? (
            <form method="post" action={`/portal/tasks/${t.id}/upload`} enctype="multipart/form-data">
              <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
              <p>
                Accepted types: pdf, ppt, pptx, key, odp, zip (25 MB max); png, jpg, jpeg, webp, gif (8 MB max); txt,
                md (25 MB max).
              </p>
              <input type="file" name="file" required />
              <button type="submit">Upload</button>
            </form>
          ) : null}
        </>
      )}
    </li>
  );
}

function TaskFormPage(props: {
  branding: PortalBrandingChrome;
  assignment: PortalTaskAssignment;
  fields: FormFieldRow[];
  answers: AnswerMap;
  csrfToken: string;
  errors?: Record<string, string>;
}) {
  const { branding, assignment, fields, answers, csrfToken, errors } = props;
  return (
    <PortalLayout branding={branding} csrfToken={csrfToken}>
      <a href="/portal/tasks">&larr; Back to My Tasks</a>
      <h2>{assignment.title}</h2>
      {assignment.description ? <p>{assignment.description}</p> : null}
      <form method="post" action={`/portal/tasks/${assignment.id}/form`}>
        <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
        <FormFieldsSection fields={fields} section="session" answers={answers} errors={errors} isVisible={isVisible} />
        <FormFieldsSection fields={fields} section="speaker" answers={answers} errors={errors} isVisible={isVisible} />
        <button type="submit">Submit</button>
      </form>
      <FieldRulesScript fields={fields} />
    </PortalLayout>
  );
}

function TasksPage(props: {
  branding: PortalBrandingChrome;
  assignments: PortalTaskAssignment[];
  csrfToken: string;
  formLinkFor: (a: PortalTaskAssignment) => string | null;
  errorFor?: (assignmentId: string) => string | undefined;
}) {
  const { branding, assignments, csrfToken, formLinkFor, errorFor } = props;
  return (
    <PortalLayout branding={branding} csrfToken={csrfToken}>
      <a href="/portal">&larr; Back to Dashboard</a>
      <h2>My Tasks</h2>
      {assignments.length === 0 ? (
        <p>No tasks assigned yet.</p>
      ) : (
        <ul>
          {assignments.map((t) =>
            t.kind === "form" && t.status !== "complete" ? (
              <li>
                <strong>{t.title}</strong>
                {t.required ? <em> (required)</em> : null}
                {t.dueDate ? <span> — due {new Date(t.dueDate).toISOString().slice(0, 10)}</span> : null}
                {" — Pending — "}
                <a href={formLinkFor(t) ?? "#"}>Fill out form</a>
              </li>
            ) : (
              <TaskRow assignment={t} csrfToken={csrfToken} error={errorFor?.(t.id)} />
            ),
          )}
        </ul>
      )}
    </PortalLayout>
  );
}

function ResourcesPage(props: {
  branding: PortalBrandingChrome;
  groups: Awaited<ReturnType<typeof getMyResources>>;
  csrfToken: string;
}) {
  const { branding, groups, csrfToken } = props;
  return (
    <PortalLayout branding={branding} csrfToken={csrfToken}>
      <a href="/portal">&larr; Back to Dashboard</a>
      <h2>Resources</h2>
      {groups.length === 0 ? (
        <p>No resources yet.</p>
      ) : (
        groups.map((group) => (
          <section aria-label={group.eventName}>
            <h3>{group.eventName}</h3>
            <ul>
              {group.resources.map((r) => (
                <li>
                  <strong>{r.title}</strong>
                  {r.kind === "wiki" ? (
                    (r.content ?? "").split(/\n{2,}/).map((para) => <p>{para}</p>)
                  ) : (
                    <a href={`/portal/resources/${r.id}/download`}>Download</a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </PortalLayout>
  );
}

// -----------------------------------------------------------------------
// Routes: tasks
// -----------------------------------------------------------------------

portalTasksRoutes.get("/tasks", async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");

  const [data, assignments] = await Promise.all([
    getPortalData(c.var.db, contactId, auth.orgId),
    getMyTaskAssignments(c.var.db, contactId, auth.orgId),
  ]);
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });

  return c.html(
    <TasksPage
      branding={data.branding}
      assignments={assignments}
      csrfToken={csrfToken}
      formLinkFor={(a) => `/portal/tasks/${a.id}/form`}
    />,
  );
});

portalTasksRoutes.get("/tasks/:assignmentId/form", async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");
  const assignmentId = c.req.param("assignmentId");

  const scope = await getAssignmentScope(c.var.db, assignmentId);
  if (!scope || scope.orgId !== auth.orgId) throw new ApiError("not_found", "Task assignment not found");
  assertOwnAssignmentOr403(scope, contactId);
  if (scope.kind !== "form" || !scope.formId) throw new ApiError("invalid", "This task is not a form task");

  const [data, assignments, fields] = await Promise.all([
    getPortalData(c.var.db, contactId, auth.orgId),
    getMyTaskAssignments(c.var.db, contactId, auth.orgId),
    listFields(c.var.db, scope.formId),
  ]);
  const assignment = assignments.find((a) => a.id === assignmentId);
  if (!assignment) throw new ApiError("not_found", "Task assignment not found");

  const answers: AnswerMap = assignment.responseJson ? JSON.parse(assignment.responseJson) : {};
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });

  return c.html(
    <TaskFormPage branding={data.branding} assignment={assignment} fields={fields} answers={answers} csrfToken={csrfToken} />,
  );
});

function assertOwnAssignmentOr403(scope: PortalAssignmentScope, contactId: string): void {
  try {
    assertOwnAssignment(scope, contactId);
  } catch {
    throw new ApiError("forbidden", "This task assignment does not belong to you");
  }
}

portalTasksRoutes.post("/tasks/:assignmentId/complete", csrfForm, async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");
  const assignmentId = c.req.param("assignmentId");

  const scope = await getAssignmentScope(c.var.db, assignmentId);
  if (!scope || scope.orgId !== auth.orgId) throw new ApiError("not_found", "Task assignment not found");
  assertOwnAssignmentOr403(scope, contactId);
  if (scope.kind !== "general") throw new ApiError("invalid", "Only 'general' tasks complete this way");

  await updateAssignmentStatus(c.var.db, assignmentId, "complete", auth.userId, new Date());
  return c.redirect("/portal/tasks", 302);
});

portalTasksRoutes.post("/tasks/:assignmentId/form", csrfForm, async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");
  const assignmentId = c.req.param("assignmentId");

  const scope = await getAssignmentScope(c.var.db, assignmentId);
  if (!scope || scope.orgId !== auth.orgId) throw new ApiError("not_found", "Task assignment not found");
  assertOwnAssignmentOr403(scope, contactId);
  if (scope.kind !== "form" || !scope.formId) throw new ApiError("invalid", "This task is not a form task");

  const fields = await listFields(c.var.db, scope.formId);
  const body = (await c.req.parseBody({ all: true })) as Record<string, unknown>;
  const answers: AnswerMap = {};
  for (const field of fields) {
    const name = fieldInputName(field.id);
    if (field.kind === "checkbox") {
      answers[field.id] = body[name] !== undefined;
      continue;
    }
    const raw = body[name];
    if (raw === undefined) continue;
    answers[field.id] = typeof raw === "string" ? raw : String(raw);
  }

  const validation = validateAnswers(fields, answers);
  if (!validation.ok) {
    const data = await getPortalData(c.var.db, contactId, auth.orgId);
    const assignments = await getMyTaskAssignments(c.var.db, contactId, auth.orgId);
    const assignment = assignments.find((a) => a.id === assignmentId);
    if (!assignment) throw new ApiError("not_found", "Task assignment not found");
    const { token: csrfToken } = ensureCsrfCookie(c);
    return c.html(
      <TaskFormPage
        branding={data.branding}
        assignment={assignment}
        fields={fields}
        answers={answers}
        csrfToken={csrfToken}
        errors={validation.errors}
      />,
      400,
    );
  }

  await saveTaskFormResponse(c.var.db, assignmentId, JSON.stringify(validation.cleaned));
  await updateAssignmentStatus(c.var.db, assignmentId, "complete", auth.userId, new Date());
  return c.redirect("/portal/tasks", 302);
});

portalTasksRoutes.post("/tasks/:assignmentId/upload", csrfForm, async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");
  const assignmentId = c.req.param("assignmentId");

  const scope = await getAssignmentScope(c.var.db, assignmentId);
  if (!scope || scope.orgId !== auth.orgId) throw new ApiError("not_found", "Task assignment not found");
  assertOwnAssignmentOr403(scope, contactId);
  if (scope.kind !== "file_request") throw new ApiError("invalid", "Only 'file_request' tasks complete this way");

  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) {
    throw new ApiError("invalid", "file is required", { file: "Required" });
  }

  // task_assignment uploads always land in the 'handout' file kind
  // (DEC-029): submission_id null, uploaded_by_contact_id set.
  const kind = "handout";
  if (!isValidFileKind(kind)) throw new Error("unreachable: 'handout' is a valid file kind");
  const validation = validateUpload({ filename: file.name, sizeBytes: file.size, kind });
  if (!validation.ok) {
    throw new ApiError("invalid", validation.message, validation.fields);
  }

  const sanitized = sanitizeFilenameForKey(file.name);
  const r2Key = `task/${assignmentId}/${newId()}-${sanitized}`;
  const store = makeFileStore(c.env.FILES);
  const buf = await file.arrayBuffer();
  await store.put(r2Key, buf, validation.servedContentType);

  const fileId = await insertFile(c.var.db, {
    submissionId: null,
    kind,
    filename: file.name,
    r2Key,
    sizeBytes: file.size,
    contentType: validation.servedContentType,
    previousFileId: null,
    uploadedByContactId: contactId,
  });

  await saveTaskFileCompletion(c.var.db, assignmentId, fileId);
  await updateAssignmentStatus(c.var.db, assignmentId, "complete", auth.userId, new Date());
  return c.redirect("/portal/tasks", 302);
});

// -----------------------------------------------------------------------
// Routes: resources
// -----------------------------------------------------------------------

portalTasksRoutes.get("/resources", async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");

  const [data, groups] = await Promise.all([
    getPortalData(c.var.db, contactId, auth.orgId),
    getMyResources(c.var.db, contactId, auth.orgId),
  ]);
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
  return c.html(<ResourcesPage branding={data.branding} groups={groups} csrfToken={csrfToken} />);
});

portalTasksRoutes.get("/resources/:resourceId/download", async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");
  const resourceId = c.req.param("resourceId");

  const scope = await getResourceDownloadScope(c.var.db, resourceId, contactId, auth.orgId);
  if (!scope) throw new ApiError("not_found", "Resource not found");

  const store = makeFileStore(c.env.FILES);
  const obj = await store.get(scope.r2Key);
  if (!obj) throw new ApiError("not_found", "File contents not found");

  const contentType = obj.contentType ?? scope.contentType;
  const headers: Record<string, string> = { "Content-Type": contentType };
  if (!isImageContentType(contentType)) {
    const safeName = scope.filename.replace(/[\r\n"]/g, "");
    headers["Content-Disposition"] = `attachment; filename="${safeName}"`;
  }
  return c.body(obj.body, 200, headers);
});
