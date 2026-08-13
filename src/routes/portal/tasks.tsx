// Portal tasks + resources (J7 depth), per DEC-029 + DEC-028 (shared
// gate/layout) + DEC-023 (assignment status semantics owned by
// src/server/repo/tasks.ts) + DEC-020 (upload validation/caps). Route file
// exports a named Hono sub-app; only src/index.ts mounts it (DEC-012).
//
// DEC-240 supersedes DEC-029's file-upload rule specifically: the upload
// handler below no longer hardcodes kind='handout'/submission_id=null — see
// its own comment for the current (deterministic-linkage + chaining) rule.
// DEC-029 still governs everything else in this module (form/general/
// resources).
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
import {
  getFileVersionNumber,
  insertFile,
  insertFileComment,
  listFileChainVersions,
  listFileComments,
  resolveTaskFileChainLatest,
  type FileCommentRow,
} from "../../server/repo/files";
import {
  assertOwnAssignment,
  getAssignmentScope,
  getMyResources,
  getMyTaskAssignments,
  getPortalData,
  getResourceDownloadScope,
  resolveDeliverableSubmissionId,
  saveTaskFileCompletion,
  saveTaskFormResponse,
  type PortalAssignmentScope,
  type PortalTaskAssignment,
} from "../../server/repo/portal";
import { listFields, type FormFieldRow } from "../../server/repo/forms";
import { validateAnswers } from "../../forms/validate";
import { makeVisibilityPredicate } from "../../forms/visibility";
import type { AnswerMap } from "../../forms/types";
import { FormFieldsSection, FieldRulesScript, fieldInputName } from "../../views/form-render";
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  isImageContentType,
  isValidFileKind,
  sanitizeFilenameForKey,
  uploadHintText,
  validateUpload,
} from "../../domain/files";
import {
  parseCookies,
  newCsrfToken,
  buildCsrfCookie,
  isSecureRequest,
  CSRF_COOKIE_NAME,
} from "../../auth/cookies";
import { DEC_016, DEC_020, DEC_023, DEC_028, DEC_029, DEC_240, DEC_242, DEC_244, DEC_605, DEC_657, DEC_696 } from "../../decisions";
import { formatCalendarDate, formatEventDate, formatEventDateTime } from "../../lib/event-time";
import { effectiveAssignmentDueDate } from "../../domain/task-due";
import { renderMarkdown } from "../../lib/markdown";

export const portalTasksRoutes = new Hono<AppEnv>();

// touch DEC constants so the dependency is compile-checked (field guide convention)
void DEC_016;
void DEC_020;
void DEC_023;
void DEC_028;
void DEC_029;
void DEC_240;
void DEC_242;
void DEC_244;
void DEC_605;
void DEC_657;
void DEC_696;

// DEC-244: comment body cap on the portal reply endpoint (matches no
// existing forms/validate.ts constant since file comments aren't a form
// field — long-text form answers cap at 20000, but a deliverable reply
// thread is capped much tighter).
export const MAX_COMMENT_BODY_LENGTH = 4000;

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

// DEC-242: display data for a completed file_request assignment — the
// current file's name/version and its comment thread, loaded up front on
// the /portal/tasks GET so TaskRow stays a pure render.
export interface FileRequestExtras {
  filename: string;
  version: number;
  uploadedAt: number;
  comments: FileCommentRow[];
  timezone: string;
  // DEC-605: the FULL version chain, oldest to newest, so the completed-task
  // card doesn't read as an overwrite from the only side (the speaker) that
  // ever sees this row — a re-upload is a new version, not an erasure.
  versions: FileVersionRow[];
}

export interface FileVersionRow {
  id: string;
  version: number;
  filename: string;
  uploadedAt: number;
  isCurrent: boolean;
}

// DEC-605: renders the full chain oldest-first, one row per version, each
// with its own download link (GET .../file/:fileId, walked back to this
// assignment's chain root before streaming) — the flat "current file" block
// above stays untouched (still resolveTaskFileChainLatest via the DEC-244
// route) so an older test asserting that block's exact shape keeps passing;
// this is additive.
function VersionHistory(props: { assignmentId: string; versions: FileVersionRow[]; timezone: string }) {
  const { assignmentId, versions, timezone } = props;
  return (
    <section aria-label="Version history">
      <h4>Version history</h4>
      <ul class="chq-portal-versions">
        {versions.map((v) => (
          <li class="chq-portal-version-row">
            <span class="chq-portal-version-num">v{v.version}</span>
            <a href={`/portal/tasks/${assignmentId}/file/${v.id}`}>{v.filename}</a>
            <span class="chq-portal-detail">{formatEventDateTime(v.uploadedAt, timezone)}</span>
            {v.isCurrent ? <span class="chq-flag chq-portal-flag-done">Current</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CommentThread(props: { assignmentId: string; comments: FileCommentRow[]; csrfToken: string; timezone: string }) {
  const { assignmentId, comments, csrfToken, timezone } = props;
  return (
    <section aria-label="Comments">
      <h4>Comments</h4>
      {comments.length === 0 ? (
        <p>No comments yet.</p>
      ) : (
        <ul>
          {comments.map((cm) => (
            <li>
              <strong>{cm.authorName}</strong>
              {" — "}
              {formatEventDateTime(cm.createdAt, timezone)}
              <p>{cm.body}</p>
            </li>
          ))}
        </ul>
      )}
      <form method="post" action={`/portal/tasks/${assignmentId}/comments`}>
        <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
        <textarea name="body" class="chq-textarea" required></textarea>
        <button type="submit" class="chq-btn chq-btn-secondary">Reply</button>
      </form>
    </section>
  );
}

function TaskRow(props: {
  assignment: PortalTaskAssignment;
  csrfToken: string;
  error?: string;
  fileExtras?: FileRequestExtras;
}) {
  const { assignment: t, csrfToken, error, fileExtras } = props;
  // DEC-826: a task cannot be late before it was assigned — print the
  // effective due date, the same one the organizer's grid and the
  // reminder email already use.
  const effectiveDue = effectiveAssignmentDueDate(t.dueDate, t.assignedAt);
  return (
    <div class="chq-portal-row" id={`task-${t.id}`}>
      <div class="chq-portal-row-head">
        <span class="chq-portal-row-title">
          {t.title}
          {t.required ? <em> (required)</em> : null}
        </span>
        {/* Behaviour frozen (DEC-366): the underlying status stays
            pending|complete — only the on-screen wording grows a
            .chq-flag, never a red swatch (DEC-367). */}
        <span class={t.status === "complete" ? "chq-flag chq-portal-flag-done" : "chq-flag"}>
          {t.status === "complete" ? "Completed" : "Pending"}
        </span>
      </div>
      {effectiveDue ? <span class="chq-portal-due">Due {formatCalendarDate(effectiveDue)}</span> : null}
      {t.description ? <p class="chq-portal-detail">{t.description}</p> : null}
      {error ? (
        <p role="alert" class="field-error">
          {error}
        </p>
      ) : null}
      {t.status === "complete" ? null : (
        <div class="chq-portal-actions">
          {t.kind === "general" ? (
            <form method="post" action={`/portal/tasks/${t.id}/complete`}>
              <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
              <button type="submit" class="chq-btn chq-btn-primary">Mark complete</button>
            </form>
          ) : null}
          {t.kind === "file_request" ? (
            <form method="post" action={`/portal/tasks/${t.id}/upload`} enctype="multipart/form-data">
              <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
              <p class="chq-portal-detail">{uploadHintText()}</p>
              <input
                type="file"
                name="file"
                required
                accept={ALLOWED_UPLOAD_EXTENSIONS.map((e) => `.${e}`).join(",")}
              />
              <button type="submit" class="chq-btn chq-btn-primary">Upload</button>
            </form>
          ) : null}
        </div>
      )}
      {/* DEC-244 (implements DEC-242): a completed file_request assignment
          shows the current CHAIN-LATEST file (via the dedicated portal
          download route, never the organizer /files route), a replace-file
          form re-posting to the same upload endpoint (chains
          previous_file_id per DEC-240), and the file's comment thread — a
          speaker must be able to see their own upload without an organizer
          flipping status. */}
      {t.status === "complete" && t.kind === "file_request" && fileExtras ? (
        <section aria-label="Uploaded file" class="chq-card">
          <p>
            <a href={`/portal/tasks/${t.id}/file`}>{fileExtras.filename}</a> (version {fileExtras.version}, uploaded{" "}
            {formatEventDateTime(fileExtras.uploadedAt, fileExtras.timezone)})
          </p>
          <form method="post" action={`/portal/tasks/${t.id}/upload`} enctype="multipart/form-data">
            <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
            <p class="chq-portal-detail">{uploadHintText()}</p>
            <input
              type="file"
              name="file"
              required
              accept={ALLOWED_UPLOAD_EXTENSIONS.map((e) => `.${e}`).join(",")}
            />
            <button type="submit" class="chq-btn chq-btn-secondary">Replace file</button>
          </form>
          <VersionHistory assignmentId={t.id} versions={fileExtras.versions} timezone={fileExtras.timezone} />
          <CommentThread assignmentId={t.id} comments={fileExtras.comments} csrfToken={csrfToken} timezone={fileExtras.timezone} />
        </section>
      ) : null}
    </div>
  );
}

function TaskFormPage(props: {
  branding: PortalBrandingChrome;
  assignment: PortalTaskAssignment;
  fields: FormFieldRow[];
  answers: AnswerMap;
  csrfToken: string;
  errors?: Record<string, string>;
  speakerName: string;
}) {
  const { branding, assignment, fields, answers, csrfToken, errors, speakerName } = props;
  // DEC-532: one predicate built from the FULL field list (a session field
  // can gate a speaker field), shared by both sections below.
  const isVisible = makeVisibilityPredicate(fields, answers);
  return (
    <PortalLayout branding={branding} csrfToken={csrfToken} speakerName={speakerName}>
      <a href="/portal/tasks" class="chq-portal-back">&larr; Back to My Tasks</a>
      <h2 class="chq-portal-hero">{assignment.title}</h2>
      {assignment.description ? <p class="chq-portal-sub">{assignment.description}</p> : null}
      <form method="post" action={`/portal/tasks/${assignment.id}/form`}>
        <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
        <FormFieldsSection fields={fields} section="session" answers={answers} errors={errors} isVisible={isVisible} />
        <FormFieldsSection fields={fields} section="speaker" answers={answers} errors={errors} isVisible={isVisible} />
        <button type="submit" class="chq-btn chq-btn-primary">Submit</button>
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
  fileExtrasFor?: (assignmentId: string) => FileRequestExtras | undefined;
  speakerName: string;
}) {
  const { branding, assignments, csrfToken, formLinkFor, errorFor, fileExtrasFor, speakerName } = props;
  const doneCount = assignments.filter((a) => a.status === "complete").length;
  return (
    <PortalLayout branding={branding} csrfToken={csrfToken} speakerName={speakerName}>
      <a href="/portal" class="chq-portal-back">&larr; Back to Dashboard</a>
      <h2 class="chq-portal-hero">My Tasks</h2>
      {assignments.length > 0 ? (
        <div class="chq-portal-progress">
          <span class="chq-portal-progress-label">
            {doneCount} of {assignments.length} complete
          </span>
          <div class="chq-bar">
            <div
              class="chq-bar-fill"
              style={`width: ${Math.round((doneCount / assignments.length) * 100)}%`}
            ></div>
          </div>
        </div>
      ) : null}
      {assignments.length === 0 ? (
        <p>No tasks assigned yet.</p>
      ) : (
        assignments.map((t) =>
          t.kind === "form" && t.status !== "complete" ? (
            <div class="chq-portal-row" id={`task-${t.id}`}>
              <div class="chq-portal-row-head">
                <span class="chq-portal-row-title">
                  {t.title}
                  {t.required ? <em> (required)</em> : null}
                </span>
                <span class="chq-flag">Pending</span>
              </div>
              {effectiveAssignmentDueDate(t.dueDate, t.assignedAt) ? (
                <span class="chq-portal-due">
                  Due {formatCalendarDate(effectiveAssignmentDueDate(t.dueDate, t.assignedAt)!)}
                </span>
              ) : null}
              <div class="chq-portal-actions">
                <a href={formLinkFor(t) ?? "#"} class="chq-btn chq-btn-primary">Fill out form</a>
              </div>
            </div>
          ) : (
            <TaskRow assignment={t} csrfToken={csrfToken} error={errorFor?.(t.id)} fileExtras={fileExtrasFor?.(t.id)} />
          ),
        )
      )}
    </PortalLayout>
  );
}

function ResourcesPage(props: {
  branding: PortalBrandingChrome;
  groups: Awaited<ReturnType<typeof getMyResources>>;
  csrfToken: string;
  speakerName: string;
}) {
  const { branding, groups, csrfToken, speakerName } = props;
  return (
    <PortalLayout branding={branding} csrfToken={csrfToken} speakerName={speakerName}>
      <a href="/portal" class="chq-portal-back">&larr; Back to Dashboard</a>
      <h2 class="chq-portal-hero">Resources</h2>
      {groups.length === 0 ? (
        <p>No resources yet.</p>
      ) : (
        groups.map((group) => (
          <section aria-label={group.eventName} class="chq-section">
            <div class="chq-section-label">{group.eventName}</div>
            {group.resources.map((r) => (
              <div class="chq-portal-row">
                <span class="chq-portal-row-title">{r.title}</span>
                {r.kind === "wiki" ? (
                  <div class="chq-portal-detail" dangerouslySetInnerHTML={{ __html: renderMarkdown(r.content ?? "") }} />
                ) : (
                  <div class="chq-portal-actions">
                    <a href={`/portal/resources/${r.id}/download`} class="chq-btn chq-btn-secondary">Download</a>
                  </div>
                )}
              </div>
            ))}
          </section>
        ))
      )}
    </PortalLayout>
  );
}

// -----------------------------------------------------------------------
// Routes: tasks
// -----------------------------------------------------------------------

// Shared loader for the /tasks list, factored out so a failed upload can
// re-render the SAME page inline (with an on-screen field error attached to
// the offending row) instead of the request falling through to the global
// JSON error handler — see the /upload route below for why this exists.
async function loadTasksPageData(c: Context<AppEnv>, contactId: string, orgId: string) {
  const [data, assignments] = await Promise.all([
    getPortalData(c.var.db, contactId, orgId),
    getMyTaskAssignments(c.var.db, contactId, orgId),
  ]);

  // DEC-244 (implements DEC-242): for every completed file_request
  // assignment, resolve the CHAIN-LATEST file (following previous_file_id
  // forward from the assignment's stored file id, so an organizer-side
  // replace via the submission files route is honored) and load its
  // display name/uploaded time/comment thread up front so TaskRow stays a
  // pure render — this org-scoped /tasks list already only ever contains
  // the caller's own assignments, so no further per-file authz is needed
  // here (ownership flows from the assignment, not the file row).
  const fileExtrasByAssignmentId = new Map<string, FileRequestExtras>();
  for (const a of assignments) {
    if (a.kind !== "file_request" || a.status !== "complete" || !a.fileId) continue;
    const latest = await resolveTaskFileChainLatest(c.var.db, a.fileId);
    // DEC-605: full chain oldest-first, one row per version — reuses
    // getFileVersionNumber (the canonical "1-indexed, oldest=v1" rule) per
    // id rather than re-deriving numbering from array position, so this
    // list's numbers can never drift from the single-file block above's
    // "version N" text.
    const [version, commentsPage, chain] = await Promise.all([
      getFileVersionNumber(c.var.db, latest.id),
      listFileComments(c.var.db, latest.id),
      listFileChainVersions(c.var.db, a.fileId),
    ]);
    const versions: FileVersionRow[] = await Promise.all(
      chain.map(async (row) => ({
        id: row.id,
        version: await getFileVersionNumber(c.var.db, row.id),
        filename: row.filename,
        uploadedAt: row.createdAt,
        isCurrent: row.id === latest.id,
      })),
    );
    fileExtrasByAssignmentId.set(a.id, {
      filename: latest.filename,
      version,
      uploadedAt: latest.createdAt,
      comments: commentsPage.items,
      timezone: a.timezone,
      versions,
    });
  }

  return { data, assignments, fileExtrasByAssignmentId };
}

portalTasksRoutes.get("/tasks", async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");

  const { data, assignments, fileExtrasByAssignmentId } = await loadTasksPageData(c, contactId, auth.orgId);

  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });

  return c.html(
    <TasksPage
      branding={data.branding}
      assignments={assignments}
      csrfToken={csrfToken}
      formLinkFor={(a) => `/portal/tasks/${a.id}/form`}
      fileExtrasFor={(id) => fileExtrasByAssignmentId.get(id)}
      speakerName={data.contactName}
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
    <TaskFormPage
      branding={data.branding}
      assignment={assignment}
      fields={fields}
      answers={answers}
      csrfToken={csrfToken}
      speakerName={data.contactName}
    />,
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
        speakerName={data.contactName}
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

  // Disallowed extension/MIME or an over-cap size (SPEC §6) must produce a
  // clear ON-SCREEN error, same page, same URL — NOT the raw
  // {"error":{...}} JSON blob the global onError handler renders for a
  // full-page form POST (a real regression found live in-browser: a
  // full-page navigation landing on unstyled JSON is not a "clear
  // on-screen error" by any reading of that requirement). Mirrors the
  // existing /tasks/:id/form validation-failure pattern: re-render
  // TasksPage inline (400, not a redirect) with the field error attached
  // to the offending row via errorFor, instead of throwing.
  async function reRenderWithError(message: string): Promise<Response> {
    const { data, assignments, fileExtrasByAssignmentId } = await loadTasksPageData(c, contactId as string, auth.orgId);
    const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
    if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
    return c.html(
      <TasksPage
        branding={data.branding}
        assignments={assignments}
        csrfToken={csrfToken}
        formLinkFor={(a) => `/portal/tasks/${a.id}/form`}
        fileExtrasFor={(id) => fileExtrasByAssignmentId.get(id)}
        errorFor={(id) => (id === assignmentId ? message : undefined)}
        speakerName={data.contactName}
      />,
      400,
    );
  }

  if (!(file instanceof File)) {
    return reRenderWithError("file is required");
  }

  // DEC-240 (supersedes DEC-029's submission_id-null/'handout'-only rule),
  // amended by DEC-549: a task upload is a session deliverable ONLY when the
  // task opts in by declaring deliverable_kind. When scope.deliverableKind
  // is set, behavior is exactly DEC-240's: kind = that value, and the
  // upload links to the uploader's own submission in the task's event
  // (resolveDeliverableSubmissionId), chaining previous_file_id on
  // re-upload instead of minting an unlinked file each time. When it is
  // null, the task is a plain 'handout' request with NO submission link —
  // submissionId is null and resolveDeliverableSubmissionId is not called,
  // so the file never joins a submission's deliverable-authz population.
  let kind: string;
  let submissionId: string | null;
  if (scope.deliverableKind != null) {
    kind = scope.deliverableKind;
    submissionId = await resolveDeliverableSubmissionId(c.var.db, contactId, scope.eventId);
  } else {
    kind = "handout";
    submissionId = null;
  }
  if (!isValidFileKind(kind)) throw new Error(`invalid task.deliverable_kind persisted: ${kind}`);
  const validation = validateUpload({ filename: file.name, sizeBytes: file.size, kind });
  if (!validation.ok) {
    return reRenderWithError(validation.message);
  }

  const sanitized = sanitizeFilenameForKey(file.name);
  const r2Key = `task/${assignmentId}/${newId()}-${sanitized}`;
  const store = makeFileStore(c.env.FILES);
  const buf = await file.arrayBuffer();
  await store.put(r2Key, buf, validation.servedContentType);

  const fileId = await insertFile(c.var.db, {
    submissionId,
    kind,
    filename: file.name,
    r2Key,
    sizeBytes: file.size,
    contentType: validation.servedContentType,
    previousFileId: scope.fileId,
    uploadedByContactId: contactId,
  });

  await saveTaskFileCompletion(c.var.db, assignmentId, fileId);
  await updateAssignmentStatus(c.var.db, assignmentId, "complete", auth.userId, new Date());
  return c.redirect("/portal/tasks", 302);
});

// DEC-244 (implements DEC-242): reply on a completed file_request
// assignment's file comment thread, anchored to the CHAIN-LATEST file id
// (same anchor rule as the organizer DeliverableDetail view, which shows
// comments[latest.id]) — not the assignment's raw stored file id, so a
// reply always lands on the thread the current version's viewers see.
// Authorized strictly through getAssignmentScope + assertOwnAssignmentOr403
// (existence-hiding: an unknown/foreign assignmentId 404s/403s before any
// file is ever looked up) — identical to the upload route's authz.
portalTasksRoutes.post("/tasks/:assignmentId/comments", csrfForm, async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");
  const assignmentId = c.req.param("assignmentId");

  const scope = await getAssignmentScope(c.var.db, assignmentId);
  if (!scope || scope.orgId !== auth.orgId) throw new ApiError("not_found", "Task assignment not found");
  assertOwnAssignmentOr403(scope, contactId);
  if (scope.kind !== "file_request" || !scope.fileId) {
    throw new ApiError("invalid", "This task has no uploaded file to comment on");
  }

  const body = await c.req.parseBody();
  const raw = body["body"];
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) throw new ApiError("invalid", "body is required", { body: "Required" });
  if (text.length > MAX_COMMENT_BODY_LENGTH) {
    throw new ApiError("invalid", `body must be ${MAX_COMMENT_BODY_LENGTH} characters or fewer`, {
      body: "Too long",
    });
  }

  const latest = await resolveTaskFileChainLatest(c.var.db, scope.fileId);
  await insertFileComment(c.var.db, {
    fileId: latest.id,
    body: text,
    authorUserId: auth.userId,
    authorContactId: contactId,
  });
  return c.redirect("/portal/tasks", 302);
});

// DEC-244: streams the CHAIN-LATEST version of a completed file_request
// assignment's deliverable — authz identical to the upload route
// (getAssignmentScope + assertOwnAssignmentOr403 + org scope), deliberately
// NOT the organizer /files route, so a speaker's own portal session is
// self-sufficient for downloading their own uploads.
portalTasksRoutes.get("/tasks/:assignmentId/file", async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");
  const assignmentId = c.req.param("assignmentId");

  const scope = await getAssignmentScope(c.var.db, assignmentId);
  if (!scope || scope.orgId !== auth.orgId) throw new ApiError("not_found", "Task assignment not found");
  assertOwnAssignmentOr403(scope, contactId);
  if (scope.kind !== "file_request" || !scope.fileId) {
    throw new ApiError("not_found", "This task has no uploaded file");
  }

  const latest = await resolveTaskFileChainLatest(c.var.db, scope.fileId);
  const store = makeFileStore(c.env.FILES);
  const obj = await store.get(latest.r2Key);
  if (!obj) throw new ApiError("not_found", "File contents not found");

  const safeName = latest.filename.replace(/[\r\n"]/g, "");
  return c.body(obj.body, 200, {
    "Content-Type": obj.contentType ?? latest.contentType,
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `attachment; filename="${safeName}"`,
  });
});

// DEC-605: streams ANY version in a completed file_request assignment's
// chain, not just the chain-latest — same assignment-ownership check as the
// /file route above, then asserts the requested :fileId actually walks back
// to THIS assignment's chain root before streaming. An id in the URL is
// never evidence of ownership by itself: listFileChainVersions is called
// against the assignment's OWN stored fileId (never the untrusted URL
// param), and the URL param is only ever used as a membership lookup key
// against that trusted chain — so a fileId belonging to a different
// assignment/chain 404s (existence-hiding), never a 403 that would confirm
// the id is real.
portalTasksRoutes.get("/tasks/:assignmentId/file/:fileId", async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");
  const assignmentId = c.req.param("assignmentId");
  const requestedFileId = c.req.param("fileId");

  const scope = await getAssignmentScope(c.var.db, assignmentId);
  if (!scope || scope.orgId !== auth.orgId) throw new ApiError("not_found", "Task assignment not found");
  assertOwnAssignmentOr403(scope, contactId);
  if (scope.kind !== "file_request" || !scope.fileId) {
    throw new ApiError("not_found", "This task has no uploaded file");
  }

  const chain = await listFileChainVersions(c.var.db, scope.fileId);
  const target = chain.find((v) => v.id === requestedFileId);
  if (!target) throw new ApiError("not_found", "File not found in this task's version history");

  const store = makeFileStore(c.env.FILES);
  const obj = await store.get(target.r2Key);
  if (!obj) throw new ApiError("not_found", "File contents not found");

  const safeName = target.filename.replace(/[\r\n"]/g, "");
  return c.body(obj.body, 200, {
    "Content-Type": obj.contentType ?? target.contentType,
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `attachment; filename="${safeName}"`,
  });
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
  return c.html(
    <ResourcesPage branding={data.branding} groups={groups} csrfToken={csrfToken} speakerName={data.contactName} />,
  );
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
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  };
  if (!isImageContentType(contentType)) {
    const safeName = scope.filename.replace(/[\r\n"]/g, "");
    headers["Content-Disposition"] = `attachment; filename="${safeName}"`;
  }
  return c.body(obj.body, 200, headers);
});
