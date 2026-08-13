// Portal tasks — pure-render JSX components + their display-data types.
//
// Split out of the former single-file src/routes/portal/tasks.tsx (an
// 840-line merge-conflict hotspot). No behavior change: every component
// below is byte-for-byte what used to live in tasks.tsx. Route handlers
// (task actions, resource downloads) stay in ../tasks.tsx and ./resources.tsx
// and import these components.

import { PortalLayout, type PortalBrandingChrome } from "../shared";
import type { PortalTaskAssignment } from "../../../server/repo/portal";
import type { getMyResources } from "../../../server/repo/portal";
import type { FormFieldRow } from "../../../server/repo/forms";
import { makeVisibilityPredicate } from "../../../forms/visibility";
import type { AnswerMap } from "../../../forms/types";
import { FormFieldsSection, FieldRulesScript } from "../../../views/form-render";
import { ALLOWED_UPLOAD_EXTENSIONS, uploadHintText } from "../../../domain/files";
import { CSRF_COOKIE_NAME } from "../../../auth/cookies";
import { formatCalendarDate, formatEventDateTime } from "../../../lib/event-time";
import { effectiveAssignmentDueDate } from "../../../domain/task-due";
import { renderMarkdown } from "../../../lib/markdown";
import type { FileCommentRow } from "../../../server/repo/files";

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
export function VersionHistory(props: { assignmentId: string; versions: FileVersionRow[]; timezone: string }) {
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

export function CommentThread(props: { assignmentId: string; comments: FileCommentRow[]; csrfToken: string; timezone: string }) {
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

export function TaskRow(props: {
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

export function TaskFormPage(props: {
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

export function TasksPage(props: {
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

export function ResourcesPage(props: {
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
