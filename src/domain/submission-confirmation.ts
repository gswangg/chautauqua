// DEC-441 wave-49: the "Submission received" confirmation email
// (docs/design/Chautauqua Comms.dc.html:859-874 `name: 'Submission
// received',` -- the frame's own `emails[0]` entry, trigger "On
// submit · best-effort, never blocks the save" -- the one email
// src/routes/public/submit-post.tsx sends) has never been graded against
// the frame. This pure module composes the pieces the frame draws:
// subject, an HTML-body text (greeting + reassurance, no claim URL -- the
// URL reaches the reader through the shell's `cta` block alone, DEC-441
// clause (a)), the highlighted-fact block, and the CTA label. It never
// writes, never imports node:/cloudflare, and composes every merge-field
// substitution through renderTemplate (src/mail/render.ts) -- the one
// escaping/substitution path (DEC-037/DEC-660) -- rather than growing a
// second one here.

import { renderTemplate } from "../mail/render";
import { DEC_441 } from "../decisions";
// implements DEC_441 (the submission-received email is built to its v12 frame, one owner).
void DEC_441;

export interface SubmissionConfirmationInput {
  eventName: string;
  speakerName: string;
  talkTitle: string;
  ref: string;
  trackNames: string[];
  claimUrl: string;
  hasExistingAccount: boolean;
}

export interface SubmissionConfirmationEmail {
  subject: string;
  text: string;
  factLabel: string;
  factValue: string;
  ctaLabel: string;
}

/** Builds the "Submission received" email exactly as
 * Chautauqua Comms.dc.html:859-874 draws it. `text` here is the HTML
 * body's own source text (greeting + reassurance sentence, nothing else --
 * clause (a)); the plain-text mailer.send body that keeps the claim URL
 * reachable for a text-only client is a SEPARATE composition the call site
 * builds itself (DEC-441 clause (e) / wave-135), never returned from here. */
export function buildSubmissionConfirmationEmail(
  input: SubmissionConfirmationInput,
): SubmissionConfirmationEmail {
  const firstName = input.speakerName.trim().split(/\s+/)[0] ?? input.speakerName;

  // Frame subject: 'We have your talk for DevFlow Conf 2027' -- composed
  // from the EVENT NAME, never the talk title (clause (b)).
  const subject = renderTemplate("We have your talk for {event_name}", { event_name: input.eventName });

  const greeting = renderTemplate("Hi {speaker_name},", { speaker_name: firstName });
  const reassurance = renderTemplate(
    "Thanks for submitting to {event_name}. Nothing else is needed from you right now — the committee reads everything after the form closes.",
    { event_name: input.eventName },
  );
  const text = `${greeting}\n\n${reassurance}`;

  // Frame's worked fact: 'Docs That Answer Back: … — lightning talk, 10
  // min, Developer Experience.' also carries a session kind and a
  // duration; NARROWEST-INTERPRETATION FLAG (DEC-037 clause (c) idiom):
  // this call site has no session-format/duration answer in scope, only
  // the title and the selected track name(s), so those two components of
  // the frame's fact are omitted rather than invented.
  const factLabel = "Your talk";
  const factValue =
    input.trackNames.length > 0
      ? renderTemplate("{talk_title} — {tracks}.", { talk_title: input.talkTitle, tracks: input.trackNames.join(" · ") })
      : renderTemplate("{talk_title}.", { talk_title: input.talkTitle });

  // The frame draws exactly one worked email with one button, "Open your
  // portal" -- no signed-in/signed-out textual variant. The product's
  // existing has-account wording ("Sign in to view your submission") has
  // nothing in the frame to justify keeping it, so both branches adopt the
  // frame's words (clause (d)).
  // hasExistingAccount/ref are accepted per the task's declared input shape
  // (a future per-state CTA or a fact-block ref clause could read them) but
  // this frame draws no variant that consumes either today.
  const ctaLabel = "Open your portal";

  return { subject, text, factLabel, factValue, ctaLabel };
}
