// Speaker submission editing (J2/CFP-06, DEC-041): edit until close date,
// accepted speakers keep editing, server-side edit lock (never trust the
// hidden form). Route files export a named Hono sub-app; only src/index.ts
// mounts it (DEC-012).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { speakerGate, PortalLayout, PortalBackLink, portalNotFound } from "./shared";
import { PublicEmptyState } from "../public/empty-state";
import { csrfForm } from "../../server/middleware";
import { ApiError } from "../../server/http";
import {
  assertSpeakerContactId,
  getPortalData,
} from "../../server/repo/portal";
import {
  loadEditableSubmission,
  saveSubmissionEdits,
  getAllSubmissionParticipants,
  addCoPresenter,
  CO_PRESENTER_DUPLICATE_MESSAGE,
  CO_PRESENTER_UNSAVED_MESSAGE,
  type EditableSubmissionData,
  type PortalParticipant,
} from "../../server/repo/portal-edit";
import { INVITE_STATUS_LABELS } from "../../domain/invite-status";
import { formatEventDate } from "../../lib/event-time";
import { dayLabelEndInstant } from "../../lib/timezone";
import { canEditSubmission, canEditTracks } from "../../domain/edit-lock";
import { sessionAccessFor } from "./home";
import { LOCKED_SESSION_FIELDS } from "../../forms/types";
import { validateAnswers, MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from "../../forms/validate";
import { makeVisibilityPredicate } from "../../forms/visibility";
import type { AnswerMap } from "../../forms/types";
import { lockedFieldName } from "../../forms/types";
import { FormFieldsSection, FieldRulesScript, fieldInputName } from "../../views/form-render";
import {
  parseCookies,
  newCsrfToken,
  buildCsrfCookie,
  isSecureRequest,
  CSRF_COOKIE_NAME,
} from "../../auth/cookies";
import { DEC_029, DEC_041, DEC_074, DEC_109, DEC_121, DEC_604, DEC_777 } from "../../decisions";
import { sessionFormatLabel } from "../../lib/session-vocabulary";
import { validateTrackChoice, readSingleFormValue, REPEATED_ANSWER_MESSAGE } from "../../lib/submit-core";
import { CO_PRESENTER_ROLE_VALUES, PARTICIPANT_ROLE_OPTIONS } from "../../domain/participant-roles";
// DEC-598 (wave-10 amendment): trackIds dedupe has ONE owner (public
// submit-body's extractTrackIds) — the private copy that used to live here
// is deleted, not re-implemented.
import { extractTrackIds } from "../public/submit-body";

export const portalEditRoutes = new Hono<AppEnv>();

// touch DEC constant so the dependency is compile-checked (field guide convention)
void DEC_029;
void DEC_041;
void DEC_074;
void DEC_109;
void DEC_121;
void DEC_604;
void DEC_777;

portalEditRoutes.use("*", speakerGate);

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

// DEC-422/DEC-598 (wave-10 amendment): a repeated `field_<id>` part is
// refused (never merged into "a,b") — see submit-body.ts's extractAnswers
// for the same treatment on the public CFP door.
export function extractAnswers(
  fields: EditableSubmissionData["fields"],
  body: Record<string, unknown>,
  storedAnswers: AnswerMap,
): { answers: AnswerMap; repeatedFieldIds: string[] } {
  const answers: AnswerMap = {};
  const repeatedFieldIds: string[] = [];
  for (const field of fields) {
    const name = fieldInputName(field.id);
    if (field.kind === "checkbox") {
      answers[field.id] = body[name] !== undefined;
      continue;
    }
    if (field.kind === "file") {
      // File-kind answers are shown read-only per DEC-041 — the current
      // filename is displayed but never re-submitted or re-validated here.
      // Never read file inputs from body; carry over the stored answer
      // (if any) so validation sees the existing file (DEC-109).
      const stored = storedAnswers[field.id];
      if (typeof stored === "string" && stored.length > 0) {
        answers[field.id] = stored;
      }
      continue;
    }
    if (lockedFieldName(field.id) === "email") {
      // DEC-121: email is locked/read-only in the edit form — never read a
      // body-supplied field__email (a client could post one anyway), always
      // carry over the contact-sourced stored answer so required-validation
      // passes and the value can never be spoofed here.
      const stored = storedAnswers[field.id];
      if (typeof stored === "string" && stored.length > 0) {
        answers[field.id] = stored;
      }
      continue;
    }
    const raw = body[name];
    const result = readSingleFormValue(raw);
    if (!result.ok) {
      repeatedFieldIds.push(field.id);
      continue;
    }
    if (result.value === undefined) continue;
    answers[field.id] = result.value;
  }
  return { answers, repeatedFieldIds };
}

// Exported so a render-parity test (DEC-696) can assert the track fieldset
// uses the same option-class vocabulary and copy as the public CFP form's
// TrackChoices (src/routes/public/submit-views.tsx) without going through a
// full HTTP round trip.
export function EditPage(props: {
  branding: { eventName: string; welcomeMessage: string | null; accentColor: string | null; logoUrl: string | null };
  submissionId: string;
  data: EditableSubmissionData;
  answers: AnswerMap;
  selectedTrackIds: string[];
  csrfToken: string;
  errors?: Record<string, string>;
  trackError?: string;
  editable: boolean;
  tracksEditable: boolean;
  participants: PortalParticipant[];
  participantErrors?: Record<string, string>;
  participantValues?: { firstName: string; lastName: string; email: string; role: string };
  speakerName: string;
}) {
  const { data, answers, selectedTrackIds, csrfToken, errors, trackError, editable, tracksEditable, participants, participantErrors, participantValues, speakerName } = props;
  if (!editable) {
    return (
      <PortalLayout branding={props.branding} csrfToken={csrfToken} speakerName={speakerName}>
        <PortalBackLink to={`/portal/submissions/${props.submissionId}`} />
        <h1 class="chq-portal-hero chq-portal-hero-drill">Editing closed</h1>
        <p role="alert">
          This submission can no longer be edited — the form's submission window has closed.
        </p>
      </PortalLayout>
    );
  }
  const offeredTracks = data.allTracks.filter((t) => data.offeredTrackIds.includes(t.id));
  // DEC-532: one predicate built from the FULL field list (a session field
  // can gate a speaker field), shared by both sections below.
  const isVisible = makeVisibilityPredicate(data.fields, answers);
  // DEC-041 (wave-117 amendment): every file field renders read-only here --
  // extractAnswers never reads a file part from the body, so the picker
  // must never be offered either. Passed to both FormFieldsSection calls
  // below.
  const readOnlyFileIds = data.fields.filter((f) => f.kind === "file").map((f) => f.id);
  // DEC-576 (w8-g): the 390 frame's pinned action band at
  // docs/design/Chautauqua Public and Portal.dc.html:667-672
  // `flex-shrink:0; border-top:1px solid #1B1D17` is a SECOND
  // copy of the same Save/Cancel/note trio, routed through PortalLayout's
  // dock slot (the real .chq-portal-footer band the two sibling portal
  // screens already reach) instead of letting the frame's band scroll away
  // inside .chq-measure with the rest of the page. portal.css.ts hides this
  // copy at top level and reveals it (while hiding the in-flow
  // .chq-portal-actions-footer copy below) only inside the phone media
  // block, so exactly one copy is ever visible -- never a second tap
  // target for one act.
  const editDock = (
    <div class="chq-portal-edit-dock">
      <div class="chq-portal-edit-dock-buttons">
        <button type="submit" form="chq-portal-edit-form" class="chq-btn chq-btn-primary">Save changes</button>
        <a class="chq-btn chq-btn-secondary" href={`/portal/submissions/${props.submissionId}`}>
          Cancel
        </a>
      </div>
      <span class="chq-portal-actions-note">Title and abstract show on the public pages · co-presenters do not</span>
    </div>
  );
  return (
    <PortalLayout branding={props.branding} csrfToken={csrfToken} speakerName={speakerName} dock={editDock}>
      <PortalBackLink to={`/portal/submissions/${props.submissionId}`} />
      {/* G13 (frames 10--09/22/23): the frames title this page 'Edit your
          session' at both widths. */}
      {/* w3-b (DEC-643 amendment): back-linked drill-in -> 25px phone
          register, docs/design/Chautauqua Public and Portal.dc.html:603.
          `font-size:25px; font-weight:700; letter-spacing:-0.04em` */}
      <h1 class="chq-portal-hero chq-portal-hero-drill">Edit your session</h1>
      {/* DEC-604 (wave-56 amendment): the window is the FORM's close date,
          not acceptance — canEditSubmission gates on it, so the header
          states the deadline the speaker is actually working against.
          Omitted entirely (never a synthesized date) when the form has no
          close date. Replaces the earlier "Edits are live on the public
          pages straight away" sub-line, which contradicted the
          Participants section's "not yet published" fact on the same
          screen.
          D8 (eval MAJOR): closeDate is a DEC-522 UTC-midnight DAY LABEL,
          not an instant, so it is expanded through dayLabelEndInstant
          before formatting -- exactly the idiom submit-views.tsx:126 and
          sessions.tsx:107 already use, and the failure mode
          formatEventCloseDateLabel's docstring (src/lib/event-time.ts:250)
          names: formatting the raw label in a zone west of UTC resolves to
          the PREVIOUS calendar day, so this screen printed one date and
          the public confirmation page printed another for the same form.
          DEC-041 (wave-46 amendment): the sentence is branched on
          tracksEditable -- the SAME lock-state boolean the Tracks section
          below already derives from canEditTracks -- not on closeDate
          alone. An accepted speaker's canEditSubmission stays true past
          the close date while canEditTracks does not, so closeDate !==
          null is no longer sufficient to say the deadline is still live:
          it can be a CLOSED deadline the accepted exception is still
          honouring. Never a second date comparison here; dayLabelEndInstant
          stays on every closeDate-bearing branch for the same D8 reason. */}
      {data.form.closeDate !== null ? (
        <p class="chq-portal-sub">
          {tracksEditable ? (
            <>
              You can change this until the form closes on{" "}
              {formatEventDate(dayLabelEndInstant(data.form.closeDate, data.form.timezone), data.form.timezone)}
            </>
          ) : (
            <>
              The form closed on{" "}
              {formatEventDate(dayLabelEndInstant(data.form.closeDate, data.form.timezone), data.form.timezone)}, and
              an accepted speaker can still edit this.
            </>
          )}
        </p>
      ) : null}
      {/* DEC-041 (wave-117 amendment): this form's FormFieldsSection calls
          below now render kind='file' fields read-only (a filename readout,
          no <input type=file>) via readOnlyFileIds, matching what
          extractAnswers above has always done -- never reads a file part
          from the body, always carries the stored answer over. enctype is
          kept regardless: the participants POST at :447-454 shares this
          form via `formenctype` and still needs it. */}
      <form id="chq-portal-edit-form" method="post" action={`/portal/submissions/${props.submissionId}/edit`} enctype="multipart/form-data">
        <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
        <div class="chq-section-label">Session</div>
        <FormFieldsSection fields={data.fields} section="session" answers={answers} errors={errors} isVisible={isVisible} readOnlyFileIds={readOnlyFileIds} />
        {tracksEditable ? (
          <fieldset class="chq-cfp-fieldset">
            <legend>Tracks</legend>
            <p class="help">Choose all that apply.</p>
            {offeredTracks.map((track) => (
              <label class="chq-cfp-option">
                <input type="checkbox" name="trackIds" value={track.id} checked={selectedTrackIds.includes(track.id)} />
                {track.name}
              </label>
            ))}
            {trackError ? (
              <p role="alert" class="chq-field-error">
                {trackError}
              </p>
            ) : null}
          </fieldset>
        ) : (
          <p class="chq-portal-sub">
            Tracks: {data.allTracks.filter((t) => selectedTrackIds.includes(t.id)).map((t) => t.name).join(", ") || "None"}{" "}
            (editing closed)
          </p>
        )}
        <div class="chq-section-label">Speaker</div>
        <FormFieldsSection
          fields={data.fields.filter((f) => lockedFieldName(f.id) !== "email")}
          section="speaker"
          answers={answers}
          errors={errors}
          isVisible={isVisible}
          readOnlyFileIds={readOnlyFileIds}
        />
        {data.fields
          .filter((f) => lockedFieldName(f.id) === "email")
          .map((f) => (
            <p class="chq-portal-sub">
              Email: {String(answers[f.id] ?? "")} (read-only)
            </p>
          ))}
      </form>
      <FieldRulesScript fields={data.fields} />
      {/* DEC-777 (wave-148 amendment): docs/design/Chautauqua Public and
          Portal.dc.html:620 `Talk, 30 min · set by the organisers` (390)
          / :1405 (desktop) draw a read-only "Session length" row between
          the Session/Speaker fields and the participants list. The
          format answer comes through data.formatLabel
          (loadEditableSubmission's answerFieldRoleCondition('session_format')
          read, src/server/repo/review/submissions.ts's own predicate) and the SAME
          sessionFormatLabel vocabulary (DEC-908) every other reader uses --
          never a second '(N min)' parser. When there is no session_format
          answer, or its stored label carries no parseable duration (so
          sessionFormatLabel would hand back the raw label unchanged), the
          whole row is omitted -- never an empty box, never a fabricated
          default (DEC-895). Reuses this page's own established read-only-
          field idiom (chq-section-label + chq-portal-sub, the same pair the
          tracks-closed and email-readonly rows above already use) --
          portal.css.ts (the frame's bordered/tinted box) is owned by
          another lane this batch (w4-ap). */}
      {data.formatLabel !== null && sessionFormatLabel(data.formatLabel) !== data.formatLabel ? (
        <>
          <div class="chq-section-label">Session length</div>
          <p class="chq-portal-sub">{sessionFormatLabel(data.formatLabel)} · set by the organisers</p>
        </>
      ) : null}
      <ParticipantsSection
        submissionId={props.submissionId}
        participants={participants}
        errors={participantErrors}
        values={participantValues}
      />
      {/* G13 (frames 10--09/23, MAJOR): the Save/Cancel row is the page's
          TERMINAL element -- below the co-presenter block, never 65px above
          a section the speaker must still fill in -- preceded by a 1px rule
          and carrying the consequence line the frame draws. The submit
          stays bound to the edit form via the form attribute (the
          participants section carries its own form between the two). */}
      <div class="chq-portal-actions-footer">
        <span class="chq-portal-actions-note">Title and abstract show on the public pages · co-presenters do not</span>
        <div class="chq-portal-actions">
          <a class="chq-btn chq-btn-secondary" href={`/portal/submissions/${props.submissionId}`}>
            Cancel
          </a>
          <button type="submit" form="chq-portal-edit-form" class="chq-btn chq-btn-primary">Save changes</button>
        </div>
      </div>
    </PortalLayout>
  );
}

// DEC-604: a speaker may self-add a co-presenter to their own submission.
// Resolution against the org's contacts and the invite-free write are
// server-side only (src/server/repo/portal-edit.ts:addCoPresenter) — this
// component is presentation only.
function ParticipantsSection(props: {
  submissionId: string;
  participants: PortalParticipant[];
  errors?: Record<string, string>;
  values?: { firstName: string; lastName: string; email: string; role: string };
}) {
  const { submissionId, participants, errors, values } = props;
  // DEC-604 (wave-56 amendment): the unique index on the join table is the
  // duplicate arbiter (migrations/0019) — the client cannot pre-empt it, so
  // only THIS specific server-only rejection gets the "standard error
  // shape" banner (DESIGN-RULINGS.md rule 12 + the Speaker portal section).
  // A plain field-validation error (missing name, bad email format) stays a
  // bare inline field message, never a banner naming a "did not happen".
  const isDuplicate = errors?.email === CO_PRESENTER_DUPLICATE_MESSAGE;
  // DEC-029 (wave-30 amendment): the page's primary Save refuses (rather
  // than saving-and-dropping) when a co-presenter was typed but never
  // submitted via Add co-presenter — same "who did NOT happen" banner
  // register as the duplicate case above, distinct wording, same
  // errors.email carrier so no second field-error channel is invented.
  const isUnsaved = errors?.email === CO_PRESENTER_UNSAVED_MESSAGE;
  // v12m-w5-a (docs/design/Chautauqua Public and Portal.dc.html:1314):
  // `Priya is already on this session. Everything you typed is still below.`
  // the 390 frame's callout names the person already on the session instead of
  // repeating the raw server message a second time — that message still
  // renders once, unchanged, at the email field below (dc.html:1349).
  // Matched by email against the participants the caller already loaded;
  // no server call, no server text touched.
  const duplicateMatch = isDuplicate
    ? participants.find((p) => p.email.toLowerCase() === (values?.email ?? "").toLowerCase())
    : undefined;
  return (
    <section aria-label="Participants" class="chq-section">
      {/* G13 (frames 10--09/22/23): 'ON THIS SESSION' with the count
          right-flushed against the measure -- never a bare 'PARTICIPANTS'
          with no count. */}
      <div class="chq-section-label chq-portal-session-label">
        <span>On this session</span>
        <span class="chq-portal-session-count">{participants.length}</span>
      </div>
      {isDuplicate ? (
        <div class="chq-error-summary chq-portal-copresenter-notice" role="alert">
          <h2>Nobody was added</h2>
          <p>{duplicateMatch ? duplicateMatch.name : "This person"} is already on this session. Everything you typed is still below.</p>
        </div>
      ) : null}
      {isUnsaved ? (
        <div class="chq-error-summary chq-portal-copresenter-notice" role="alert">
          <h2>Nothing was saved</h2>
          <p>{CO_PRESENTER_UNSAVED_MESSAGE} Everything you typed is still below.</p>
        </div>
      ) : null}
      {participants.length === 0 ? (
        <PublicEmptyState
          variant="fresh"
          what="No participants yet."
          reason="Anyone presenting this session with you appears here."
        />
      ) : (
        // G13 (frames 10--09/22/23, MAJOR): ruled rows, never a UA-bulleted
        // list -- name flush left, role as a right-side micro-label, a 1px
        // hairline per row (portal.css.ts).
        <ul class="chq-portal-participants">
          {participants.map((p) =>
            // Wave-55 (w55-g, DESIGN-RULINGS.md:301 "list is what a speaker
            // checks before typing"): a declined co-presenter is a FACT the
            // speaker must see here -- it is invisible to
            // getPortalParticipants (DEC-317 access filter) but still
            // counts toward the cap and still collides on re-add
            // (CO_PRESENTER_DUPLICATE_MESSAGE) -- so it is drawn with its
            // status and no action, never omitted and never actionable.
            p.inviteStatus === "declined" ? (
              <li class="chq-portal-participant-row">
                <span class="chq-portal-participant-name">{p.name}</span>
                <span class="chq-flag">{INVITE_STATUS_LABELS.declined}</span>
              </li>
            ) : (
              <li class="chq-portal-participant-row">
                <span class="chq-portal-participant-name">{p.name}</span>
                <span class="chq-flag">{p.roleLabel}</span>
                {!p.visible ? (
                  <span class="chq-portal-sub chq-portal-participant-sub">Not yet on the public site. Your organiser publishes co-presenters.</span>
                ) : null}
              </li>
            ),
          )}
        </ul>
      )}
      {/* G13 (frames 10--09/23): the co-presenter block is a real section --
          same 2px-ruled label register as the section heads above it (it was
          the one section head on the page without a rule) -- and the note
          carries the frame's wording, which states the immediacy. */}
      <h3 class="chq-section-label">Add a co-presenter</h3>
      <p class="chq-portal-sub">
        Adding them puts a row in the list above straight away. No email goes to them — tell them yourself, and
        your organiser decides when co-presenters appear on the public site.
      </p>
      {/* DEC-029 (wave-108 amendment): this is a SECOND SUBMIT of
          #chq-portal-edit-form, not a second form -- every control below
          joins the edit form via the `form` attribute (the same idiom
          Save changes already uses at :269) so the speaker's in-progress
          title/abstract/track edits ride along on this submit too, instead
          of being lost to a bare re-render of the stored answers. This
          wrapper is now a plain container: it holds no form of its own,
          submits nothing itself, and carries no hidden CSRF input --
          #chq-portal-edit-form already carries one. */}
      <div class="chq-portal-copresenter-fields">
        {/* DEC-604 (wave-56 amendment, B10 form spec): first/last name are
            read as one thing, so the wide 1600 frame pairs them two-up.
            portal.css.ts reaches that without a min-width media query
            (test/breakpoint-conformance.test.ts's DEC-385 scan forbids
            one) -- flex-wrap with a flex-basis floor, so the pair sits
            side by side once there's room and wraps to a stack at the
            portal's narrower default/phone widths. */}
        <div class="chq-portal-copresenter-names">
          <div class="chq-field">
            <label class="chq-portal-field-label" for="cp-first-name">
              First name
            </label>
            <input id="cp-first-name" form="chq-portal-edit-form" class="chq-input" type="text" name="firstName" value={values?.firstName ?? ""} maxLength={MAX_NAME_LENGTH} />
            {errors?.firstName ? (
              <p role="alert" class="chq-field-error">
                {errors.firstName}
              </p>
            ) : null}
          </div>
          <div class="chq-field">
            <label class="chq-portal-field-label" for="cp-last-name">
              Last name
            </label>
            <input id="cp-last-name" form="chq-portal-edit-form" class="chq-input" type="text" name="lastName" value={values?.lastName ?? ""} maxLength={MAX_NAME_LENGTH} />
            {errors?.lastName ? (
              <p role="alert" class="chq-field-error">
                {errors.lastName}
              </p>
            ) : null}
          </div>
        </div>
        {/* DEC-604 (wave-56 amendment, B10 form spec): email pairs with a
            190px-wide role select once there's room, same intrinsic
            flex-wrap technique as the name pair above. */}
        <div class="chq-portal-copresenter-email-role">
          <div class="chq-field">
            <label class="chq-portal-field-label" for="cp-email">
              Email
            </label>
            <input
              id="cp-email"
              form="chq-portal-edit-form"
              class={isDuplicate ? "chq-input chq-portal-copresenter-email-flagged" : "chq-input"}
              type="email"
              name="email"
              value={values?.email ?? ""}
              maxLength={MAX_TEXT_LENGTH}
            />
            {/* G13 (frame 10--23, MINOR): the one place the form says the
                email resolves against the org's contacts rather than
                creating a stranger. */}
            <p class="help">Matches an existing contact if we have one</p>
            {errors?.email ? (
              <p role="alert" class="chq-field-error">
                {errors.email}
              </p>
            ) : null}
          </div>
          {/* G13 (frames 10--22/23, MAJOR): chq-field gives the ROLE wrapper
              the same label-above-control stacking its three siblings get --
              as a bare div its label rendered inline and shoved the select
              off the shared row. */}
          <div class="chq-field chq-portal-copresenter-role">
            <label class="chq-portal-field-label" for="cp-role">
              Role
            </label>
            <select id="cp-role" form="chq-portal-edit-form" name="role">
              {PARTICIPANT_ROLE_OPTIONS.filter((o) => CO_PRESENTER_ROLE_VALUES.includes(o.value)).map((o) => (
                <option value={o.value} selected={(values?.role ?? CO_PRESENTER_ROLE_VALUES[0]) === o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {errors?.role ? (
          <p role="alert" class="chq-field-error">
            {errors.role}
          </p>
        ) : null}
        {/* DEC-604 (wave-56 amendment): left-aligned at its natural width,
            never .chq-portal-actions' right-flush row — adding a
            co-presenter is an aside within the edit screen, whose primary
            action stays Save changes above. */}
        <div class="chq-portal-copresenter-submit">
          {/* DEC-029 (wave-108 amendment): a second submit of
              #chq-portal-edit-form, routed to the participants endpoint via
              formaction/formenctype -- never a `required` attribute on any
              of the four controls above, so this addition can never block
              the page's primary Save (the DEC-986 class). */}
          <button
            type="submit"
            form="chq-portal-edit-form"
            formaction={`/portal/submissions/${submissionId}/participants`}
            formenctype="multipart/form-data"
            class="chq-btn chq-btn-secondary"
          >
            Add co-presenter
          </button>
        </div>
      </div>
    </section>
  );
}

portalEditRoutes.get("/submissions/:id/edit", async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const submissionId = c.req.param("id");
  const data = await loadEditableSubmission(c.var.db, auth.orgId, contactId, submissionId);
  if (!data) return portalNotFound(c);

  // multi-portal: a portal can turn editing off for a participation
  const access = await sessionAccessFor(c.var.db, contactId, auth.orgId, submissionId);
  const editable = access.editSubmission && canEditSubmission(data.submission.status, data.form.closeDate, Date.now(), data.form.timezone);
  const tracksEditable = canEditTracks(data.form.closeDate, Date.now(), data.form.timezone);
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
  const portalData = await getPortalData(c.var.db, contactId, auth.orgId);
  const participants = await getAllSubmissionParticipants(c.var.db, submissionId);

  return c.html(
    <EditPage
      branding={portalData.branding}
      submissionId={submissionId}
      data={data}
      answers={data.answers}
      selectedTrackIds={data.selectedTrackIds}
      csrfToken={csrfToken}
      editable={editable}
      tracksEditable={tracksEditable}
      participants={participants}
      speakerName={portalData.contactName}
    />,
  );
});

portalEditRoutes.post("/submissions/:id/edit", csrfForm, async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const submissionId = c.req.param("id");
  const data = await loadEditableSubmission(c.var.db, auth.orgId, contactId, submissionId);
  if (!data) return portalNotFound(c);

  // Server-side re-check — never trust the hidden form (DEC-041): a client
  // could POST here after the window closes even if the GET rendered the
  // read-only notice.
  const access = await sessionAccessFor(c.var.db, contactId, auth.orgId, submissionId);
  const editable = access.editSubmission && canEditSubmission(data.submission.status, data.form.closeDate, Date.now(), data.form.timezone);
  if (!editable) {
    throw new ApiError("forbidden", "This submission can no longer be edited");
  }
  const tracksEditable = canEditTracks(data.form.closeDate, Date.now(), data.form.timezone);

  const body = (await c.req.parseBody({ all: true })) as Record<string, unknown>;
  const { answers, repeatedFieldIds } = extractAnswers(data.fields, body, data.answers);
  // multi-portal: a session field a portal locks keeps its stored value
  if (access.sessionTitle.level !== "edit") answers[LOCKED_SESSION_FIELDS[0]] = data.answers[LOCKED_SESSION_FIELDS[0]] ?? data.submission.title;
  if (access.abstract.level !== "edit") answers[LOCKED_SESSION_FIELDS[1]] = data.answers[LOCKED_SESSION_FIELDS[1]] ?? (data.submission.description ?? "");

  // DEC-029 (wave-30 amendment): the four co-presenter controls join THIS
  // form via form="chq-portal-edit-form" (verified src/routes/portal/edit.tsx
  // :417/:428/:446/:471), but this handler never reads their names — a
  // speaker who types a co-presenter and presses the page's primary Save
  // must be refused with a named message, never saved-and-silently-dropped.
  // Read with the SAME idiom the participants POST handler below uses
  // (typeof body.<name> === "string" ? body.<name> : ""), never a second
  // parser. Threaded into every 400 re-render on this route so a rejection
  // never blanks what the speaker typed into these fields.
  const cpFirstName = typeof body.firstName === "string" ? body.firstName : "";
  const cpLastName = typeof body.lastName === "string" ? body.lastName : "";
  const cpEmail = typeof body.email === "string" ? body.email : "";
  const cpRole = typeof body.role === "string" ? body.role : "";
  const participantValues = { firstName: cpFirstName, lastName: cpLastName, email: cpEmail, role: cpRole };
  // Never a `required` attribute on any of the four controls (DEC-029
  // wave-108 clause, unamended) — the refusal below is a message, not a
  // blocker on the primary Save's ordinary field validation.
  const hasUnsavedCoPresenter = cpFirstName.trim() !== "" || cpLastName.trim() !== "" || cpEmail.trim() !== "";
  // File fields are read-only here (DEC-041): a missing stored file answer
  // must never be fatal, so required is forced false for file fields only.
  // Public submit's validateAnswers still enforces required files.
  const validation = validateAnswers(
    data.fields.map((f) => (f.kind === "file" ? { ...f, required: false } : f)),
    answers,
  );

  // DEC-598 (wave-10 amendment): extractTrackIds (public submit-body's ONE
  // owner) already dedupes — the `Array.from(new Set(...))` crutch this line
  // used to mask the missing dedupe with is gone.
  const selectedTrackIds = tracksEditable ? extractTrackIds(body) : data.selectedTrackIds;
  let trackError: string | undefined;
  if (tracksEditable) {
    const trackResult = validateTrackChoice(selectedTrackIds, data.offeredTrackIds);
    if (!trackResult.ok) trackError = trackResult.error;
  }

  if (!validation.ok || trackError || repeatedFieldIds.length > 0 || hasUnsavedCoPresenter) {
    const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
    if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
    const portalData = await getPortalData(c.var.db, contactId, auth.orgId);
    const participants = await getAllSubmissionParticipants(c.var.db, submissionId);
    // DEC-422/DEC-598 (wave-10 amendment): a repeated field is refused with
    // the shared house-voice message, merged alongside any other
    // per-field validation errors.
    const mergedErrors = { ...(validation.ok ? {} : validation.errors) };
    for (const fieldId of repeatedFieldIds) mergedErrors[fieldId] = REPEATED_ANSWER_MESSAGE;
    // DEC-029 (wave-30 amendment): the co-presenter refusal is a SEPARATE
    // error channel (participantErrors, the same one the participants POST
    // handler below already uses) from the session/speaker field errors
    // above — never merged into mergedErrors, which key against
    // data.fields ids.
    const participantErrors = hasUnsavedCoPresenter ? { email: CO_PRESENTER_UNSAVED_MESSAGE } : undefined;
    return c.html(
      <EditPage
        branding={portalData.branding}
        submissionId={submissionId}
        data={data}
        answers={answers}
        selectedTrackIds={selectedTrackIds}
        csrfToken={csrfToken}
        errors={mergedErrors}
        trackError={trackError}
        editable={true}
        tracksEditable={tracksEditable}
        participants={participants}
        participantErrors={participantErrors}
        participantValues={participantValues}
        speakerName={portalData.contactName}
      />,
      400,
    );
  }

  await saveSubmissionEdits(
    c.var.db,
    submissionId,
    contactId,
    validation.cleaned,
    tracksEditable ? selectedTrackIds : null,
    validation.hiddenFieldIds,
    validation.clearedFieldIds,
  );
  return c.redirect(`/portal/submissions/${submissionId}`, 302);
});

interface AddCoPresenterBody {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  role?: unknown;
}

// POST /portal/submissions/:id/participants — DEC-604: a speaker self-adds
// a co-presenter to their own submission. Nothing here sends email; the
// page states that the co-presenter is recorded but not notified.
portalEditRoutes.post("/submissions/:id/participants", csrfForm, async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const submissionId = c.req.param("id");
  const data = await loadEditableSubmission(c.var.db, auth.orgId, contactId, submissionId);
  if (!data) return portalNotFound(c);

  // Server-side re-check — never trust the hidden form (DEC-041/DEC-604): a
  // client could POST here after the edit window closes.
  const access = await sessionAccessFor(c.var.db, contactId, auth.orgId, submissionId);
  const editable = access.editSubmission && canEditSubmission(data.submission.status, data.form.closeDate, Date.now(), data.form.timezone);
  if (!editable) {
    throw new ApiError("forbidden", "This submission can no longer be edited");
  }
  // multi-portal: adding co-presenters is a portal action of its own
  if (!access.addCoPresenters) {
    throw new ApiError("forbidden", "Co-presenters for this session are added by the organizers");
  }
  const tracksEditable = canEditTracks(data.form.closeDate, Date.now(), data.form.timezone);

  const body = (await c.req.parseBody({ all: true })) as Record<string, unknown> & AddCoPresenterBody;
  const firstName = typeof body.firstName === "string" ? body.firstName : "";
  const lastName = typeof body.lastName === "string" ? body.lastName : "";
  const email = typeof body.email === "string" ? body.email : "";
  const role = typeof body.role === "string" ? body.role : "";

  // DEC-029 (wave-108 amendment): this is a second submit of the ONE edit
  // form, so the request body also carries the speaker's in-progress
  // title/abstract/track answers -- extracted with the SAME reader the edit
  // POST uses (extractAnswers above), never a second parser, so both the
  // refusal and success renders below echo what was actually typed instead
  // of falling back to data.answers from the database.
  const { answers } = extractAnswers(data.fields, body, data.answers);

  // DEC-029 (wave-114 amendment): the same second-submit body also carries
  // the trackIds checkboxes when tracksEditable, so echo the typed
  // selection with the SAME one owner the edit POST uses at :524
  // (extractTrackIds from ../public/submit-body) instead of the DB value --
  // otherwise a re-pick of tracks silently reverts on this route.
  const selectedTrackIds = tracksEditable ? extractTrackIds(body) : data.selectedTrackIds;

  const result = await addCoPresenter(c.var.db, {
    submissionId,
    orgId: auth.orgId,
    firstName,
    lastName,
    email,
    role,
  });

  if (!result.ok) {
    const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
    if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
    const portalData = await getPortalData(c.var.db, contactId, auth.orgId);
    const participants = await getAllSubmissionParticipants(c.var.db, submissionId);
    return c.html(
      <EditPage
        branding={portalData.branding}
        submissionId={submissionId}
        data={data}
        answers={answers}
        selectedTrackIds={selectedTrackIds}
        csrfToken={csrfToken}
        editable={true}
        tracksEditable={tracksEditable}
        participants={participants}
        participantErrors={result.errors}
        participantValues={{ firstName, lastName, email, role }}
        speakerName={portalData.contactName}
      />,
      400,
    );
  }

  // DEC-029 (wave-108 amendment): success renders the edit page directly at
  // 200, carrying the same posted answers and the freshly-added participant
  // -- a redirect here is what discarded the draft on the common path, and
  // Save changes (not this route) stays the only thing that persists an
  // answer edit.
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
  const portalData = await getPortalData(c.var.db, contactId, auth.orgId);
  const participants = await getAllSubmissionParticipants(c.var.db, submissionId);
  return c.html(
    <EditPage
      branding={portalData.branding}
      submissionId={submissionId}
      data={data}
      answers={answers}
      selectedTrackIds={selectedTrackIds}
      csrfToken={csrfToken}
      editable={true}
      tracksEditable={tracksEditable}
      participants={participants}
      speakerName={portalData.contactName}
    />,
    200,
  );
});
