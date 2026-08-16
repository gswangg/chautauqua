// SSR view components for the public CFP submit flow
// (src/routes/public/submit.tsx). Split out of submit.tsx purely to reduce
// merge contention on that file — no behavior change. DEC-005 (share link +
// submit page), DEC-098 (claim-link visibility states), DEC-245 (draft-saved
// notice vs. draft-resume banner), DEC-301/DEC-416 (empty track offer),
// DEC-321 (optional speaker profile fields), DEC-371/DEC-374 (shared theme
// CSS + validated accent), DEC-377 (no delivery-window promise in the
// confirmation copy).

import type { AnswerMap, FormFieldDef } from "../../forms/types";
import { lockedFieldName } from "../../forms/types";
import { makeVisibilityPredicate } from "../../forms/visibility";
import { formatEventDateTime } from "../../lib/event-time";
import { dayLabelEndInstant, dayLabelStartInstant } from "../../lib/timezone";
import { FormFieldsSection, FieldRulesScript, fieldInputName, FormField } from "../../views/form-render";
import { countOf, thingsNeedFixingHeading } from "../../domain/count-copy";
import { ThemeStyles } from "../../views/theme";
import { CFP_CSS } from "./cfp.css";
import { CfpStepsScript } from "./cfp-steps-script";
import { eventDatesLine, validAccent } from "./shell";
import { CSRF_COOKIE_NAME } from "../../auth/cookies";
import type { EventRow, FormRow, TrackRow } from "../../server/repo/submit";
import { parseEventBranding, type EventBranding } from "../../domain/event-branding";
import { DEC_322 } from "../../decisions";

void DEC_322;

// w5-c (frame 10--14 copy batch): the bio field's caption is a display-only
// override applied to the locked bio FormFieldDef at render time -- the
// field's real `label` is stored differently in the DB. The abstract
// field's 1,200-character budget is NOT display-only: it is stamped by
// projectFieldForAnswers (src/forms/types.ts, DEC-124 wave 59 amendment)
// onto the real `fields` list and enforced by src/forms/validate.ts, so the
// "x / y" counter here reflects the real, server-enforced `maximum`.
const CFP_ABSTRACT_HELP_TEXT = "Shown on the public sessions page if your talk is accepted";
const CFP_BIO_LABEL = "Bio";
const CFP_BIO_HELP_TEXT = "Shown on the public speakers page if your talk is accepted";
// DEC-124: the email field's helper states the invisible cost of a typo --
// the portal link is emailed there and nowhere else is shown on screen.
const CFP_EMAIL_HELP_TEXT = "We send your portal link here, so a typo means you never get it";
// DEC-124: id anchored by the top-of-form error summary for the track
// radio group, which has no FormFieldDef/field id of its own to key off.
export const TRACK_CHOICES_ID = "chq-cfp-track-choices";

// DEC-322 wave-78 amendment: the one parser for event.branding_json lives in
// src/domain/event-branding.ts (parseEventBranding); this is a one-line
// forwarder so callers keep this surface's own `branding(event)` signature.
export function branding(event: EventRow): EventBranding {
  return parseEventBranding(event.brandingJson);
}

// DEC-371/DEC-374: THEME_CSS (tokens/resets, shared by every SSR surface)
// followed by this surface's own CFP_CSS, both inlined via
// dangerouslySetInnerHTML as value-free module constants -- never the
// ad-hoc per-page <style> template literal this used to be. The per-event
// accent is the one piece of request data involved, and it lands in a
// validated style ATTRIBUTE on <body>, never interpolated into either CSS
// string (DEC-374).
// DEC-986 (wave 40 amendment): `header`, when given, renders as a sibling of
// `<main class="chq-measure">` -- OUTSIDE the page's one root clamp -- so
// chrome (the CFP page's date·venue/wordmark/closes-line band) is genuinely
// full bleed while `children` (the reading column) stays constrained. Mirrors
// PublicShell's header/main split (src/routes/public/shell.tsx) rather than
// inventing a second pattern. Every other PageShell caller (ClosedPage/
// NotYetOpenPage/ConfirmationPage) omits `header` and is unchanged.
export function PageShell(props: { title: string; accentColor?: string; header?: unknown; children: unknown }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title}</title>
        <ThemeStyles />
        <style dangerouslySetInnerHTML={{ __html: CFP_CSS }} />
      </head>
      <body style={`--chq-brandable-accent: ${validAccent(props.accentColor)};`}>
        {props.header ? (props.header as any) : null}
        <main class="chq-measure">{props.children as any}</main>
      </body>
    </html>
  );
}

// DEC-366/DEC-377: the closed/not-yet-open copy is unchanged behavior, just
// re-skinned into the .chq-cfp-closed card frame from the design mock.
export function ClosedPage(props: { event: EventRow; form: FormRow }) {
  return (
    <PageShell title={`Submissions closed - ${props.event.name}`} accentColor={branding(props.event).accentColor}>
      <div class="chq-cfp-closed chq-bare-page">
        <span class="chq-cfp-meta">{props.event.name}</span>
        <h1 class="chq-pub-surface-title">The call for papers has closed</h1>
        <p role="alert" class="chq-cfp-closed-body">
          Submissions for this event closed on{" "}
          {formatEventDateTime(
            props.form.closeDate ? dayLabelEndInstant(props.form.closeDate, props.event.timezone) : 0,
            props.event.timezone,
          )}
          . Thanks for your
          interest — please reach out to the organizers directly if you have questions.
        </p>
        <div class="chq-cfp-links">
          {/* w5-c: frame copy for the CFP-closed dead-end. */}
          <a href={`/e/${props.event.slug}/sessions`}>Browse the sessions &rsaquo;</a>
          <a href="/">All events &rsaquo;</a>
        </div>
      </div>
    </PageShell>
  );
}

export function NotYetOpenPage(props: { event: EventRow; form: FormRow }) {
  return (
    <PageShell title={`Submissions not yet open - ${props.event.name}`} accentColor={branding(props.event).accentColor}>
      <div class="chq-cfp-closed chq-bare-page">
        <span class="chq-cfp-meta">{props.event.name}</span>
        <h1 class="chq-pub-surface-title">Submissions aren't open yet</h1>
        <p role="alert" class="chq-cfp-closed-body">
          Submissions open{" "}
          {formatEventDateTime(
            props.form.openDate ? dayLabelStartInstant(props.form.openDate, props.event.timezone) : 0,
            props.event.timezone,
          )}
          . Please check back then.
        </p>
        <div class="chq-cfp-links">
          <a href={`/e/${props.event.slug}/sessions`}>Browse the programme &rsaquo;</a>
          <a href="/">All events &rsaquo;</a>
        </div>
      </div>
    </PageShell>
  );
}

export function DraftBanner(props: { formId: string; savedAt: number; timeZone: string }) {
  return (
    <p role="status" class="chq-cfp-actions-note">
      Resuming your saved draft from {formatEventDateTime(props.savedAt, props.timeZone)}.
    </p>
  );
}

// DEC-245: the save-draft POST redirects to ?draft=saved so the browser's
// address bar and back/forward history reflect the saved state, and the
// GET handler renders this distinct notice above the form — separate from
// the DraftBanner shown when merely resuming an earlier draft.
export function DraftSavedNotice() {
  return (
    <p role="status" class="chq-cfp-actions-note">
      Draft saved — you can return later to finish and submit.
    </p>
  );
}

// DEC-986 (supersedes DEC-951's refusal, per the user's 2026-08-13 decision
// in docs/eval-findings.md): the public CFP picks ONE track. The truncation
// risk DEC-951 refused the v5 radio redraw over was never this create
// form's -- a brand-new submission has no prior tracks to lose -- it
// belonged to the EDIT form (src/routes/portal/edit.tsx), which keeps its
// checkbox group. Underneath, nothing moves: submission_track stays a join
// table, `trackIds` stays a repeating array field on the wire, and every
// server validation (src/lib/submit-core.ts) is untouched -- a radio group
// simply posts exactly one member of that same array. DEC-696's fieldset/
// option parity is about the chq-cfp-option chrome, not the input type, so
// the shared classes stay; only the caption differs from the edit surface's
// "Choose all that apply."
// w54-e: TrackChoices has no FormFieldDef of its own (`trackIds` isn't a
// row in the field list, just a join-table posted array), so there is no
// field id to key a `chq-field-wrap-<id>` element or a rule on -- it gets
// no wrap, per the task's own carve-out.
export function TrackChoices(props: { tracks: TrackRow[]; selected: string[]; error?: string }) {
  const { error } = props;
  return (
    <fieldset
      id={TRACK_CHOICES_ID}
      class={error ? "chq-cfp-fieldset chq-field-invalid" : "chq-cfp-fieldset"}
      aria-invalid={error ? "true" : undefined}
    >
      {/* DEC-986 (wave 40 amendment): "required" is carried on the input
          itself (this component only renders when tracks.length > 0, which
          is exactly when validateTrackChoice requires a pick) -- never a
          textual '*' on the legend, per DEC-951's asterisk-free grammar. */}
      <legend>Track</legend>
      {props.tracks.map((track) => (
        <label class="chq-cfp-option">
          <input
            type="radio"
            name="trackIds"
            value={track.id}
            checked={props.selected.includes(track.id)}
            required
          />
          {track.name}
        </label>
      ))}
    </fieldset>
  );
}

// DEC-986: the Session-format dropdown draws as a radio-card group on this
// surface only, scoped by role === "session_format" -- FormFieldsSection's
// default <select> control (src/views/form-render.tsx) stays for every
// other dropdown-kind field, including this same field on /portal/edit.
// Reuses the chq-cfp-option chrome for the same reason TrackChoices does:
// parity is about the option chrome, not the input type.
// w54-e: wrapped in the same `chq-field-wrap-<fieldId>` element FormField
// emits (form-render.tsx) so the visibility script's `apply()` can find and
// toggle it -- without this wrap, a rule targeting this field was rendered
// unconditionally and could never be hidden in the browser.
export function FormatChoices(props: { field: FormFieldDef; value: unknown; error?: string; visible: boolean }) {
  const { field, value, error, visible } = props;
  const name = fieldInputName(field.id);
  return (
    <div id={`chq-field-wrap-${field.id}`} style={visible ? undefined : "display:none"}>
      <fieldset
        class={error ? "chq-cfp-fieldset chq-field-invalid" : "chq-cfp-fieldset"}
        aria-invalid={error ? "true" : undefined}
      >
        <legend>{field.label}</legend>
        {/* w5-c: the generic field.helpText sub-caption ("5 options",
            "Beginner, intermediate, advanced", etc.) is dropped on this
            radio-card rendering -- the frame draws Format as legend + option
            rows only, no extra caption line. */}
        {(field.options ?? []).map((opt) => (
          <label class="chq-cfp-option">
            <input
              type="radio"
              name={name}
              data-field-id={field.id}
              data-required={field.required ? "true" : "false"}
              value={opt}
              checked={value === opt}
              required={field.required}
            />
            {opt}
          </label>
        ))}
        {error ? (
          <p role="alert" class="chq-field-error">
            {error}
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}

// DEC-986 (wave 40 amendment): the Audience-level dropdown, when the default
// form defines it (role === "audience_level"), is pulled out of
// FormFieldsSection's normal <select> rendering the same way FormatChoices
// pulls Session-format -- but drawn as a horizontal three-pill segment
// (.chq-cfp-segment) rather than FormatChoices'/TrackChoices' one-column
// list, reusing the same .chq-cfp-option chrome per DEC-696 parity.
// w54-e: same wrap as FormatChoices, above, for the same reason.
export function AudienceChoices(props: { field: FormFieldDef; value: unknown; error?: string; visible: boolean }) {
  const { field, value, error, visible } = props;
  const name = fieldInputName(field.id);
  return (
    <div id={`chq-field-wrap-${field.id}`} style={visible ? undefined : "display:none"}>
      <fieldset
        class={error ? "chq-cfp-fieldset chq-field-invalid" : "chq-cfp-fieldset"}
        aria-invalid={error ? "true" : undefined}
      >
        <legend>{field.label}</legend>
        {/* w5-c: same drop as FormatChoices above -- no generic-helpText
            sub-caption on the pill segment. */}
        <div class="chq-cfp-segment">
          {(field.options ?? []).map((opt) => (
            <label class="chq-cfp-option chq-cfp-pill">
              <input
                type="radio"
                name={name}
                data-field-id={field.id}
                data-required={field.required ? "true" : "false"}
                value={opt}
                checked={value === opt}
                required={field.required}
              />
              {opt}
            </label>
          ))}
        </div>
        {error ? (
          <p role="alert" class="chq-field-error">
            {error}
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}

// DEC-986 (wave 45 amendment): the single "Name" control the public CFP
// posts under SPEAKER_NAME_FIELD (src/routes/public/submit-body.ts) --
// deliberately NOT built from a FormFieldDef/FieldControl, since neither
// locked speaker field id (first_name/last_name) may appear as its own
// input on this form any more. Mirrors FormField's markup (label row +
// input + inline error) so it reads identically to every other field on
// the page.
export function NameField(props: { value: string; error?: string; fieldId?: string }) {
  const { value, error, fieldId } = props;
  return (
    <div id={fieldId ? `chq-field-wrap-${fieldId}` : undefined} class="chq-field">
      <label>
        <span class="chq-field-label-row">
          <span class="chq-field-label">Name</span>
        </span>
        <input
          type="text"
          class={error ? "chq-input chq-field-invalid" : "chq-input"}
          id="speaker_name"
          name="speaker_name"
          autocomplete="name"
          value={value}
          required
          aria-invalid={error ? "true" : undefined}
        />
      </label>
      {error ? (
        <p role="alert" class="chq-field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// DEC-124: the top-of-form error summary -- one block, "N things need
// fixing before this can be sent", one anchor per problem (href-ing the
// offending field's own rendered id), and the reassurance copy that
// nothing typed was lost. The field itself keeps its own inline
// .chq-field-error message too (the summary orients, the field repairs).
export type ErrorSummaryProblem = { id: string; label: string; message: string };

export function ErrorSummary(props: { problems: ErrorSummaryProblem[] }) {
  const { problems } = props;
  if (problems.length === 0) return null;
  const n = problems.length;
  return (
    <div class="chq-error-summary" role="alert">
      <h2>{thingsNeedFixingHeading(n, "before this can be sent")}</h2>
      <p>Nothing was lost. Everything you typed is still below.</p>
      <ul>
        {problems.map((p) => (
          <li>
            <a class="chq-error-summary-link" href={`#${p.id}`}>
              {p.label}: {p.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SubmitPage(props: {
  event: EventRow;
  form: FormRow;
  fields: FormFieldDef[];
  tracks: TrackRow[];
  answers: AnswerMap;
  selectedTrackIds: string[];
  hasDraft: boolean;
  draftSavedAt?: number;
  csrfToken: string;
  errors?: Record<string, string>;
  trackError?: string;
  draftSavedNotice?: boolean;
  // DEC-626: a top-of-form banner for a re-rendered request (expired CSRF
  // session, rate limit) -- distinct from field-level `errors`.
  banner?: string;
}) {
  const { event, form, fields, tracks, answers, selectedTrackIds, csrfToken, errors, trackError } = props;
  const accentColor = branding(event).accentColor;
  const logoUrl = branding(event).logoUrl;
  // w5-c: display-only overrides (abstract counter helper text, bio
  // label/helper) applied here rather than to `fields` itself -- see the
  // CFP_ABSTRACT_HELP_TEXT / CFP_BIO_* constants above. The abstract
  // field's `maximum` is NOT overridden here: it already arrives on `f` via
  // projectFieldForAnswers (src/forms/types.ts), so the counter and
  // server-side validation read the same real cap. Every other consumer
  // below (isVisible, FieldRulesScript) keeps using the real
  // `fields`/answers so rule-matching and server-shape stay exactly as
  // validated.
  const displayFields = fields.map((f) => {
    if (lockedFieldName(f.id) === "description") {
      return { ...f, helpText: CFP_ABSTRACT_HELP_TEXT };
    }
    if (lockedFieldName(f.id) === "bio") {
      return { ...f, label: CFP_BIO_LABEL, helpText: CFP_BIO_HELP_TEXT };
    }
    if (lockedFieldName(f.id) === "email") {
      return { ...f, helpText: CFP_EMAIL_HELP_TEXT };
    }
    return f;
  });
  // DEC-532: one predicate built from the FULL field list (a session field
  // can gate a speaker field), shared by both sections below.
  const isVisible = makeVisibilityPredicate(fields, answers);
  // DEC-986: the Session-format field, when the default form defines it, is
  // pulled out of FormFieldsSection's normal <select> rendering and drawn
  // as a radio-card group instead (FormatChoices, below).
  const formatField = displayFields.find((f) => f.role === "session_format");
  // DEC-986 (wave 40 amendment): same pull-out, scoped to the
  // audience_level-role field, drawn as a pill segment (AudienceChoices).
  const audienceField = displayFields.find((f) => f.role === "audience_level");
  // The two locked session fields (Title, Abstract) render first via the
  // generic renderer; everything else in the session section (Notes for
  // reviewers, Accessibility needs, and any producer-added custom field)
  // renders after the Track|Format row and the Audience-level segment —
  // Track/Format/Audience are pulled out of both passes via excludeIds.
  const sessionFields = displayFields.filter((f) => f.section === "session");
  const nonLockedSessionIds = sessionFields.filter((f) => lockedFieldName(f.id) === null).map((f) => f.id);
  const lockedSessionIds = sessionFields.filter((f) => lockedFieldName(f.id) !== null).map((f) => f.id);
  const pulledOutSessionIds = [formatField?.id, audienceField?.id].filter((id): id is string => Boolean(id));
  // w5-c: lede copy family ("Three tracks, five formats, no account
  // needed…") computed from the event's own offered tracks/formats rather
  // than hardcoded counts, so the copy stays correct for arbitrary
  // per-event data instead of only the seeded demo.
  const trackCount = tracks.length;
  const formatCount = (formatField?.options ?? []).length;
  const ledeParts: string[] = [];
  if (trackCount > 0) ledeParts.push(countOf(trackCount, "track"));
  if (formatCount > 0) ledeParts.push(countOf(formatCount, "format"));
  ledeParts.push("no account needed");
  const introLede = `${ledeParts.join(", ")} — submit in a few minutes and we'll email you a link to finish or edit later.`;
  // DEC-986 (wave 24 amendment): the organiser's own CFP intro
  // (form.description, authored/validated in Settings via PATCH
  // /api/v1/forms) takes over the lede when present -- the computed
  // track/format sentence above is a fallback for forms that never set
  // one, not a permanent stand-in for authored copy. Split on blank
  // lines into one <p> per paragraph; Hono JSX escapes text children by
  // default, so authored HTML/script never executes.
  const authoredIntroParagraphs = (form.description ?? "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
  // DEC-986 (wave 45 amendment): the YOU section pairs Name|Email, then
  // Company|Job title, then Bio full-width -- a layout FormFieldsSection's
  // generic per-kind flow can't express, so the locked speaker fields are
  // drawn directly with FormField (same component FormFieldsSection uses
  // internally), found by their locked short name (DEC-050/DEC-475). First
  // and last name are still two real FormFieldDefs/columns underneath
  // (DEC-016), but the public form now asks for ONE "Name" control (closes
  // the wave-40 amendment's deferred name-collapse) -- NameField, below,
  // posts under a name that is neither locked field's own input name; the
  // POST handler (src/routes/public/submit.tsx) splits it back into
  // first_name/last_name before validateAnswers runs.
  const speakerFields = displayFields.filter((f) => f.section === "speaker");
  const byLockedName = (name: string) => speakerFields.find((f) => lockedFieldName(f.id) === name);
  const firstNameField = byLockedName("first_name");
  const lastNameField = byLockedName("last_name");
  const emailField = byLockedName("email");
  const companyField = byLockedName("company");
  const jobTitleField = byLockedName("job_title");
  const bioField = byLockedName("bio");
  const knownSpeakerIds = [firstNameField, lastNameField, emailField, companyField, jobTitleField, bioField]
    .filter((f): f is FormFieldDef => Boolean(f))
    .map((f) => f.id);
  const renderSpeakerField = (field: FormFieldDef | undefined) =>
    field ? <FormField field={field} value={answers[field.id]} error={errors?.[field.id]} visible={isVisible(field, answers)} /> : null;
  // DEC-986 (wave 45 amendment): re-derives the single control's display
  // value from the two underlying answers so both round-trip paths (a
  // re-rendered errored POST, a resumed KV draft) show what was typed --
  // applyNameSplit (submit.tsx) writes the same two answer keys before
  // either render path runs.
  const firstNameValue = typeof answers[firstNameField?.id ?? ""] === "string" ? (answers[firstNameField!.id] as string) : "";
  const lastNameValue = typeof answers[lastNameField?.id ?? ""] === "string" ? (answers[lastNameField!.id] as string) : "";
  const nameValue = [firstNameValue, lastNameValue].filter((part) => part.length > 0).join(" ");
  const nameError = firstNameField ? errors?.[firstNameField.id] : undefined;
  // DEC-124: the top-of-form error summary is built from the SAME `errors`
  // record every field below renders inline -- one entry per key, labeled
  // by that field's own displayed label (the single Name control, not the
  // locked first_name field it posts under), href-ing the wrap id each
  // field/fieldset below already carries (`chq-field-wrap-<fieldId>`, or
  // NameField's own matching wrap id, or TRACK_CHOICES_ID for the track
  // radio group, which has no FormFieldDef of its own).
  const fieldLabelById = new Map(displayFields.map((f) => [f.id, f.label] as const));
  if (firstNameField) fieldLabelById.set(firstNameField.id, "Name");
  const summaryProblems: ErrorSummaryProblem[] = errors
    ? Object.entries(errors).map(([id, message]) => ({
        id: `chq-field-wrap-${id}`,
        label: fieldLabelById.get(id) ?? "This field",
        message,
      }))
    : [];
  if (trackError) {
    summaryProblems.push({ id: TRACK_CHOICES_ID, label: "Track", message: trackError });
  }
  // DEC-986 (wave 40 amendment): the header's date·venue eyebrow traces to
  // the event's own startDate/endDate/location (never illustrative copy) --
  // guarded because those columns, while NOT NULL in the schema, aren't
  // always present on a hand-built test fixture.
  const hasEventDates = typeof event.startDate === "string" && event.startDate.length > 0 && typeof event.endDate === "string" && event.endDate.length > 0;
  const header = (
    <header class="chq-cfp-header">
      {hasEventDates ? <span class="chq-cfp-meta">{eventDatesLine(event)}</span> : null}
      <span class="chq-cfp-title">
        {logoUrl ? <img src={logoUrl} alt={`${event.name} logo`} height={32} /> : null}
        {event.name}
      </span>
      {form.closeDate ? (
        <span class="chq-cfp-sub">
          Call for papers · closes {formatEventDateTime(dayLabelEndInstant(form.closeDate, event.timezone), event.timezone)}
        </span>
      ) : null}
    </header>
  );
  return (
    <PageShell title={`Submit a session - ${event.name}`} accentColor={accentColor} header={header}>
      <div class="chq-cfp-body">
        <div class="chq-cfp-intro">
          {/* DEC-986 (wave 40 amendment): a separate, literal <h1> sits above
              the form inside the reading column -- the header above no
              longer carries an <h1> of its own. */}
          <h1 class="chq-pub-surface-title">Submit a talk</h1>
          {/* w5-c (frame 10--14): the lede returns to the "no account
              needed" family -- describes the CFP itself (offered tracks/
              formats, no signup step) rather than duplicating the
              "already have an account" identity note, which now renders
              exactly once, at the bottom of the page (below). */}
          {authoredIntroParagraphs.length > 0
            ? authoredIntroParagraphs.map((block) => <p>{block}</p>)
            : <p>{introLede}</p>}
          {/* DEC-986 (wave 45 amendment): copy still follows the mechanism
              (docs/design/README.md's copy rule) -- it is *set a password*
              on an emailed claim link after submitting, never a public
              signup form (DEC-814: an anonymous submission never creates
              one for an existing contact). w5-c: the CFP rubric looks for a
              visible "Create an account" affordance on this page -- since
              there is no separate pre-submission signup route, this links
              to the real mechanism (the form below, whose Name/Email
              fields are what actually mints the account on submit) rather
              than a dead control pointing at a route that doesn't exist. */}
          <p class="chq-cfp-intro-cta">
            New speaker? <a href="#chq-cfp-submit-form">Create an account</a> by submitting your talk below — we'll
            email you a link to set a password when you're done.
          </p>
        </div>
        {props.banner ? (
          <p role="alert" class="chq-cfp-actions-note">
            {props.banner}
          </p>
        ) : null}
        {props.draftSavedNotice ? (
          <DraftSavedNotice />
        ) : props.hasDraft && props.draftSavedAt !== undefined ? (
          <DraftBanner formId={form.id} savedAt={props.draftSavedAt} timeZone={event.timezone} />
        ) : null}
        <ErrorSummary problems={summaryProblems} />
        <form
          id="chq-cfp-submit-form"
          method="post"
          action={`/submit/${event.slug}`}
          enctype="multipart/form-data"
          data-chq-cfp-step="all"
        >
          <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
          {/* w14-f (DEC-986): phone-only two-step progress chrome -- inert
              on desktop (chq-cfp-steps is display:none outside the 700px
              media query, cfp.css.ts). CfpStepsScript flips
              data-chq-cfp-step on the form between "1"/"2" and keeps this
              label/bar in sync; it never runs (leaves "all" in place) when
              the page already carries a field or form-level error, so a
              rejected submission always shows every field again. */}
          <div class="chq-cfp-steps">
            <span class="chq-cfp-steps-label">Step 1 of 2 &middot; your talk</span>
            <div class="chq-cfp-steps-bar">
              <div class="chq-cfp-steps-bar-fill"></div>
            </div>
          </div>
          <section class="chq-cfp-step chq-cfp-step-talk">
            <div class="chq-cfp-section-label">Your talk</div>
            <div class="chq-cfp-fields">
              <FormFieldsSection
                fields={displayFields}
                section="session"
                answers={answers}
                errors={errors}
                isVisible={isVisible}
                excludeIds={nonLockedSessionIds}
              />
              <div class="chq-cfp-track-format-row">
                {/* DEC-301: a form offering zero tracks renders no Track
                    fieldset — once validateTrackChoice's membership check
                    clears (DEC-416: it runs even when nothing is offered,
                    rejecting any foreign track id), an empty offered set
                    only relaxes the "must pick one" requirement, so an
                    empty required-looking block would be unactionable and
                    misleading. */}
                {tracks.length > 0 ? <TrackChoices tracks={tracks} selected={selectedTrackIds} error={trackError} /> : null}
                {formatField ? (
                  <FormatChoices
                    field={formatField}
                    value={answers[formatField.id]}
                    error={errors?.[formatField.id]}
                    visible={isVisible(formatField, answers)}
                  />
                ) : null}
              </div>
              {trackError ? (
                <p role="alert" class="chq-field-error">
                  {trackError}
                </p>
              ) : null}
              {audienceField ? (
                <AudienceChoices
                  field={audienceField}
                  value={answers[audienceField.id]}
                  error={errors?.[audienceField.id]}
                  visible={isVisible(audienceField, answers)}
                />
              ) : null}
              <FormFieldsSection
                fields={displayFields}
                section="session"
                answers={answers}
                errors={errors}
                isVisible={isVisible}
                excludeIds={[...lockedSessionIds, ...pulledOutSessionIds]}
              />
            </div>
          </section>
          <section class="chq-cfp-step chq-cfp-step-you">
            <div class="chq-cfp-section-label">You</div>
            <div class="chq-cfp-fields chq-cfp-you-grid">
              <NameField value={nameValue} error={nameError} fieldId={firstNameField?.id} />
              {renderSpeakerField(emailField)}
              {renderSpeakerField(companyField)}
              {renderSpeakerField(jobTitleField)}
              {bioField ? <div class="chq-cfp-you-bio">{renderSpeakerField(bioField)}</div> : null}
              <FormFieldsSection
                fields={displayFields}
                section="speaker"
                answers={answers}
                errors={errors}
                isVisible={isVisible}
                excludeIds={knownSpeakerIds}
              />
            </div>
          </section>
          <div class="chq-cfp-actions">
              <button type="submit" class="chq-btn chq-btn-primary">
                Submit this talk
              </button>
              <button
                type="submit"
                class="chq-btn chq-btn-secondary"
                formaction={`/submit/${event.slug}/save-draft`}
                formnovalidate
              >
                Save draft
              </button>
              {/* w14-f: phone-only step navigation -- type="button" so
                  neither control ever submits the form; CfpStepsScript owns
                  all step-switching, no validation runs on Next. */}
              <button type="button" class="chq-btn chq-btn-primary chq-cfp-step-next">
                Next: about you
              </button>
              <button type="button" class="chq-btn chq-btn-secondary chq-cfp-step-back">
                Back
              </button>
              <span class="chq-cfp-actions-note">We email a confirmation with a link to your portal</span>
            </div>
          </form>
        {/* w5-c: the "already have an account?" identity note renders
            ONCE, here at the bottom of the page -- the intro above no
            longer duplicates it (see introLede/chq-cfp-intro-cta). */}
        <p class="chq-cfp-identity-note">
          Already have an account? <a href="/login">Sign in to the speaker portal</a> &rsaquo;
        </p>
        <FieldRulesScript fields={fields} />
        <CfpStepsScript />
      </div>
    </PageShell>
  );
}

// DEC-098: the on-screen claim link is only safe to render when the
// contact was freshly created by *this* submit request — anyone can type
// an existing CRM contact's email into the public form, so rendering that
// contact's claim URL on screen would let them take over the portal. Three
// states:
//  - "fresh": no user, contact created by this request -> claim link shown
//    (byte-compatible with the pre-DEC-098 markup: walkthrough/scale
//    scripts scrape `href="...(/claim/...)"` from this exact case).
//  - "pending-existing-contact": no user, but the contact already existed
//    -> no claim URL anywhere in the HTML; copy points at the emailed
//    password-setup link plus a /login fallback.
//  - "has-account": a user already exists for this email -> /login, as
//    before.
export type ConfirmationState = "fresh" | "pending-existing-contact" | "has-account";

export function ConfirmationPage(props: {
  event: EventRow;
  title: string;
  ref: string;
  submittedEmail: string;
  claimPath: string;
  state: ConfirmationState;
  eventSlug: string;
  form: FormRow;
  emailDelivered: boolean;
  meta: string | null;
}) {
  return (
    <PageShell title={`Submission received - ${props.event.name}`}>
      <div class="chq-cfp-confirm">
        <span class="chq-cfp-confirm-flag">SUBMITTED &middot; {props.ref}</span>
        <h1 class="chq-pub-surface-title">{props.emailDelivered ? "That's in. Check your email." : "That's in. We couldn't send your confirmation email."}</h1>
        <p class="chq-cfp-confirm-body">
          {props.form.closeDate
            ? `You can edit this until ${formatEventDateTime(dayLabelEndInstant(props.form.closeDate, props.event.timezone), props.event.timezone)}.`
            : "You can edit this until the call for papers closes."}
        </p>
        <div class="chq-cfp-confirm-card">
          <span class="chq-cfp-title" style="font-size:17px">
            {props.title}
          </span>
          {props.meta ? <span class="chq-cfp-confirm-card-meta">{props.meta}</span> : null}
        </div>
        {/* DEC-377: no delivery-window or "check spam" timing promise here —
            the earlier copy asserted arrival timing the confirmation email
            send (a best-effort side effect) can't actually guarantee. */}
        <p class="chq-cfp-confirm-body">
          {props.emailDelivered ? (
            <>
              We've emailed a confirmation for "{props.title}" to {props.submittedEmail}.
            </>
          ) : (
            <>
              We couldn't send a confirmation email to {props.submittedEmail}. Your submission "{props.title}" is saved under ref {props.ref}.
            </>
          )}
        </p>
        <div class="chq-cfp-confirm-actions">
          {props.state === "has-account" ? (
            <p>
              <a class="chq-btn chq-btn-primary" href="/login">
                Log in to track it
              </a>
            </p>
          ) : props.state === "pending-existing-contact" ? (
            <>
              {props.emailDelivered ? (
                <p>A password-setup link was emailed to {props.submittedEmail}.</p>
              ) : (
                <p>
                  We couldn't email a password-setup link this time. If you already set one up, log in below; otherwise ask the
                  organiser to resend your portal invite.
                </p>
              )}
              <p>
                Already have a password? <a href="/login">Log in &rsaquo;</a>
              </p>
            </>
          ) : (
            // DEC-252: same-origin on-page links are RELATIVE — they never
            // depend on origin inference. Only the emailed copy (built with
            // resolveBaseUrl below) is absolute.
            <>
              <p>
                <a class="chq-btn chq-btn-primary" href={props.claimPath}>
                  Create a password
                </a>
              </p>
              <p>
                Already have a password? <a href="/login">Log in &rsaquo;</a>
              </p>
            </>
          )}
        </div>
        <div class="chq-cfp-links">
          <a href={`/submit/${props.eventSlug}`}>Submit another talk &rsaquo;</a>
          <a href={`/e/${props.eventSlug}/sessions`}>Browse the programme &rsaquo;</a>
        </div>
      </div>
    </PageShell>
  );
}
