// SSR view components for the public CFP submit flow
// (src/routes/public/submit.tsx). Split out of submit.tsx purely to reduce
// merge contention on that file — no behavior change. DEC-005 (share link +
// submit page), DEC-098 (claim-link visibility states), DEC-245 (draft-saved
// notice vs. draft-resume banner), DEC-301/DEC-416 (empty track offer),
// DEC-321 (optional speaker profile fields), DEC-371/DEC-374 (shared theme
// CSS + validated accent), DEC-377 (no delivery-window promise in the
// confirmation copy).

import type { AnswerMap, FormFieldDef } from "../../forms/types";
import { makeVisibilityPredicate } from "../../forms/visibility";
import { formatEventDateTime } from "../../lib/event-time";
import { dayLabelEndInstant, dayLabelStartInstant } from "../../lib/timezone";
import { FormFieldsSection, FieldRulesScript } from "../../views/form-render";
import { ThemeStyles } from "../../views/theme";
import { CFP_CSS } from "./cfp.css";
import { validAccent } from "./shell";
import { CSRF_COOKIE_NAME } from "../../auth/cookies";
import type { EventRow, FormRow, TrackRow } from "../../server/repo/submit";

export function branding(event: EventRow): { logoUrl?: string; accentColor?: string } {
  if (!event.brandingJson) return {};
  const parsed = JSON.parse(event.brandingJson) as { logoUrl?: string; accentColor?: string };
  return { logoUrl: parsed.logoUrl, accentColor: parsed.accentColor };
}

// DEC-371/DEC-374: THEME_CSS (tokens/resets, shared by every SSR surface)
// followed by this surface's own CFP_CSS, both inlined via
// dangerouslySetInnerHTML as value-free module constants -- never the
// ad-hoc per-page <style> template literal this used to be. The per-event
// accent is the one piece of request data involved, and it lands in a
// validated style ATTRIBUTE on <body>, never interpolated into either CSS
// string (DEC-374).
export function PageShell(props: { title: string; accentColor?: string; children: unknown }) {
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
      <div class="chq-cfp-closed">
        <span class="chq-cfp-meta">{props.event.name}</span>
        <h1>The call for papers has closed</h1>
        <p role="alert" class="chq-cfp-closed-body">
          Submissions for this event closed on{" "}
          {formatEventDateTime(
            props.form.closeDate ? dayLabelEndInstant(props.form.closeDate, props.event.timezone) : 0,
            props.event.timezone,
          )}
          . Thanks for your
          interest — please reach out to the organizers directly if you have questions.
        </p>
      </div>
    </PageShell>
  );
}

export function NotYetOpenPage(props: { event: EventRow; form: FormRow }) {
  return (
    <PageShell title={`Submissions not yet open - ${props.event.name}`} accentColor={branding(props.event).accentColor}>
      <div class="chq-cfp-closed">
        <span class="chq-cfp-meta">{props.event.name}</span>
        <h1>Submissions aren't open yet</h1>
        <p role="alert" class="chq-cfp-closed-body">
          Submissions open{" "}
          {formatEventDateTime(
            props.form.openDate ? dayLabelStartInstant(props.form.openDate, props.event.timezone) : 0,
            props.event.timezone,
          )}
          . Please check back then.
        </p>
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

// DEC-579: this STAYS a multi-select checkbox group posting a repeating
// trackIds field -- submission_track is a join table, and swapping in
// radios would silently truncate any submission that already holds more
// than one track the next time its owner edited it. The fidelity report's
// actual defect was the singular legend over a multi-select control, so
// the fix is copy only: "Tracks *" plus an explicit "choose all that
// apply" help line, never a change of input type or name.
export function TrackChoices(props: { tracks: TrackRow[]; selected: string[] }) {
  return (
    <fieldset class="chq-cfp-fieldset">
      <legend>Tracks *</legend>
      <p class="help">Choose all that apply.</p>
      {props.tracks.map((track) => (
        <label class="chq-cfp-option">
          <input
            type="checkbox"
            name="trackIds"
            value={track.id}
            checked={props.selected.includes(track.id)}
          />
          {track.name}
        </label>
      ))}
    </fieldset>
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
  // DEC-532: one predicate built from the FULL field list (a session field
  // can gate a speaker field), shared by both sections below.
  const isVisible = makeVisibilityPredicate(fields, answers);
  return (
    <PageShell title={`Submit a session - ${event.name}`} accentColor={accentColor}>
      <div class="chq-cfp-shell">
        <header class="chq-cfp-header">
          {logoUrl ? <img src={logoUrl} alt={`${event.name} logo`} height={32} /> : null}
          <span class="chq-cfp-meta">{event.name}</span>
          <span class="chq-cfp-title">{form.title}</span>
          {form.closeDate ? (
            <span class="chq-cfp-sub">
              Call for papers · closes {formatEventDateTime(dayLabelEndInstant(form.closeDate, event.timezone), event.timezone)}
            </span>
          ) : null}
        </header>
        <div class="chq-cfp-body">
          <div class="chq-cfp-intro">
            <h1>Submit a talk</h1>
            <p class="chq-cfp-identity-note">
              Already have an account? <a href="/login">Sign in to the speaker portal</a>. First time
              submitting? Submitting this form creates your speaker portal account.
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
          <form method="post" action={`/submit/${event.slug}`} enctype="multipart/form-data">
            <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
            <section>
              <div class="chq-cfp-section-label">Your talk</div>
              <div class="chq-cfp-fields">
                <FormFieldsSection
                  fields={fields}
                  section="session"
                  answers={answers}
                  errors={errors}
                  isVisible={isVisible}
                />
                {trackError ? (
                  <p role="alert" class="chq-field-error">
                    {trackError}
                  </p>
                ) : null}
                {/* DEC-301: a form offering zero tracks renders no Track
                    fieldset — once validateTrackChoice's membership check
                    clears (DEC-416: it runs even when nothing is offered,
                    rejecting any foreign track id), an empty offered set
                    only relaxes the "must pick one" requirement, so an
                    empty required-looking block would be unactionable and
                    misleading. */}
                {tracks.length > 0 ? <TrackChoices tracks={tracks} selected={selectedTrackIds} /> : null}
              </div>
            </section>
            <section>
              <div class="chq-cfp-section-label">You</div>
              <div class="chq-cfp-fields">
                <FormFieldsSection
                  fields={fields}
                  section="speaker"
                  answers={answers}
                  errors={errors}
                  isVisible={isVisible}
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
              <span class="chq-cfp-actions-note">We email a confirmation with a link to your portal</span>
            </div>
          </form>
          <FieldRulesScript fields={fields} />
        </div>
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
}) {
  return (
    <PageShell title={`Submission received - ${props.event.name}`}>
      <div class="chq-cfp-confirm">
        <span class="chq-cfp-confirm-flag">SUBMITTED &middot; {props.ref}</span>
        <h1>That's in. Check your email.</h1>
        <div class="chq-cfp-confirm-card">
          <span class="chq-cfp-title" style="font-size:17px">
            {props.title}
          </span>
        </div>
        {/* DEC-377: no delivery-window or "check spam" timing promise here —
            the earlier copy asserted arrival timing the confirmation email
            send (a best-effort side effect) can't actually guarantee. */}
        <p class="chq-cfp-confirm-body">
          We've emailed a confirmation for "{props.title}" to {props.submittedEmail}.
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
              <p>
                A password-setup link was emailed to {props.submittedEmail}. <a href="/login">Log in</a> if you
                already have a password.
              </p>
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
      </div>
    </PageShell>
  );
}
