// DEC-862: the CFP confirmation names the submission's reference and echoes
// the address it emailed; the three DEC-098 states take the design's
// primary labels. Renders ConfirmationPage directly for each of the three
// ConfirmationState values.
// DEC-961: the terminal pages (ClosedPage, NotYetOpenPage, ConfirmationPage)
// each end with a way forward, and the confirmation card tells the
// submitter how long they can still edit.

import { describe, expect, it } from "vitest";
import { ClosedPage, ConfirmationPage, NotYetOpenPage } from "../src/routes/public/submit-views";

const EVENT_ROW = {
  id: "event-1",
  orgId: "org-1",
  name: "Test Conf",
  slug: "test-conf",
  recordPrefix: "SES",
  timezone: "UTC",
  brandingJson: null,
} as any;

const FORM_ROW_WITH_CLOSE = {
  id: "form-1",
  eventId: "event-1",
  title: "Speak at Test Conf",
  description: null,
  isDefault: true,
  openDate: null,
  closeDate: Date.UTC(2026, 11, 1),
  tracksJson: null,
} as any;

const FORM_ROW_NO_CLOSE = { ...FORM_ROW_WITH_CLOSE, closeDate: null } as any;

const FORM_ROW_WITH_OPEN = { ...FORM_ROW_WITH_CLOSE, openDate: Date.UTC(2026, 0, 1) } as any;

function render(state: "fresh" | "pending-existing-contact" | "has-account", form = FORM_ROW_WITH_CLOSE) {
  const el = ConfirmationPage({
    event: EVENT_ROW,
    title: "My Great Talk",
    ref: "SES-014",
    submittedEmail: "speaker@example.com",
    claimPath: "/claim/tok-123",
    state,
    eventSlug: EVENT_ROW.slug,
    form,
    emailDelivered: true,
    meta: null,
  });
  return el.toString();
}

describe("submit confirmation: reference + echoed address (DEC-862)", () => {
  it("fresh: eyebrow carries the ref, body echoes the address, primary CTA is Create a password with the claim href", () => {
    const html = render("fresh");
    expect(html).toContain("SUBMITTED");
    expect(html).toContain("SES-014");
    expect(html).toContain("speaker@example.com");
    expect(html).toMatch(/href="\/claim\/tok-123"/);
    expect(html).toContain("Create a password");
    expect(html).toContain("Log in");
  });

  it("pending-existing-contact: no /claim/ anywhere, body echoes address, exactly one /login anchor", () => {
    const html = render("pending-existing-contact");
    expect(html).toContain("SES-014");
    expect(html).toContain("speaker@example.com");
    expect(html).not.toContain("/claim/");
    const loginAnchors = html.match(/<a[^>]*href="\/login"/g) ?? [];
    expect(loginAnchors.length).toBe(1);
  });

  it("has-account: primary CTA is Log in to track it, no claim path", () => {
    const html = render("has-account");
    expect(html).toContain("SES-014");
    expect(html).toContain("speaker@example.com");
    expect(html).not.toContain("/claim/");
    expect(html).toContain("Log in to track it");
    expect(html).toMatch(/href="\/login"/);
  });

  it("eyebrow format is 'SUBMITTED · {ref}'", () => {
    const html = render("fresh");
    expect(html).toMatch(/SUBMITTED[^<]*SES-014/);
  });
});

describe("DEC-961: confirmation edit-until sentence + way-forward links", () => {
  it("with a close date, states the exact edit-until instant", () => {
    const html = render("fresh", FORM_ROW_WITH_CLOSE);
    expect(html).toContain("You can edit this until");
    expect(html).not.toContain("You can edit this until the call for papers closes.");
  });

  it("with no close date, falls back to the generic sentence", () => {
    const html = render("fresh", FORM_ROW_NO_CLOSE);
    expect(html).toContain("You can edit this until the call for papers closes.");
  });

  it("carries a .chq-cfp-links row with Submit another talk and Browse the programme", () => {
    const html = render("fresh");
    expect(html).toContain('class="chq-cfp-links"');
    expect(html).toMatch(/href="\/submit\/test-conf"/);
    expect(html).toMatch(/href="\/e\/test-conf\/sessions"/);
  });
});

// G13 (frames 10--17/25): the frames draw ONE way-forward link -- the
// event's own sessions -- never a second 'All events' escape (DEC-961's
// two-link shape is superseded by the frame authority).
describe("DEC-961 (amended G13): ClosedPage / NotYetOpenPage way-forward link", () => {
  it("ClosedPage ends with the one sessions link", () => {
    const html = ClosedPage({ event: EVENT_ROW, form: FORM_ROW_WITH_CLOSE }).toString();
    expect(html).toMatch(/href="\/e\/test-conf\/sessions"/);
    expect(html).not.toMatch(/href="\/">/);
  });

  it("NotYetOpenPage leads with the open date and ends with the one sessions link", () => {
    const html = NotYetOpenPage({ event: EVENT_ROW, form: FORM_ROW_WITH_OPEN }).toString();
    expect(html).toContain("The call for papers opens on");
    expect(html).toMatch(/href="\/e\/test-conf\/sessions"/);
    expect(html).not.toMatch(/href="\/">/);
  });
});

describe("DEC-917/951: no required-marker or plural-suffix regressions", () => {
  it("ConfirmationPage <main> body (excluding the <style> reset, which legitimately uses '*' as a CSS selector) carries no '*' required marker and no '(s)' suffix", () => {
    const html = render("fresh");
    const bodyOnly = html.replace(/<style[^>]*>.*?<\/style>/gs, "");
    expect(bodyOnly).not.toContain("*");
    expect(bodyOnly).not.toContain("(s)");
  });
});
