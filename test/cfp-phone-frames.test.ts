// task-w3-c (v12 mobile campaign, DEC-385): PUBLIC CFP AT 390 -- geometry
// assertions on CFP_CSS's phone media block plus render assertions on the
// three ConfirmationPage states, cited against
// docs/design/Chautauqua Public and Portal.dc.html frames :1017-1070
// (Submit a talk) / :1074-1100 (Submitted) / :1124-1143 (Submitted, email
// already known) / :1147-1166 (Submitted, has an account). Each describe
// below carries one strict `docs/design/...dc.html:<line>` citation, landing
// inside its frame's byte range, immediately followed by that line's
// verbatim backticked literal.
//
// DEC-098: the three ConfirmationState variants ("fresh",
// "pending-existing-contact", "has-account") are real, distinct code paths
// in ConfirmationPage (src/routes/public/submit-views.tsx) -- verified by
// reading the component before writing the assertions below (not by
// grepping its markup). See docs/design/DEVIATIONS.md's new "v12 frame
// errata" heading for the one frame affordance (the step-1 "Draft" dock
// button) this build's pinned cfp-phone-steps.test.ts selector cannot
// reach without breaking that frozen test.

import { describe, expect, it } from "vitest";
import { CFP_CSS } from "../src/routes/public/cfp.css";
import { ConfirmationPage } from "../src/routes/public/submit-views";

function mediaBlock(): string {
  const idx = CFP_CSS.indexOf("@media (max-width: 700px)");
  expect(idx, "CFP_CSS has a max-width:700px phone media query").toBeGreaterThan(-1);
  return CFP_CSS.slice(idx);
}

const EVENT_ROW = {
  id: "event-1",
  orgId: "org-1",
  name: "DevFlow Conf 2027",
  slug: "devflow-2027",
  recordPrefix: "DFC",
  timezone: "UTC",
  brandingJson: null,
} as any;

const FORM_ROW = {
  id: "form-1",
  eventId: "event-1",
  title: "Speak at DevFlow",
  description: null,
  isDefault: true,
  openDate: null,
  closeDate: Date.UTC(2026, 7, 16),
  tracksJson: null,
} as any;

function renderConfirmation(state: "fresh" | "pending-existing-contact" | "has-account") {
  const el = ConfirmationPage({
    event: EVENT_ROW,
    title: "Taming 40-Minute CI",
    ref: "DFC-048",
    submittedEmail: "priya@example.com",
    claimPath: "/claim/tok-abc",
    state,
    eventSlug: EVENT_ROW.slug,
    form: FORM_ROW,
    emailDelivered: true,
    meta: "Platform & Infra · Talk, 30 min",
  });
  return el.toString();
}

describe("CFP phone block is appended after ERROR_STATES_CSS/BARE_PAGE_CSS (DEC-385)", () => {
  it("the @media (max-width: 700px) block starts after both composed modules' text", () => {
    const mediaIdx = CFP_CSS.indexOf("@media (max-width: 700px)");
    const errorIdx = CFP_CSS.indexOf(".chq-error-summary {");
    const bareIdx = CFP_CSS.indexOf(".chq-bare-page {");
    expect(mediaIdx).toBeGreaterThan(errorIdx);
    expect(mediaIdx).toBeGreaterThan(bareIdx);
  });
});

describe("Submit a talk phone head -- docs/design/Chautauqua Public and Portal.dc.html:1018", () => {
  // `      <div style="border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0; display:flex; flex-direction:column; gap:6px">`
  it("compacts .chq-cfp-header to the frame's 14px 16px band with a 6px gap", () => {
    const body = mediaBlock();
    const match = body.match(/\.chq-cfp-header\s*\{([^}]*)\}/);
    expect(match, ".chq-cfp-header has a rule inside the phone media query").not.toBeNull();
    expect(match![1]).toMatch(/padding-top:\s*14px/);
    expect(match![1]).toMatch(/padding-bottom:\s*14px/);
    expect(match![1]).toMatch(/gap:\s*6px/);
  });
});

describe("Submit a talk step rail -- docs/design/Chautauqua Public and Portal.dc.html:1021", () => {
  // `          <span style="font-size:11px; font-weight:800; letter-spacing:0.09em; text-transform:uppercase; color:#565A4B">Step 1 of 2 &middot; your talk</span>`
  it("gives .chq-cfp-steps-label the frame's 800 weight / 0.09em tracking, not the desktop 700/0.1em", () => {
    const body = mediaBlock();
    const match = body.match(/\.chq-cfp-steps-label\s*\{([^}]*)\}/);
    expect(match, ".chq-cfp-steps-label has a rule inside the phone media query").not.toBeNull();
    expect(match![1]).toMatch(/font-weight:\s*800/);
    expect(match![1]).toMatch(/letter-spacing:\s*0\.09em/);
  });

  it("lays the step label and its progress bar out as a row, not a stacked column", () => {
    const body = mediaBlock();
    const match = body.match(/\.chq-cfp-steps\s*\{([^}]*)\}/);
    expect(match, ".chq-cfp-steps has a rule inside the phone media query").not.toBeNull();
    expect(match![1]).toMatch(/flex-direction:\s*row/);
    expect(match![1]).not.toMatch(/flex-direction:\s*column/);
  });
});

describe("Submit a talk step bar -- docs/design/Chautauqua Public and Portal.dc.html:1022", () => {
  // `          <div style="flex:1; height:5px; border-radius:99px; background:#E1DDCE; overflow:hidden">`
  it("gives .chq-cfp-steps-bar a 5px pill track, not the desktop-era 4px/2px one", () => {
    const body = mediaBlock();
    const match = body.match(/\.chq-cfp-steps-bar\s*\{([^}]*)\}/);
    expect(match, ".chq-cfp-steps-bar has a rule inside the phone media query").not.toBeNull();
    expect(match![1]).toMatch(/height:\s*5px/);
    expect(match![1]).toMatch(/border-radius:\s*99px/);
  });
});

describe("Submit a talk field stacking -- docs/design/Chautauqua Public and Portal.dc.html:1032", () => {
  // `          <div style="border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; min-height:48px; display:flex; align-items:center; padding:0 13px; font-size:15px">Taming 40-Minute CI</div>`
  it("collapses the desktop Track|Format and Name/Email/Company/Job grids to one column on phone", () => {
    const body = mediaBlock();
    expect(body).toMatch(/\.chq-cfp-track-format-row,\s*\n\s*\.chq-cfp-you-grid\.chq-cfp-fields\s*\{\s*grid-template-columns:\s*1fr;\s*\}/);
  });

  it("floors the Audience-level pill control at 44px on phone", () => {
    const body = mediaBlock();
    const match = body.match(/\.chq-cfp-option\.chq-cfp-pill\s*\{([^}]*)\}/);
    expect(match, ".chq-cfp-option.chq-cfp-pill has a rule inside the phone media query").not.toBeNull();
    expect(match![1]).toMatch(/min-height:\s*44px/);
  });
});

// D9 amendment (moved above the citation, DEC-976 wave-109 amendment task
// w5-r): the selector is scoped `a:not(.chq-btn)` -- the filled primary CTA
// inside .chq-cfp-confirm-actions already carries theme.ts's own phone 44px
// floor AND its 0.5rem 1rem padding, which this rule's `padding: 0 2px`
// would otherwise outrank and squash. Kept above the describe so the
// citation's backtick quote and the first expect( both land within the
// receipt scan's six-line proximity window.
describe("Submitted phone links -- docs/design/Chautauqua Public and Portal.dc.html:1092", () => {
  // `          <a href="#" style="font-size:14px; font-weight:700; min-height:44px; display:flex; align-items:center">Browse the sessions ›</a>`
  it("gives .chq-cfp-links a and .chq-cfp-confirm-actions a:not(.chq-btn) a centred-flex 44px floor with horizontal padding", () => {
    const body = mediaBlock();
    const match = body.match(/\.chq-cfp-links a,\s*\n\s*\.chq-cfp-confirm-actions a:not\(\.chq-btn\)\s*\{([^}]*)\}/);
    expect(match, ".chq-cfp-links a, .chq-cfp-confirm-actions a:not(.chq-btn) has a rule inside the phone media query").not.toBeNull();
    expect(match![1]).toMatch(/min-height:\s*44px/);
    expect(match![1]).toMatch(/align-items:\s*center/);
    expect(match![1]).toMatch(/padding:\s*0\s+2px/);
  });
});

describe("Submitted h1 register -- docs/design/Chautauqua Public and Portal.dc.html:1077", () => {
  // `        <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:27px; font-weight:700; letter-spacing:-0.04em; line-height:1.08">That's in. Check your email.</h1>`
  it("gives .chq-cfp-confirm h1 the frame's 27px/1.08 register on phone", () => {
    const body = mediaBlock();
    const match = body.match(/\.chq-cfp-confirm h1\s*\{([^}]*)\}/);
    expect(match, ".chq-cfp-confirm h1 has a rule inside the phone media query").not.toBeNull();
    expect(match![1]).toMatch(/font-size:\s*27px/);
    expect(match![1]).toMatch(/line-height:\s*1\.08/);
  });

  it("renders the same 'That's in. Check your email.' h1 copy for all three DEC-098 states", () => {
    // Hono JSX escapes the apostrophe as an entity in the rendered string.
    for (const state of ["fresh", "pending-existing-contact", "has-account"] as const) {
      expect(renderConfirmation(state)).toContain("That&#39;s in. Check your email.");
    }
  });
});

describe("Submitted · fresh forward path -- docs/design/Chautauqua Public and Portal.dc.html:1088", () => {
  // `          <span style="background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Create a password</span>`
  it("the fresh state's primary action is Create a password, on the emailed claim link", () => {
    const html = renderConfirmation("fresh");
    expect(html).toContain("Create a password");
    expect(html).toMatch(/href="\/claim\/tok-abc"/);
  });
});

describe("Submitted · email already known forward path -- docs/design/Chautauqua Public and Portal.dc.html:1134", () => {
  // `          <span style="font-size:14px; line-height:1.6; color:#3F4237">Already have a password?</span>`
  it("the pending-existing-contact state asks 'Already have a password?' and carries no claim link", () => {
    const html = renderConfirmation("pending-existing-contact");
    expect(html).toContain("Already have a password?");
    expect(html).not.toContain("/claim/");
  });
});

describe("Submitted · has an account forward path -- docs/design/Chautauqua Public and Portal.dc.html:1157", () => {
  // `          <span style="font-size:14px; line-height:1.6; color:#3F4237">You already have an account here.</span>`
  it("the has-account state states the account exists before offering to log in", () => {
    const html = renderConfirmation("has-account");
    expect(html).toContain("You already have an account here.");
    expect(html).toContain("Log in to track it");
  });
});
