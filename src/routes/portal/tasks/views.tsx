// Portal tasks — pure-render JSX components + their display-data types.
//
// Split out of the former single-file src/routes/portal/tasks.tsx (an
// 840-line merge-conflict hotspot). No behavior change: every component
// below is byte-for-byte what used to live in tasks.tsx. Route handlers
// (task actions, resource downloads) stay in ../tasks.tsx and ./resources.tsx
// and import these components.

import { PortalLayout, PortalBackLink, type PortalBrandingChrome } from "../shared";
import { PublicEmptyState } from "../../public/empty-state";
import type { DeliverableCandidate, PortalTaskAssignment } from "../../../server/repo/portal";
import type { getMyResources } from "../../../server/repo/portal";
import type { FormFieldRow } from "../../../server/repo/forms";
import { makeVisibilityPredicate } from "../../../forms/visibility";
import type { AnswerMap } from "../../../forms/types";
import { FormFieldsSection, FieldRulesScript } from "../../../views/form-render";
import { allowedUploadExtensions, isValidFileKind, MAX_COMMENT_BODY_LENGTH, uploadHintText } from "../../../domain/files";
import { CSRF_COOKIE_NAME } from "../../../auth/cookies";
import { formatCalendarDate, formatEventDateTime, formatEventDateTimeWithSeconds } from "../../../lib/event-time";
import { effectiveAssignmentDueDayLabel, isAssignmentOverdue } from "../../../domain/task-due";
import { renderMarkdown } from "../../../lib/markdown";
import type { FileCommentRow } from "../../../server/repo/files";
import { PROFILE_TASK_TITLE } from "../../../domain/acceptance";
import { DEC_576, DEC_967 } from "../../../decisions";

void DEC_576; // wave-110 amendment: TasksPage's dock carries the first incomplete task's own primary control
void DEC_967; // wave-106 amendment: the frame's "Later" secondary has no verb behind it — geometry only, never manufactured

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
// this is additive. DEC-158: these rows are SUCCESSIVE STATES OF ONE OBJECT
// (one assignment's own version chain), so the timestamp renders through
// formatEventDateTimeWithSeconds, not formatEventDateTime — two versions
// uploaded in the same minute must still read as distinguishable rows.
export function VersionHistory(props: { assignmentId: string; versions: FileVersionRow[]; timezone: string }) {
  const { assignmentId, versions, timezone } = props;
  return (
    <section aria-label="Version history">
      {/* G13 (frame 10--05, MAJOR): the section-label register (11px caps
          over a 2px rule), not a bare 16px h4 with margin 0. */}
      <h4 class="chq-portal-subsection-label">Version history</h4>
      <ul class="chq-portal-versions">
        {versions.map((v) => (
          <li class="chq-portal-version-row">
            <span class="chq-portal-version-num">v{v.version}</span>
            <a href={`/portal/tasks/${assignmentId}/file/${v.id}`}>{v.filename}</a>
            <span class="chq-portal-detail">{formatEventDateTimeWithSeconds(v.uploadedAt, timezone)}</span>
            {v.isCurrent ? <span class="chq-flag chq-portal-flag-done">Current</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

// DEC-244 amendment (wave 56): a refused reply (empty body / over the
// MAX_COMMENT_BODY_LENGTH cap) must fail the way the portal upload already
// fails — inline, on the same page, with the speaker's typed text kept
// (draftBody) and a visible reason (error) — never a bare thrown ApiError
// that loses the draft. The cap itself is named in words here, derived from
// the same MAX_COMMENT_BODY_LENGTH the textarea's maxLength and the route's
// server-side check both read, so this copy can't drift from what's
// enforced.
export function CommentThread(props: {
  assignmentId: string;
  comments: FileCommentRow[];
  csrfToken: string;
  timezone: string;
  draftBody?: string;
  error?: string;
}) {
  const { assignmentId, comments, csrfToken, timezone, draftBody, error } = props;
  return (
    <section aria-label="Comments">
      <h4 class="chq-portal-subsection-label">Comments</h4>
      {comments.length === 0 ? (
        <PublicEmptyState
          variant="fresh"
          what="No comments yet."
          reason="Your organiser can leave notes on this file here."
        />
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
        {error ? (
          <p role="alert" class="chq-field-error">
            {error}
          </p>
        ) : null}
        <textarea name="body" class="chq-textarea" required maxLength={MAX_COMMENT_BODY_LENGTH}>
          {draftBody ?? ""}
        </textarea>
        <p class="chq-portal-sub">Up to {MAX_COMMENT_BODY_LENGTH.toLocaleString("en-US")} characters.</p>
        <button type="submit" class="chq-btn chq-btn-secondary">Reply</button>
      </form>
    </section>
  );
}

// DEC-891: the candidates a file_request task-assignment upload could link
// to, plus (per candidate) the filename currently linked to it — so a second
// upload reads as belonging to a second session, not an overwrite of the
// first.
export interface DeliverableChoiceInfo {
  candidates: DeliverableCandidate[];
  linkedFilenames: Map<string, string | null>;
}

// DEC-891 amendment: pick which candidate (if any) should carry `selected`
// on an SSR reload — an unmarked <select> always renders its first <option>
// as chosen, so a speaker whose real session is further down the list would
// silently re-target their next upload at the wrong session (forking the
// DEC-573 version chain). Rules, in order:
//   (a) exactly one candidate has a linked file for this assignment -> it wins.
//   (b) several do -> the one whose linked filename matches the assignment's
//       current file wins, if that match is unambiguous.
//   (c) otherwise -> no candidate is preselected; the caller renders a
//       disabled placeholder option instead.
// Exactly one candidate (or none) may ever come back non-null here.
function pickPreselected(info: DeliverableChoiceInfo, currentFilename: string | undefined): string | null {
  const linkedCandidates = info.candidates.filter((cand) => info.linkedFilenames.get(cand.id) != null);
  if (linkedCandidates.length === 1) return linkedCandidates[0]?.id ?? null;
  if (linkedCandidates.length >= 2 && currentFilename != null) {
    const matches = linkedCandidates.filter((cand) => info.linkedFilenames.get(cand.id) === currentFilename);
    if (matches.length === 1) return matches[0]?.id ?? null;
  }
  return null;
}

// DEC-891: conditional-and-quiet — a lone eligible session renders no
// control at all; the select (and its required-ness) only appears once
// there is a real choice to make.
export function DeliverableSelect(props: { info: DeliverableChoiceInfo; currentFilename?: string }) {
  const { info, currentFilename } = props;
  if (info.candidates.length < 2) return null;
  const preselectedId = pickPreselected(info, currentFilename);
  return (
    <label class="chq-portal-detail">
      Which session is this for?
      <select name="submissionId" required class="chq-select">
        {preselectedId == null ? (
          <option value="" selected disabled>
            Choose a session
          </option>
        ) : null}
        {info.candidates.map((cand) => {
          const linked = info.linkedFilenames.get(cand.id);
          return (
            <option value={cand.id} selected={cand.id === preselectedId ? true : undefined}>
              {cand.ref} — {cand.title}
              {linked ? ` (current: ${linked})` : ""}
            </option>
          );
        })}
      </select>
    </label>
  );
}

// DEC-020 amendment (wave 10): a submission-linked upload reopens content
// review (tasks.tsx's reopenContentReview call, gated on the same
// isValidFileKind(t.deliverableKind) predicate) which pulls the session off
// every public surface until the producer re-approves it (public/gates.ts
// content_status='approved'). Say so before the speaker posts — a plain
// handout assignment (deliverableKind null) never reopens anything and must
// render nothing here.
function ReuploadReviewNotice() {
  return (
    <p class="chq-portal-detail">
      Posting a new version sends it back to the producer for review. The session
      will not appear on the public schedule while it is being reviewed.
    </p>
  );
}

export function TaskRow(props: {
  assignment: PortalTaskAssignment;
  csrfToken: string;
  error?: string;
  fileExtras?: FileRequestExtras;
  deliverableChoice?: DeliverableChoiceInfo;
  // DEC-244 amendment (wave 56): a refused comment reply on THIS row's
  // thread — kept separate from `error` (the upload-form refusal) since the
  // two forms on a completed row are independent and must not bleed into
  // each other's error state.
  commentError?: string;
  commentDraftBody?: string;
  now: number;
}) {
  const { assignment: t, csrfToken, error, fileExtras, deliverableChoice, commentError, commentDraftBody, now } = props;
  // DEC-826: a task cannot be late before it was assigned — print the
  // effective due date, the same one the organizer's grid and the
  // reminder email already use.
  const effectiveDue = effectiveAssignmentDueDayLabel(t.dueDate, t.assignedAt, t.timezone);
  // Mirrors src/routes/portal/tasks.tsx's kind fallback (deliverableKind ??
  // 'handout') so both the upload form and the replace form below advertise
  // the same tier validateUpload actually enforces for this assignment
  // (DEC-879 amendment, wave 10: one resolved kind, not two guesses).
  const uploadKind = isValidFileKind(t.deliverableKind) ? t.deliverableKind : "handout";
  return (
    <div class="chq-portal-row" id={`task-${t.id}`}>
      <div class="chq-portal-row-head">
        <span class="chq-portal-row-title">
          {t.title}
          {t.required ? <em> (required)</em> : null}
        </span>
        {/* Behaviour frozen (DEC-366): the underlying status stays
            pending|complete — only the on-screen wording grows a
            .chq-flag, never a red swatch (DEC-367). Overdue is carried by
            weight + wording (DEC-590), same as the portal home worklist. */}
        {t.status === "complete" ? (
          <span class="chq-flag chq-portal-flag-done">Done</span>
        ) : isAssignmentOverdue(t.dueDate, t.assignedAt, now, t.timezone) ? (
          <strong class="chq-flag">Overdue</strong>
        ) : (
          <span class="chq-flag">To do</span>
        )}
      </div>
      {effectiveDue ? <span class="chq-portal-due">Due {formatCalendarDate(effectiveDue)}</span> : null}
      {t.description ? <p class="chq-portal-detail">{t.description}</p> : null}
      {/* CNT-01: the task's free-text brief -- plain body ink, not behind a
          disclosure, so the speaker sees it without an extra click. */}
      {t.instructions ? <p class="chq-portal-instructions">{t.instructions}</p> : null}
      {error ? (
        <p role="alert" class="chq-field-error">
          {error}
        </p>
      ) : null}
      {t.status === "complete" ? null : (
        <div class="chq-portal-actions">
          {/* DEC-009 amendment (wave 59): this task's real completion path is
              the portal profile save (bio + headshot), never a bare
              mark-done checkbox or an upload widget — a checkbox here would
              let a speaker flip the task green with neither field filled
              in. */}
          {t.kind === "general" && t.title === PROFILE_TASK_TITLE ? (
            <a href="/portal/profile" class="chq-btn chq-btn-primary">Update your bio and headshot &rsaquo;</a>
          ) : null}
          {t.kind === "general" && t.title !== PROFILE_TASK_TITLE ? (
            <form method="post" action={`/portal/tasks/${t.id}/complete`}>
              <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
              <button type="submit" class="chq-btn chq-btn-primary">Mark complete</button>
            </form>
          ) : null}
          {t.kind === "file_request" ? (
            <form method="post" action={`/portal/tasks/${t.id}/upload`} enctype="multipart/form-data">
              <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
              {deliverableChoice ? <DeliverableSelect info={deliverableChoice} /> : null}
              <p class="chq-portal-detail">{uploadHintText(uploadKind)}</p>
              {isValidFileKind(t.deliverableKind) ? <ReuploadReviewNotice /> : null}
              <input
                type="file"
                name="file"
                required
                accept={allowedUploadExtensions(uploadKind).map((e) => `.${e}`).join(",")}
                class={error ? "chq-field-invalid" : undefined}
                aria-invalid={error ? "true" : undefined}
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
            {deliverableChoice ? <DeliverableSelect info={deliverableChoice} currentFilename={fileExtras.filename} /> : null}
            <p class="chq-portal-detail">{uploadHintText(uploadKind)}</p>
            {isValidFileKind(t.deliverableKind) ? <ReuploadReviewNotice /> : null}
            <input
              type="file"
              name="file"
              required
              accept={allowedUploadExtensions(uploadKind).map((e) => `.${e}`).join(",")}
              class={error ? "chq-field-invalid" : undefined}
              aria-invalid={error ? "true" : undefined}
            />
            <button type="submit" class="chq-btn chq-btn-secondary">Replace file</button>
          </form>
          <VersionHistory assignmentId={t.id} versions={fileExtras.versions} timezone={fileExtras.timezone} />
          <CommentThread
            assignmentId={t.id}
            comments={fileExtras.comments}
            csrfToken={csrfToken}
            timezone={fileExtras.timezone}
            error={commentError}
            draftBody={commentDraftBody}
          />
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
      <PortalBackLink to="/portal/tasks" />
      {/* w3-b (DEC-643 amendment): back-linked drill-in -> 25px phone
          register, docs/design/Chautauqua Public and Portal.dc.html:508
          `margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05`
          ("Portal · Hotel stay form" -- a form-kind task assignment). */}
      <h1 class="chq-portal-hero chq-portal-hero-drill">{assignment.title}</h1>
      {assignment.description ? <p class="chq-portal-sub">{assignment.description}</p> : null}
      <form method="post" action={`/portal/tasks/${assignment.id}/form`} enctype="multipart/form-data">
        <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
        <FormFieldsSection fields={fields} section="session" answers={answers} errors={errors} isVisible={isVisible} />
        <FormFieldsSection fields={fields} section="speaker" answers={answers} errors={errors} isVisible={isVisible} />
        <button type="submit" class="chq-btn chq-btn-primary">Submit</button>
      </form>
      <FieldRulesScript fields={fields} />
    </PortalLayout>
  );
}

// DEC-576/DEC-967 (wave-110 amendments): docs/design/Chautauqua Public and
// Portal.dc.html:492-495 `flex-shrink:0; border-top:1px solid #1B1D17;
// background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px`
// draws a fixed dock under "Your tasks" holding
// "Mark the release signed" (primary) + "Later" (secondary). The portal
// task model is complete-or-not only — there is no snooze/defer verb
// behind "Later" anywhere in src/routes/portal/**.tsx, so DEC-967's
// wave-106 amendment rules that only the dock's GEOMETRY is built here,
// for whatever primary the page already renders; the second control is
// never manufactured. This resolves the frame's single pinned action to
// the first NOT-complete assignment's own existing control — the same
// href/label/form the row itself would render, reused rather than
// duplicated content — and renders nothing when that control is a
// multipart file upload (DEC-967: reusing a <input type=file> form in two
// places on one page is not "the same control", it's a second, empty
// upload widget) or when every task is already complete.
function tasksPageDockPrimary(
  assignments: PortalTaskAssignment[],
  csrfToken: string,
  formLinkFor: (a: PortalTaskAssignment) => string | null,
): unknown {
  const next = assignments.find((a) => a.status !== "complete");
  if (!next) return null;
  if (next.kind === "form") {
    return (
      <a href={formLinkFor(next) ?? "#"} class="chq-btn chq-btn-primary">Fill out form</a>
    );
  }
  if (next.kind === "general" && next.title === PROFILE_TASK_TITLE) {
    return <a href="/portal/profile" class="chq-btn chq-btn-primary">Update your bio and headshot &rsaquo;</a>;
  }
  if (next.kind === "general") {
    return (
      <form method="post" action={`/portal/tasks/${next.id}/complete`}>
        <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
        <button type="submit" class="chq-btn chq-btn-primary">Mark complete</button>
      </form>
    );
  }
  // file_request: no dockable single control (see comment above).
  return null;
}

export function TasksPage(props: {
  branding: PortalBrandingChrome;
  assignments: PortalTaskAssignment[];
  csrfToken: string;
  formLinkFor: (a: PortalTaskAssignment) => string | null;
  errorFor?: (assignmentId: string) => string | undefined;
  fileExtrasFor?: (assignmentId: string) => FileRequestExtras | undefined;
  deliverableChoiceFor?: (assignmentId: string) => DeliverableChoiceInfo | undefined;
  // DEC-244 amendment (wave 56): mirrors errorFor/formLinkFor's per-row
  // lookup shape for a refused comment reply.
  commentErrorFor?: (assignmentId: string) => string | undefined;
  commentDraftBodyFor?: (assignmentId: string) => string | undefined;
  speakerName: string;
  now: number;
  // DEC-020 amendment (wave 10): the assignment id the /upload handler just
  // redirected here for (submission-linked uploads only — see that route's
  // comment). Renders a receipt naming what was received and disclosing the
  // reopen the handler already performed; absent for every other page view.
  uploadedAssignmentId?: string;
  // CNT-04 (wave 26 re-open of DEC-922): the assignment id the /upload
  // handler just redirected here for when its version-chain guard refused to
  // continue the chain (a real submission/kind mismatch against this
  // assignment's own prior file) — renders a plain line naming the restart
  // so it never reads as silent data loss.
  newSeriesAssignmentId?: string;
}) {
  const {
    branding,
    assignments,
    csrfToken,
    formLinkFor,
    errorFor,
    fileExtrasFor,
    deliverableChoiceFor,
    commentErrorFor,
    commentDraftBodyFor,
    speakerName,
    uploadedAssignmentId,
    newSeriesAssignmentId,
  } = props;
  const uploadedAssignment = uploadedAssignmentId
    ? assignments.find((a) => a.id === uploadedAssignmentId)
    : undefined;
  const newSeriesAssignment = newSeriesAssignmentId
    ? assignments.find((a) => a.id === newSeriesAssignmentId)
    : undefined;
  const dock = tasksPageDockPrimary(assignments, csrfToken, formLinkFor);
  return (
    <PortalLayout branding={branding} csrfToken={csrfToken} speakerName={speakerName} dock={dock}>
      {/* G13 (frame 10--05, MINOR): the page's own chrome says '‹ Your
          portal' -- the H1 keeps the same voice ('Your tasks'), and the
          undrawn progress bar is gone (the frame draws none). */}
      <PortalBackLink to="/portal" />
      <h1 class="chq-portal-hero">Your tasks</h1>
      {uploadedAssignment ? (
        <p role="status" class="chq-portal-detail">
          Received your file for "{uploadedAssignment.title}". The session is off the public schedule pending the
          producer's approval.
        </p>
      ) : null}
      {newSeriesAssignment ? (
        <p role="status" class="chq-portal-detail">
          Received your file for "{newSeriesAssignment.title}" as a new version series — it didn't continue your
          previous upload's history because it names a different session.
        </p>
      ) : null}
      {assignments.length === 0 ? (
        <PublicEmptyState
          variant="fresh"
          what="No tasks assigned yet."
          reason="Your organiser has not assigned anything yet."
        />
      ) : (
        assignments.map((t) =>
          t.kind === "form" && t.status !== "complete" ? (
            <div class="chq-portal-row" id={`task-${t.id}`}>
              <div class="chq-portal-row-head">
                <span class="chq-portal-row-title">
                  {t.title}
                  {t.required ? <em> (required)</em> : null}
                </span>
                {isAssignmentOverdue(t.dueDate, t.assignedAt, props.now, t.timezone) ? (
                  <strong class="chq-flag">Overdue</strong>
                ) : (
                  <span class="chq-flag">To do</span>
                )}
              </div>
              {effectiveAssignmentDueDayLabel(t.dueDate, t.assignedAt, t.timezone) ? (
                <span class="chq-portal-due">
                  Due {formatCalendarDate(effectiveAssignmentDueDayLabel(t.dueDate, t.assignedAt, t.timezone)!)}
                </span>
              ) : null}
              <div class="chq-portal-actions">
                <a href={formLinkFor(t) ?? "#"} class="chq-btn chq-btn-primary">Fill out form</a>
              </div>
            </div>
          ) : (
            <TaskRow
              assignment={t}
              now={props.now}
              csrfToken={csrfToken}
              error={errorFor?.(t.id)}
              fileExtras={fileExtrasFor?.(t.id)}
              deliverableChoice={deliverableChoiceFor?.(t.id)}
              commentError={commentErrorFor?.(t.id)}
              commentDraftBody={commentDraftBodyFor?.(t.id)}
            />
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
  // v12m-w5-a (docs/design/Chautauqua Public and Portal.dc.html:1565):
  // `The same for every speaker · nothing here is about your session`
  // the 390 frame adds a subtitle under the H1 -- "The same for every speaker"
  // -- so a speaker doesn't mistake a shared, organiser-wide resource for
  // something scoped to their own session. Rendered at every width; the
  // phone block below only re-docks the footer note and re-flows the row.
  const footerExtra = (
    <span class="chq-portal-resources-footer-note">Questions? Reply to any of our emails.</span>
  );
  return (
    <PortalLayout branding={branding} csrfToken={csrfToken} speakerName={speakerName} footerExtra={footerExtra}>
      <PortalBackLink to="/portal" />
      <h1 class="chq-portal-hero chq-portal-resources-hero">Resources</h1>
      <p class="chq-portal-sub">The same for every speaker · nothing here is about your session</p>
      {groups.length === 0 ? (
        <PublicEmptyState
          variant="fresh"
          what="No resources yet."
          reason="Your organiser has not shared any speaker resources."
        />
      ) : (
        groups.map((group) => (
          <section aria-label={group.eventName} class="chq-section">
            <div class="chq-section-label">{group.eventName}</div>
            {group.resources.map((r) => (
              <div class="chq-portal-row chq-portal-resource-row">
                <span class="chq-portal-row-title">{r.title}</span>
                {r.kind === "wiki" ? (
                  <div class="chq-portal-detail" dangerouslySetInnerHTML={{ __html: renderMarkdown(r.content ?? "") }} />
                ) : (
                  <div class="chq-portal-actions">
                    {/* v12m-w5-a (dc.html:1575): "Open", not "Download" --
                        this same route also serves wiki resources rendered
                        inline above, so "Download" was never true for the
                        whole population sharing this row shape. */}
                    <a href={`/portal/resources/${r.id}/download`} class="chq-btn chq-btn-secondary">Open</a>
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
