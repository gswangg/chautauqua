// Speaker portal shell, per DEC-005 (/portal/* Hono JSX SSR, light
// progressive enhancement) + DEC-012 (thin handlers: gate -> repo -> render)
// + DEC-016 (status label mapping never leaks internal queue states)
// + DEC-028 (shared gate/layout) + DEC-029 (Sessions/invitations depth).
//
// Route files export a named Hono sub-app; only src/index.ts mounts it.

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { speakerGate, PortalLayout, PortalBackLink, portalNotFound } from "./shared";
import { PublicEmptyState } from "../public/empty-state";
import { formatCalendarDate, formatDayMedium, formatEventDate, formatScheduleSlotLabel } from "../../lib/event-time";
import { effectiveAssignmentDueDayLabel, isAssignmentOverdue } from "../../domain/task-due";
import { countOf, capitalizeFirst, plural, spellCount } from "../../domain/count-copy";
import { publicRoomLabel } from "../../domain/schedule";
import { clockHHMM } from "../../domain/clock";
import { sessionFormatLabel } from "../../lib/session-vocabulary";
import { csrfForm } from "../../server/middleware";
import { ApiError } from "../../server/http";
import {
  assertSpeakerContactId,
  canTransitionInvite,
  getLatestDeliverable,
  getMyInvitations,
  getMySessions,
  getMySubmissions,
  getMyTaskAssignments,
  getParticipantScope,
  getPortalData,
  getPortalSubmissionDetail,
  listDeliverableCandidatesForEvents,
  listLatestDeliverables,
  nextInviteStatus,
  setInviteStatus,
  type InviteAction,
  type PortalData,
  type PortalDeliverable,
  type PortalInvitation,
  type PortalSession,
  type PortalSubmissionDetail,
  type PortalSubmissionListItem,
  type PortalTaskAssignment,
} from "../../server/repo/portal";
import { getFileVersionNumber } from "../../server/repo/files";
import { formatBytes } from "../../domain/files";
import { DEC_729, DEC_777, DEC_884, DEC_576, DEC_936, DEC_908, DEC_895, DEC_590, DEC_380 } from "../../decisions";
import { isDefaultParticipantRole } from "../../domain/participant-roles";
import { DEFAULT_PORTAL_SETTINGS } from "../../domain/portal-settings";

void DEC_729;
void DEC_777;
void DEC_884;
// wave 115: the home subline enumerates EVERY placed session — see
// scheduledSubline below.
void DEC_936;
void DEC_576; // wave-110 amendment: SubmissionDetailPage's primary+secondary move into PortalLayout's dock
// wave 150 (w6-cd): SessionCard prints the format-first meta clause and the
// deliverable's version + review-status clause, both through the ONE
// vocabulary the rest of the portal already established -- never a
// fabricated default when the answer/version is absent.
void DEC_908;
void DEC_895;
// DEC-590 (task w30-c; wave-22 amendment): PortalPage's headline (`${capitalizeFirst(spellCount(n))}
// ${plural(n, "thing")} to do`, below) is n = worklist.length by
// construction -- the SAME array the "Waiting on you" section maps over,
// never a second count -- and PortalLayout (shared.tsx) demotes sign-out to
// a quiet chq-btn-tertiary control rather than page chrome, matching this
// decision's two clauses. The headline spells its count in words (matching
// `docs/design/Chautauqua Public and Portal.dc.html:420`'s literal, `Two
// things to do`) via the SAME spellCount/capitalizeFirst pair already
// shipping in Overview.tsx, AgendaWorkSection, scorecardLogic.ts, and
// server/repo/tasks/reminders.ts -- countOf (the numeral register, DEC-925)
// stays reserved for data-dense surfaces and is used elsewhere in this file
// (scheduledSubline's session-count clause) but never in this hero.
void DEC_590;
// DEC-380 wave-22 amendment: the hero spells its count via
// capitalizeFirst(spellCount(n)) + plural(n, "thing"), not countOf's
// numeral -- see the DEC-590 comment above for the full composition.
void DEC_380;
import {
  parseCookies,
  newCsrfToken,
  buildCsrfCookie,
  isSecureRequest,
  CSRF_COOKIE_NAME,
} from "../../auth/cookies";
import { loadEditableSubmission, getPortalParticipants, type PortalParticipant } from "../../server/repo/portal-edit";
import { canEditSubmission } from "../../domain/edit-lock";
import { ensureOnboardingTasks, getSubmissionStatusForParticipant } from "../../server/repo/submissions";

export const portalRoutes = new Hono<AppEnv>();

portalRoutes.use("*", speakerGate);

function ensureCsrfCookie(c: {
  req: { header(name: string): string | undefined; url: string };
}): {
  token: string;
  setCookieIfNew: string | null;
} {
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const existing = cookies[CSRF_COOKIE_NAME];
  if (existing) return { token: existing, setCookieIfNew: null };
  const token = newCsrfToken();
  return {
    token,
    setCookieIfNew: buildCsrfCookie(token, { secure: isSecureRequest(c.req.url) }),
  };
}

// DEC-590: the worklist is exactly two kinds of row — a pending task
// assignment and a pending co-presenter invitation. Nothing else may ever
// contribute to its count or its rendering.
type WorklistRow =
  | { kind: "task"; task: PortalTaskAssignment }
  | { kind: "invitation"; invitation: PortalInvitation };

function rowRequired(row: WorklistRow): boolean {
  return row.kind === "task" ? row.task.required : false;
}

function rowDueDate(row: WorklistRow): number | null {
  return row.kind === "task" ? row.task.dueDate : null;
}

/** Required rows first, then by due date ascending (no due date sorts
 * last within its required/not-required bucket) — ties keep the original
 * (stable) order. DEC-590: overdue is stated as weight/wording on the row
 * itself, never as a sort-breaking colour channel. */
function sortWorklist(rows: WorklistRow[]): WorklistRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const requiredDelta = Number(rowRequired(b.row)) - Number(rowRequired(a.row));
      if (requiredDelta !== 0) return requiredDelta;
      const dueA = rowDueDate(a.row);
      const dueB = rowDueDate(b.row);
      if (dueA === null && dueB === null) return a.index - b.index;
      if (dueA === null) return 1;
      if (dueB === null) return -1;
      if (dueA !== dueB) return dueA - dueB;
      return a.index - b.index;
    })
    .map((entry) => entry.row);
}

function taskActionHref(t: PortalTaskAssignment): string {
  return t.kind === "form" ? `/portal/tasks/${t.id}/form` : `/portal/tasks#task-${t.id}`;
}

function taskActionLabel(t: PortalTaskAssignment): string {
  if (t.kind === "form") return "Fill out form";
  if (t.kind === "file_request") return "Upload file";
  return "Open task";
}

function WorklistTaskRow(props: { task: PortalTaskAssignment; now: number }) {
  const { task: t, now } = props;
  // DEC-826: a task cannot be late before it was assigned — the printed
  // date and the overdue mark both use the effective due date, the same
  // one the organizer's grid and the reminder email already use.
  const effectiveDue = effectiveAssignmentDueDayLabel(t.dueDate, t.assignedAt, t.timezone);
  const overdue = isAssignmentOverdue(t.dueDate, t.assignedAt, now, t.timezone);
  return (
    <div class="chq-portal-row">
      <div class="chq-portal-row-head">
        <span class="chq-portal-row-title">
          {t.title}
          {t.required ? <strong> (required)</strong> : null}
        </span>
        {/* DEC-367/DEC-590: overdue is carried by weight + wording, never a
            red swatch. */}
        {overdue ? <strong class="chq-flag">Overdue</strong> : null}
      </div>
      {effectiveDue ? <span class="chq-portal-due">Due {formatCalendarDate(effectiveDue)}</span> : null}
      {t.description ? <p class="chq-portal-detail">{t.description}</p> : null}
      <div class="chq-portal-actions">
        <a href={taskActionHref(t)} class="chq-btn chq-btn-primary">
          {taskActionLabel(t)}
        </a>
      </div>
    </div>
  );
}

function WorklistInvitationRow(props: { invitation: PortalInvitation; csrfToken: string }) {
  const { invitation: inv, csrfToken } = props;
  return (
    <div class="chq-portal-row">
      <div class="chq-portal-row-head">
        <span class="chq-portal-row-title">
          Invited to co-present "{inv.title}" ({inv.ref}) at {inv.eventName}
        </span>
      </div>
      <div class="chq-portal-actions">
        <form method="post" action={`/portal/invitations/${inv.participantId}`}>
          <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
          <input type="hidden" name="action" value="accept" />
          <button type="submit" class="chq-btn chq-btn-primary">Accept</button>
        </form>
        <form method="post" action={`/portal/invitations/${inv.participantId}`}>
          <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
          <input type="hidden" name="action" value="decline" />
          <button type="submit" class="chq-btn chq-btn-secondary">Decline</button>
        </form>
      </div>
    </div>
  );
}

/** DEC-590/w15-b subline: "<Event name> · you speak <formatPlacement>" when
 * the speaker has an accepted session that's actually been placed on the
 * schedule (day + startMin both set); else the event name alone. Composes
 * formatPlacement below — the ONE portal placement grammar (w13-d) — rather
 * than hand-assembling day/time/room.
 *
 * DEC-936 (amendment, wave 115): EVERY placed session is named, never the
 * first one. The old `.find()` stated one slot as though it were the whole
 * answer, so a speaker with two accepted, scheduled sessions read "you speak
 * Thu 13 May, 09:30 · Main Stage" and had no way to learn about the second —
 * the same lowest-row pick DEC-936 already refused on the roster, on the one
 * surface the speaker themselves reads. Slots are separated by "; " because
 * "·" is already inside formatPlacement's own room clause and a second
 * meaning for it would make the list unparseable. Count phrase via countOf
 * (DEC-925/DEC-987, the one pluralization vocabulary).
 *
 * DEC-988 (wave-74 amendment, sibling fix): name the PLACED session's own
 * event, never the portal's single "most recent submission" branding event —
 * a speaker across events must not have Event A's placement captioned with
 * Event B's name. When the placed sessions span two events no single name can
 * lead the line, so each slot carries its own. */
function scheduledSubline(fallbackEventName: string, sessions: PortalSession[]): string {
  const placed = sessions.filter((s) => s.day !== null && s.startMin !== null);
  const first = placed[0];
  if (first === undefined) return fallbackEventName;
  if (placed.length === 1) {
    return `${first.eventName} · you speak ${formatPlacement(first.day!, first.startMin!, first.roomName)}`;
  }
  const oneEvent = placed.every((s) => s.eventName === first.eventName);
  const slots = placed.map((s) => {
    const at = formatPlacement(s.day!, s.startMin!, s.roomName);
    return oneEvent ? at : `${s.eventName}: ${at}`;
  });
  const lead = oneEvent ? `${first.eventName} · ` : "";
  return `${lead}you speak ${countOf(placed.length, "time")} — ${slots.join("; ")}`;
}

/** DEC-908: SessionCard's deliverable always comes from listLatestDeliverables
 * (the portal-home batched read), which fails loudly at the repo layer on a
 * null stored version_no -- so versionNo is never null here in practice.
 * Fails loudly rather than defaulting (`?? 1`) if that invariant is ever
 * violated, matching files-library-list.ts's identical rule; never called
 * with a getLatestDeliverable (single-read, versionNo always null) result. */
function deliverableVersionOrThrow(d: PortalDeliverable): number {
  if (d.versionNo === null) {
    throw new Error(`SessionCard: deliverable ${d.id} has no version number`);
  }
  return d.versionNo;
}

function SessionCard(props: {
  session: PortalSession;
  deliverable: PortalDeliverable | null;
  showResources: boolean;
}) {
  const { session: s, deliverable, showResources } = props;
  // DEC-908: format clause FIRST, through the one session-shape vocabulary
  // (sessionFormatLabel) -- never a second '(N min)' parser. Omitted when
  // there is no session_format answer, or when the stored label carries no
  // parseable duration (sessionFormatLabel would hand it back unchanged),
  // the exact rule portal/edit.tsx:290 already applies -- never a
  // fabricated default (DEC-895).
  const formatLabel = s.format !== null && sessionFormatLabel(s.format) !== s.format ? sessionFormatLabel(s.format) : null;
  const metaParts = [
    formatLabel,
    s.trackName,
    s.acceptedAt !== null ? `accepted ${formatEventDate(s.acceptedAt, s.timezone)}` : null,
  ].filter((p): p is string => p !== null);
  return (
    <div class="chq-portal-row">
      <span class="chq-portal-row-title">{s.title}</span>
      {metaParts.length > 0 ? <span class="chq-portal-due">{metaParts.join(" · ")}</span> : null}
      {deliverable ? (
        <span class="chq-portal-detail">
          {/* DEC-908 (wave-150 amendment): version + review-status clause,
              docs/design/Chautauqua Public and Portal.dc.html:445 draws
              `Slides v3 · with the organisers` -- composed here exactly as
              the ruling states, from the SAME vocabulary the submission
              detail page's own "v{n} · ... · Shared with the organisers"
              clause (index.tsx:544) already established, never a second
              phrase. Fails loudly rather than defaulting when versionNo is
              null (listLatestDeliverables's own data-corruption rule
              already guarantees it is set whenever deliverable is
              non-null here). */}
          {deliverable.filename} v{deliverableVersionOrThrow(deliverable)} · with the organisers
        </span>
      ) : null}
      {/* DEC-777 (wave 44 amendment): advisory-only inline flag — the
          speaker sees their own clash. Never a block, never an email,
          never a status change. Composes the existing quiet .chq-portal-
          detail muted-text style rather than a new class. */}
      {s.overlaps.map((o) => (
        <span class="chq-portal-detail">
          Overlaps {o.ref} · {formatScheduleSlotLabel(o.day, o.startMin, s.timezone)}
        </span>
      ))}
      <div class="chq-portal-actions">
        <a href="/portal/tasks" class="chq-btn chq-btn-secondary">Upload again</a>
        {showResources ? (
          <a href="/portal/resources" class="chq-btn chq-btn-secondary">Read notes</a>
        ) : null}
      </div>
    </div>
  );
}

function DoneRow(props: { task: PortalTaskAssignment }) {
  const { task: t } = props;
  return (
    <div class="chq-portal-row chq-portal-done-row">
      <span class="chq-portal-row-title">{t.title}</span>
      <span class="chq-portal-done-when">{t.completedAt !== null ? formatEventDate(t.completedAt, t.timezone) : ""}</span>
    </div>
  );
}

// DEC-729: one row per submission the speaker owns — REF · format · track
// (whichever parts exist) plus a public status label, linked to the detail
// page. No participants/answers here; that's the detail page's job.
function SubmissionRow(props: { submission: PortalSubmissionListItem }) {
  const { submission: s } = props;
  const metaParts = [s.ref, s.format !== null ? sessionFormatLabel(s.format) : null, s.trackName].filter(
    (p): p is string => p !== null && p.length > 0,
  );
  return (
    <a href={`/portal/submissions/${s.id}`} class="chq-portal-row chq-portal-submission-row">
      <div class="chq-portal-row-head">
        <span class="chq-portal-row-title">{s.title}</span>
        <span class="chq-flag">{s.statusLabel}</span>
      </div>
      {metaParts.length > 0 ? <span class="chq-portal-due">{metaParts.join(" · ")}</span> : null}
    </a>
  );
}

function PortalPage(props: {
  data: PortalData;
  sessions: PortalSession[];
  invitations: PortalInvitation[];
  taskAssignments: PortalTaskAssignment[];
  deliverables: Map<string, PortalDeliverable | null>;
  submissions: PortalSubmissionListItem[];
  csrfToken: string;
  showAdminBounceNotice: boolean;
  anyEventShowsResources: boolean;
}) {
  const { branding, contactName, contactCompany } = props.data;
  const { sessions, invitations, taskAssignments, deliverables, submissions, csrfToken } = props;
  const now = Date.now();

  // DEC-590: n is EXACTLY the count of rows rendered below — pending task
  // assignments plus pending co-presenter invitations, nothing else (no
  // completed task, no accepted session, no submission).
  const pendingTasks = taskAssignments.filter((t) => t.status !== "complete");
  const doneTasks = taskAssignments.filter((t) => t.status === "complete");
  const worklist = sortWorklist([
    ...pendingTasks.map((task): WorklistRow => ({ kind: "task", task })),
    ...invitations.map((invitation): WorklistRow => ({ kind: "invitation", invitation })),
  ]);
  const n = worklist.length;

  const footerExtra = (
    <div class="chq-portal-footer-band">
      <span class="chq-portal-footer-who">
        {contactName}
        {contactCompany ? ` · ${contactCompany}` : ""}
      </span>
      {/* w15-b: /portal/resources must stay reachable even when the
          speaker has no accepted session (so no "Read notes" link renders
          in a Your session card) — the footer is the always-present path
          WHEN the section is on for at least one of the speaker's events
          (DEC-988 wave-74 amendment: PER EVENT, not one global toggle —
          render when ANY event permits, /portal/resources itself filters
          down to only the permitted groups). */}
      {props.anyEventShowsResources ? (
        <a href="/portal/resources" class="chq-portal-footer-resources">Resources</a>
      ) : null}
      <a href="/portal/profile" class="chq-portal-footer-profile">Profile</a>
    </div>
  );

  return (
    <PortalLayout branding={branding} csrfToken={csrfToken} speakerName={contactName} footerExtra={footerExtra}>
      {/* DEC-884: welcomeMessage moves out of header chrome into the first
          body block of the portal home page — it's content, not a tagline
          the header carries on every route. */}
      {branding.welcomeMessage ? <p class="chq-meta">{branding.welcomeMessage}</p> : null}
      {/* DEC-945 (amendment, wave 69): a role-blocked /admin bounce says why
          instead of landing a speaker on their portal with no explanation. */}
      {props.showAdminBounceNotice ? (
        <p class="chq-meta" role="status">
          The organizer dashboard isn't part of your speaker portal — this is your home.
        </p>
      ) : null}
      <h1 class="chq-portal-hero">
        {capitalizeFirst(spellCount(n))} {plural(n, "thing")} to do
      </h1>
      <p class="chq-portal-sub">{scheduledSubline(branding.eventName, sessions)}</p>

      <section aria-label="Waiting on you" class="chq-section">
        <div class="chq-section-label">Waiting on you</div>
        {n === 0 ? (
          <PublicEmptyState variant="fresh" what="Nothing pending right now." />
        ) : (
          worklist.map((row) =>
            row.kind === "task" ? (
              <WorklistTaskRow task={row.task} now={now} />
            ) : (
              <WorklistInvitationRow invitation={row.invitation} csrfToken={csrfToken} />
            ),
          )
        )}
        <p>
          {/* DEC-393 wave-142 (task w17-e): standalone row link (sole content
              of its own <p>, not a sentence phrase) -- real floor. */}
          <a class="chq-portal-standalone-link" href="/portal/tasks">View all tasks</a>
        </p>
      </section>

      {/* DEC-729: every submission the speaker owns, pending/accepted/
          declined alike — not just the ones getMySessions restricts to
          accepted. */}
      <section aria-label="Your submissions" class="chq-section">
        <div class="chq-section-label">Your submissions</div>
        {submissions.length === 0 ? (
          <PublicEmptyState
            variant="fresh"
            what="No submissions yet."
            reason="Anything you send to a call for papers shows up here."
          />
        ) : (
          submissions.map((s) => <SubmissionRow submission={s} />)
        )}
        <p>
          {/* DEC-393 wave-142 (task w17-e): standalone row link -- real floor. */}
          <a class="chq-portal-standalone-link" href="/portal/submissions">View all submissions</a>
        </p>
      </section>

      <section aria-label="Your session" class="chq-section">
        <div class="chq-section-label">Your session</div>
        {sessions.length === 0 ? (
          <PublicEmptyState
            variant="fresh"
            what="No accepted sessions yet."
            reason="When a session of yours is accepted it appears here with its schedule."
          />
        ) : (
          sessions.map((s) => (
            <SessionCard
              session={s}
              deliverable={deliverables.get(s.submissionId) ?? null}
              showResources={props.data.showResourcesByEventId[s.eventId] ?? DEFAULT_PORTAL_SETTINGS.showResources}
            />
          ))
        )}
      </section>

      <section aria-label="Done" class="chq-section">
        <div class="chq-section-label">Done</div>
        {doneTasks.length === 0 ? (
          <PublicEmptyState variant="fresh" what="Nothing completed yet." />
        ) : (
          doneTasks.map((t) => <DoneRow task={t} />)
        )}
      </section>
    </PortalLayout>
  );
}

// DEC-900 amendment (wave 60): minutes-from-midnight -> zero-padded HH:MM
// via the single clock owner; the `null -> ''` guard stays at this call
// site (the owner never takes null).
function minutesToClock(min: number | null): string {
  if (min === null) return "";
  return clockHHMM(min);
}

// DEC-777/w13-d: "<day>, <HH:MM> · <room>" — THE ONE portal placement
// grammar, day via formatDayMedium (a calendar-day label, not an instant —
// same "Tue 12 May" the design handoff and the agenda day-switcher family
// use), start time via the already-local startMin (schedule_slot stores
// minutes-from-midnight IN the event's own timezone — DEC-010 — so no
// further zone conversion applies), and an honest room-absence label
// (DEC-666: the ONE room-absence vocabulary, publicRoomLabel) instead of
// silently omitting the room. scheduledSubline composes this same function
// rather than hand-assembling day/time/room a second time.
function formatPlacement(day: string, startMin: number, roomName: string | null): string {
  return `${formatDayMedium(day)}, ${minutesToClock(startMin)} · ${publicRoomLabel(roomName)}`;
}

// DEC-777 (w2-f rebuild): docs/design "Portal · Your session" frame — status
// badge, title and back link EACH their own block-level row (never sharing
// an inline line), "REF · format · track" as its own line, a placement line
// (event-timezone, honest room-absence label when unplaced, DEC-666) only when
// the session has actually landed on the schedule, Abstract, then a Slides
// card carrying real file metadata (filename/version/size/"Shared with the
// organisers") plus — ONLY when a file_request task exists for this speaker
// on this submission's event — a link to that task's upload page. The old
// Participants/Answers sections are gone from this READ view: both stay
// reachable via /portal/submissions/:id/edit (src/routes/portal/edit.tsx),
// which this task does not touch.
function SubmissionDetailPage(props: {
  branding: PortalData["branding"];
  detail: PortalSubmissionDetail;
  editable: boolean;
  csrfToken: string;
  deliverable: PortalDeliverable | null;
  deliverableVersion: number | null;
  fileRequestTask: PortalTaskAssignment | null;
  speakerName: string;
  coPresenters: PortalParticipant[];
}) {
  const { detail, editable, deliverable, deliverableVersion, fileRequestTask, coPresenters } = props;
  const metaParts = [detail.ref, detail.format, detail.trackName].filter(
    (p): p is string => p !== null && p.length > 0,
  );
  const placed = detail.day !== null && detail.startMin !== null;
  // DEC-777 (wave 4 amendment): the speaker's own fact of who else is on
  // the session — named exactly as the portal stored them (DEC-866, never
  // a CRM identity resolved from a supplied email), the viewer's own row
  // excluded upstream, role suffixed only when it isn't the plain "speaker"
  // role. Absent entirely when there is nobody else — never "With -".
  // DEC-604 (wave-76 amendment): predicate is "is this the default role",
  // not "is this one of the three co-presenter values" -- the organizer
  // participant endpoint can stamp a free-text role that participantRoleLabel
  // renders as-is, and isCoPresenterRoleValue would disagree with the
  // default-check for such a value, so isDefaultParticipantRole is the
  // correct (and only NO-OP-preserving) predicate here.
  const withLine = coPresenters
    .map((p) => (isDefaultParticipantRole(p.role) ? p.name : `${p.name} (${p.roleLabel.toLowerCase()})`))
    .join(", ");
  // DEC-576: the frame's dock is this page's primary [+ secondary] --
  // exactly the same controls that used to render inline below the status
  // row (unchanged hrefs/labels/order), now passed to PortalLayout so
  // PortalShell renders them once inside .chq-portal-footer instead of a
  // second copy in <main>.
  // Not wrapped in .chq-portal-actions -- that class's own phone rule
  // (portal.css.ts, ~:775) forces a full-width stacked column, which would
  // fight the dock's flex:1-primary/bordered-secondary row (docs/design
  // :586-589). .chq-portal-dock (added by PortalLayout) owns the dock's
  // row layout directly on these two controls instead.
  const dock =
    editable || fileRequestTask ? (
      <>
        {fileRequestTask ? (
          <a href={taskActionHref(fileRequestTask)} class="chq-btn chq-btn-primary">
            {taskActionLabel(fileRequestTask)}
          </a>
        ) : null}
        {editable ? (
          <a href={`/portal/submissions/${detail.id}/edit`} class="chq-btn chq-btn-secondary">Edit submission</a>
        ) : null}
      </>
    ) : null;
  return (
    <PortalLayout branding={props.branding} csrfToken={props.csrfToken} speakerName={props.speakerName} dock={dock}>
      {/* G13 (frame 10--08, MAJOR): the page names itself -- back link,
          H1 'Your session', THEN the status eyebrow and the session title
          -- the session title no longer occupies the H1 slot. The page's
          primary is the upload action (olive), with Edit as the secondary
          beside it -- DEC-576 (wave-110 amendment): both now render in the
          dock band (PortalLayout's footer), not inline here. */}
      <div class="chq-portal-back-row">
        {/* DEC-029 wave-21: docs/design/Chautauqua Public and Portal.dc.html:565
            `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Your portal</a>`
            -- not '‹ Your submissions' -- fixed by repointing the href to
            /portal, which PORTAL_BACK_LINKS (DEC-914) already maps to
            "Your portal", never by adding a label override. */}
        <PortalBackLink to="/portal" />
      </div>
      <h1 class="chq-portal-hero chq-portal-hero-drill">Your session</h1>
      <div class="chq-portal-status-row">
        <span class="chq-flag chq-portal-status-badge">
          {detail.statusLabel} · {formatCalendarDate(detail.submittedAt)}
        </span>
      </div>
      <h2 class="chq-portal-session-title">{detail.title}</h2>
      {metaParts.length > 0 ? <p class="chq-portal-sub">{metaParts.join(" · ")}</p> : null}
      {coPresenters.length > 0 ? <p class="chq-portal-sub">With {withLine}</p> : null}
      {placed ? (
        <p class="chq-portal-sub">{formatPlacement(detail.day!, detail.startMin!, detail.roomName)}</p>
      ) : null}

      <div class="chq-section-label">Abstract</div>
      {detail.description ? <p>{detail.description}</p> : <p>No abstract yet.</p>}

      <div class="chq-section-label">Slides</div>
      {deliverable ? (
        <div class="chq-portal-row">
          <span class="chq-portal-row-title">{deliverable.filename}</span>
          <span class="chq-portal-due">
            v{deliverableVersion ?? 1} · {formatBytes(deliverable.sizeBytes)} · Shared with the organisers
          </span>
          {/* DEC-777: never a button with nowhere to go — the upload link
              only renders when this speaker actually has a file_request
              task assignment behind it. */}
          {fileRequestTask ? (
            <div class="chq-portal-actions">
              <a href={taskActionHref(fileRequestTask)} class="chq-btn chq-btn-secondary">
                {taskActionLabel(fileRequestTask)}
              </a>
            </div>
          ) : null}
        </div>
      ) : (
        <PublicEmptyState variant="fresh" what="Nothing uploaded yet." />
      )}
    </PortalLayout>
  );
}

// DEC-729: /portal/submissions full-page list — the same rows the portal
// home's "Your submissions" section renders, just not truncated by the
// home page's other sections.
function SubmissionsListPage(props: {
  branding: PortalData["branding"];
  csrfToken: string;
  submissions: PortalSubmissionListItem[];
  speakerName: string;
}) {
  const { submissions } = props;
  return (
    <PortalLayout branding={props.branding} csrfToken={props.csrfToken} speakerName={props.speakerName}>
      <PortalBackLink to="/portal" />
      <h1 class="chq-portal-hero chq-portal-hero-drill">Your submissions</h1>
      {submissions.length === 0 ? (
        <PublicEmptyState
          variant="fresh"
          what="No submissions yet."
          reason="Anything you send to a call for papers shows up here."
        />
      ) : (
        submissions.map((s) => <SubmissionRow submission={s} />)
      )}
    </PortalLayout>
  );
}

// DEC-945 (amendment, wave 69): the only accepted value of ?from= is this one
// literal — a closed, one-member vocabulary. Anything else (including no
// param at all) renders no notice, and the raw query value is never echoed.
const ADMIN_BOUNCE = "admin";

portalRoutes.get("/", async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const showAdminBounceNotice = c.req.query("from") === ADMIN_BOUNCE;
  const [data, sessions, invitations, taskAssignments, submissions] = await Promise.all([
    getPortalData(c.var.db, contactId, auth.orgId),
    getMySessions(c.var.db, contactId, auth.orgId),
    getMyInvitations(c.var.db, contactId, auth.orgId),
    getMyTaskAssignments(c.var.db, contactId, auth.orgId),
    getMySubmissions(c.var.db, contactId, auth.orgId),
  ]);
  const deliverables = await listLatestDeliverables(
    c.var.db,
    contactId,
    auth.orgId,
    sessions.map((s) => s.submissionId),
  );
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
  // DEC-988 (wave-74 amendment): the footer link is reachable when ANY of
  // the speaker's events permits — /portal/resources itself filters down to
  // only the permitted groups, so this is never an over-grant.
  const anyEventShowsResources = Object.values(data.showResourcesByEventId).some((v) => v);
  return c.html(
    <PortalPage
      data={data}
      sessions={sessions}
      invitations={invitations}
      taskAssignments={taskAssignments}
      deliverables={deliverables}
      submissions={submissions}
      csrfToken={csrfToken}
      showAdminBounceNotice={showAdminBounceNotice}
      anyEventShowsResources={anyEventShowsResources}
    />,
  );
});

// GET /portal/submissions — DEC-729: the full-page list of every submission
// this speaker owns, not truncated by the home page's worklist/session/done
// sections.
portalRoutes.get("/submissions", async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const [data, submissions] = await Promise.all([
    getPortalData(c.var.db, contactId, auth.orgId),
    getMySubmissions(c.var.db, contactId, auth.orgId),
  ]);
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
  return c.html(
    <SubmissionsListPage
      branding={data.branding}
      csrfToken={csrfToken}
      submissions={submissions}
      speakerName={data.contactName}
    />,
  );
});

portalRoutes.get("/submissions/:id", async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const id = c.req.param("id");
  // DEC-777/DEC-338 (wave 33): every read below carries contactId AND
  // auth.orgId in its own arguments, so none can return another speaker's
  // row at any ordering — they issue as one caller-scoped wave. The
  // getPortalParticipants read below is scoped by the path id ALONE and
  // must therefore stay behind the ownership proof (`detail` truthy).
  const [detail, data, editData, myTaskAssignments, deliverable] = await Promise.all([
    getPortalSubmissionDetail(c.var.db, id, contactId, auth.orgId),
    getPortalData(c.var.db, contactId, auth.orgId),
    loadEditableSubmission(c.var.db, auth.orgId, contactId, id),
    getMyTaskAssignments(c.var.db, contactId, auth.orgId),
    getLatestDeliverable(c.var.db, contactId, auth.orgId, id),
  ]);
  if (!detail) {
    return portalNotFound(c);
  }
  // DEC-041: the edit link only shows when the submission is still
  // editable (accepted, or the form window is open).
  const editable = editData
    ? canEditSubmission(editData.submission.status, editData.form.closeDate, Date.now(), editData.form.timezone)
    : false;
  // DEC-777: the Slides card only ever links to an upload page that exists
  // — resolve the speaker's own file_request task assignments (any event)
  // and find one whose upload could carry THIS submission, never a button
  // with nowhere to go. DEC-891 replaced DEC-240's deterministic linkage
  // with an explicit choice, so the test is candidacy, not resolution: the
  // task matches when this submission is among the caller's own deliverable
  // candidates in that task's event (with several candidates the upload page
  // asks which one; with exactly one it is this one).
  const fileRequestCandidates = myTaskAssignments.filter((t) => t.kind === "file_request");
  // DEC-777 (wave 4 amendment): the SAME getPortalParticipants read
  // edit.tsx uses — one call, never a second query shape or a
  // per-participant query — with the viewer's own row excluded. Gated
  // behind the `detail` ownership proof above, so it only ever runs once
  // the caller is confirmed to own this submission.
  const [participants, deliverableVersion, candidatesByEvent] = await Promise.all([
    getPortalParticipants(c.var.db, id),
    deliverable ? getFileVersionNumber(c.var.db, deliverable.id) : null,
    listDeliverableCandidatesForEvents(
      c.var.db,
      contactId,
      fileRequestCandidates.map((t) => t.eventId),
    ),
  ]);
  const fileRequestTask =
    fileRequestCandidates.find((t) => (candidatesByEvent.get(t.eventId) ?? []).some((cand) => cand.id === id)) ??
    null;
  const coPresenters = participants.filter((p) => p.contactId !== contactId);
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
  return c.html(
    <SubmissionDetailPage
      branding={data.branding}
      detail={detail}
      editable={editable}
      csrfToken={csrfToken}
      deliverable={deliverable}
      deliverableVersion={deliverableVersion}
      fileRequestTask={fileRequestTask}
      speakerName={data.contactName}
      coPresenters={coPresenters}
    />,
  );
});

// POST /portal/invitations/:participantId { action: 'accept'|'decline' } —
// own participant rows only, and only rows currently invite_status='invited'
// may transition (DEC-029).
portalRoutes.post("/invitations/:participantId", csrfForm, async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const participantId = c.req.param("participantId");

  const scope = await getParticipantScope(c.var.db, participantId);
  if (!scope || scope.orgId !== auth.orgId) throw new ApiError("not_found", "Invitation not found");
  if (scope.contactId !== contactId) throw new ApiError("forbidden", "This invitation does not belong to you");
  if (!canTransitionInvite(scope.inviteStatus)) {
    throw new ApiError("invalid", "This invitation has already been responded to");
  }

  const body = await c.req.parseBody();
  const action = body["action"];
  if (action !== "accept" && action !== "decline") {
    throw new ApiError("invalid", "action must be 'accept' or 'decline'", { action: "Invalid value" });
  }

  const nextStatus = nextInviteStatus(action as InviteAction);
  await setInviteStatus(c.var.db, participantId, contactId, nextStatus, scope.submissionId);

  // DEC-278: accepting an invitation on a submission that is ALREADY
  // 'accepted' never re-fires updateSubmissionStatuses' fireAcceptance
  // branch (that only fires once, at the original accept transition), so
  // this speaker would otherwise never get onboarding tasks planned. Never
  // sends email on this path (product principle 4).
  if (nextStatus === "accepted") {
    const submissionInfo = await getSubmissionStatusForParticipant(c.var.db, participantId);
    if (submissionInfo && submissionInfo.status === "accepted") {
      await ensureOnboardingTasks(c.var.db, submissionInfo.eventId, submissionInfo.submissionId, [contactId], new Date());
    }
  }

  return c.redirect("/portal", 302);
});
