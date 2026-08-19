// Desktop-frame claims: Account cluster (DEC-976, v12 mobile campaign wave
// 103, task v12m-w3-n).
//
// test/desktop-frame-ledger.scan.test.ts enumerates 102 desktop frames
// across the pack and reads a floor of unclaimed coverage for most of them;
// all 8 Account desktop frames (docs/design/Chautauqua Account.dc.html)
// were unclaimed before this file. Each `it()` below carries the strict
// citation `docs/design/Chautauqua Account.dc.html:<line>`, a backtick-
// quoted literal copied VERBATIM from that exact frame line, and a real
// `expect(` within 6 source lines beneath the citation comment -- the
// three-part receipt shape DEC-976's wave-87 amendment made executable
// (app/src/frame-citation.scan.test.ts) for phone frames, and the shape
// this ledger's own header (test/desktop-frame-ledger.scan.test.ts) asks
// desktop claims to follow.
//
// DESKTOP IS FROZEN: this file is node-tier (readFileSync over sources, no
// jsdom, no render) and asserts on SOURCE CONTENT only -- no CSS, no TSX,
// no markup changed anywhere in this task.
//
// Expected values are TYPED as literals here, never read back out of
// docs/design and compared to itself (the tautology
// app/src/tautological-assertion.scan.test.ts guards against).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");

function readSrc(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), "utf-8");
}

describe("desktop frame claims: Account cluster (docs/design/Chautauqua Account.dc.html)", () => {
  it("Sign in card is a small centred card, not a stretched phone (docs/design/Chautauqua Account.dc.html:28)", () => {
    // Frame :34 `max-width:460px` -- the sign-in card's inner content wraps
    // at 460px inside a 1600px desktop stage; the app's shared auth card
    // class carries the same measure (DEC-945 wave-25 amendment,
    // src/routes/auth.css.ts:38-41: ".chq-auth-card is 460px max-width").
    const css = readSrc("src/routes/auth.css.ts");
    expect(css).toMatch(/\.chq-auth-card\s*\{[^}]*max-width:\s*460px/);
    // The submit control is intrinsic-width inside a footer row, never a
    // full-column phone-anatomy button (same amendment comment, line 39-41).
    expect(css).toContain("Its submit control is intrinsic-width");
  });

  it("Change password panel renders the frame's heading at /account/password (docs/design/Chautauqua Account.dc.html:69)", () => {
    // Frame :75 `Change your password` -- the panel's own h1.
    const src = readSrc("src/routes/account.tsx");
    expect(src).toContain("Change your password");
    expect(src).toContain('accountRoutes.get("/account/password"');
  });

  it("Admin catch-all Not-found renders the frame's heading and body copy (docs/design/Chautauqua Account.dc.html:101)", () => {
    // Frame :106 `That page isn't here` -- the admin SPA's DEC-154
    // catch-all NotFound route.
    const src = readSrc("app/src/pages/NotFound.tsx");
    expect(src).toContain("That page isn't here");
    expect(src).toContain("The link may be old, or the event may have been switched since it was saved.");
  });

  it("Forgot-password page renders the frame's title and explainer (docs/design/Chautauqua Account.dc.html:182)", () => {
    // Frame :190 `Reset your password` -- ForgotPasswordPage's own h1.
    const src = readSrc("src/routes/auth-views.tsx");
    expect(src).toContain("Reset your password");
    expect(src).toContain("We will email you a link to set a new one.");
  });

  it("Check-your-email page renders the frame's title (docs/design/Chautauqua Account.dc.html:209)", () => {
    // Frame :217 `Check your email` -- CheckEmailPage's own h1. (The
    // frame's body line at :218 names a literal address; DEC-004's
    // wave-27 amendment deliberately drops the address from both the
    // known- and unknown-email cases so the page can never be used as an
    // account-enumeration oracle -- src/routes/auth-views.tsx:293-296 --
    // so that line is not asserted verbatim here, only the shared title.)
    const src = readSrc("src/routes/auth-views.tsx");
    expect(src).toContain("Check your email");
    expect(src).toContain("DEC-004");
  });

  it("Choose-a-new-password page renders the frame's title (docs/design/Chautauqua Account.dc.html:235)", () => {
    // Frame :243 `Choose a new password` -- ResetPasswordPage's own h1.
    const src = readSrc("src/routes/auth-views.tsx");
    expect(src).toContain("Choose a new password");
    expect(src).toContain("Signing in as {props.email}.");
  });

  it("Expired-reset page renders the frame's title and body copy (docs/design/Chautauqua Account.dc.html:266)", () => {
    // Frame :274 `That link has expired` -- ExpiredResetPage's own h1.
    const src = readSrc("src/routes/auth-views.tsx");
    expect(src).toContain("That link has expired");
    expect(src).toContain("This link has already been used, or it has been replaced by a newer one.");
  });

  it("Rejected sign-in renders one message for both wrong email and wrong password (docs/design/Chautauqua Account.dc.html:290)", () => {
    // Frame :303 `That email and password do not match` -- LOGIN_REJECTED's
    // headline, shared by the credential-mismatch band on /login.
    const src = readSrc("src/routes/auth-helpers.ts");
    expect(src).toContain("That email and password do not match");
    expect(src).toContain("Check both, or reset your password.");
  });
});
