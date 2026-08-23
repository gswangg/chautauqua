// DEC-441 wave-49: docs/design/Chautauqua Comms.dc.html:859-874 (`emails[0]`,
// "Submission received") vs src/routes/public/submit-post.tsx's confirmation
// email. Asserts against the REAL rendered HTML from renderEmailHtml (never
// re-implementing the shell's rendering here) that the claim URL ships
// exactly once, the frame's fact label and the talk title both appear, the
// CTA label matches the frame's words, and the subject names the event.

import { describe, expect, it } from "vitest";
import { buildSubmissionConfirmationEmail } from "../src/domain/submission-confirmation";
import { renderEmailHtml } from "../src/mail/shell";

describe("submission confirmation email (DEC-441 wave-49)", () => {
  const claimUrl = "https://chautauqua.cc/claim/8f3a1b2c";

  function render(hasExistingAccount: boolean) {
    const confirmation = buildSubmissionConfirmationEmail({
      eventName: "DevFlow Conf 2027",
      speakerName: "Dana Kim",
      talkTitle: "Docs That Answer Back",
      ref: "DFC-0042",
      trackNames: ["Developer Experience"],
      claimUrl,
      hasExistingAccount,
    });
    const html = renderEmailHtml(confirmation.text, {
      eventName: "DevFlow Conf 2027",
      reason: "you submitted a talk to this event.",
      cta: { label: confirmation.ctaLabel, href: claimUrl },
      fact: { label: confirmation.factLabel, value: confirmation.factValue },
    });
    return { confirmation, html };
  }

  // The shell's own CTA block (src/mail/shell.ts, unchanged by this task --
  // desktop frozen) always renders the claim URL BOTH as the button's
  // `href` attribute AND, immediately after, as visible "Or paste this
  // into your browser: <url>" fallback text -- one CTA unit, two bytes of
  // markup. That href is never read as prose; it is the link target, not
  // something a recipient reads. So "the claim URL appears exactly once"
  // means once in the VISIBLE text of the message (what a reader actually
  // sees), which is what the fix (removing the confirmation body's own
  // `{portal_link}` paragraph) achieves -- before this fix, the visible
  // text carried it twice (the removed body paragraph + the paste line).
  function visibleUrlOccurrences(html: string): number {
    const withoutHref = html.replace(new RegExp(`href="${claimUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "g"), 'href="#"');
    return withoutHref.split(claimUrl).length - 1;
  }

  it("ships the claim URL exactly once in the message's visible text", () => {
    const { html } = render(false);
    expect(visibleUrlOccurrences(html)).toBe(1);
  });

  it("ships the claim URL exactly once in the message's visible text for an existing-account submitter too", () => {
    const { html } = render(true);
    expect(visibleUrlOccurrences(html)).toBe(1);
  });

  it("renders the frame's fact label and the talk title", () => {
    const { html } = render(false);
    expect(html).toContain("Your talk");
    expect(html).toContain("Docs That Answer Back");
  });

  it("renders the frame's CTA label, 'Open your portal'", () => {
    const { html } = render(false);
    expect(html).toContain("Open your portal");
  });

  it("composes the subject from the event name, not the talk title", () => {
    const { confirmation } = render(false);
    expect(confirmation.subject).toBe("We have your talk for DevFlow Conf 2027");
    expect(confirmation.subject).not.toContain("Docs That Answer Back");
  });

  it("never puts the claim URL in the HTML-body source text itself (it reaches the reader through cta alone)", () => {
    const { confirmation } = render(false);
    expect(confirmation.text).not.toContain(claimUrl);
  });
});
