// DEC-124 (wave-153 amendment): the invalid-field treatment keys on the
// band's KIND, never its mere presence. A "credential" band paints
// chq-field-invalid on the affected inputs and shows the "fix the field(s)
// below" instruction; a "throttle" band still renders its headline (it is
// a real refusal and must stay legible) but must NOT decorate any input
// and must NOT show the fix-it instruction, because the throttled user's
// credential may be perfectly correct.
//
// Covers all four auth pages that carry an AuthBandCopy prop: LoginPage,
// ClaimPage, ForgotPasswordPage, ResetPasswordPage.

import { describe, expect, it } from "vitest";
import { LoginPage, ClaimPage, ForgotPasswordPage, ResetPasswordPage } from "../src/routes/auth-views";
import { LOGIN_REJECTED, RATE_LIMIT_BAND, RATE_LIMIT_ERROR } from "../src/routes/auth-helpers";

const CREDENTIAL_HEADLINE = "That value is not right";
const CREDENTIAL_BAND = { headline: CREDENTIAL_HEADLINE, kind: "credential" as const };

describe("LoginPage keys chq-field-invalid on error.kind", () => {
  it("credential band: both inputs marked invalid", () => {
    const html = LoginPage({ csrfToken: "tok", error: LOGIN_REJECTED }).toString();
    expect(html).toContain(LOGIN_REJECTED.headline);
    const emailInput = html.match(/<input[^>]*name="email"[^>]*>/)?.[0] ?? "";
    const passwordInput = html.match(/<input[^>]*name="password"[^>]*>/)?.[0] ?? "";
    expect(emailInput).toContain("chq-field-invalid");
    expect(passwordInput).toContain("chq-field-invalid");
  });

  it("throttle band: headline renders, neither input marked invalid", () => {
    const html = LoginPage({ csrfToken: "tok", error: RATE_LIMIT_BAND }).toString();
    expect(html).toContain(RATE_LIMIT_ERROR);
    const emailInput = html.match(/<input[^>]*name="email"[^>]*>/)?.[0] ?? "";
    const passwordInput = html.match(/<input[^>]*name="password"[^>]*>/)?.[0] ?? "";
    expect(emailInput).not.toContain("chq-field-invalid");
    expect(passwordInput).not.toContain("chq-field-invalid");
  });
});

describe("ClaimPage keys chq-field-invalid + fix-it instruction on error.kind", () => {
  it("credential band: password marked invalid, instruction present", () => {
    const html = ClaimPage({ csrfToken: "tok", error: CREDENTIAL_BAND }).toString();
    expect(html).toContain(CREDENTIAL_HEADLINE);
    expect(html).toContain("Fix the password below, then try again.");
    const passwordInput = html.match(/<input[^>]*name="password"[^>]*>/)?.[0] ?? "";
    expect(passwordInput).toContain("chq-field-invalid");
  });

  it("throttle band: headline renders, no field decoration, no instruction", () => {
    const html = ClaimPage({ csrfToken: "tok", error: RATE_LIMIT_BAND }).toString();
    expect(html).toContain(RATE_LIMIT_ERROR);
    expect(html).not.toContain("Fix the password below, then try again.");
    const passwordInput = html.match(/<input[^>]*name="password"[^>]*>/)?.[0] ?? "";
    expect(passwordInput).not.toContain("chq-field-invalid");
  });
});

describe("ForgotPasswordPage renders the throttle headline without inventing field decoration", () => {
  it("throttle band: headline renders, retry copy shown, email input never decorated", () => {
    const html = ForgotPasswordPage({ csrfToken: "tok", email: "a@example.test", error: RATE_LIMIT_BAND }).toString();
    expect(html).toContain(RATE_LIMIT_ERROR);
    expect(html).toContain("Try again in a few minutes.");
    const emailInput = html.match(/<input[^>]*name="email"[^>]*>/)?.[0] ?? "";
    expect(emailInput).not.toContain("chq-field-invalid");
  });
});

describe("ResetPasswordPage keys chq-field-invalid + fix-it instruction on error.kind", () => {
  it("credential band: both password inputs marked invalid, instruction present", () => {
    const html = ResetPasswordPage({ csrfToken: "tok", email: "a@example.test", error: CREDENTIAL_BAND }).toString();
    expect(html).toContain(CREDENTIAL_HEADLINE);
    expect(html).toContain("Fix the password fields below, then try again.");
    const nextInput = html.match(/<input[^>]*name="next"[^>]*>/)?.[0] ?? "";
    const confirmInput = html.match(/<input[^>]*name="confirm"[^>]*>/)?.[0] ?? "";
    expect(nextInput).toContain("chq-field-invalid");
    expect(confirmInput).toContain("chq-field-invalid");
  });

  it("throttle band: headline renders, no field decoration, no instruction", () => {
    const html = ResetPasswordPage({ csrfToken: "tok", email: "a@example.test", error: RATE_LIMIT_BAND }).toString();
    expect(html).toContain(RATE_LIMIT_ERROR);
    expect(html).not.toContain("Fix the password fields below, then try again.");
    const nextInput = html.match(/<input[^>]*name="next"[^>]*>/)?.[0] ?? "";
    const confirmInput = html.match(/<input[^>]*name="confirm"[^>]*>/)?.[0] ?? "";
    expect(nextInput).not.toContain("chq-field-invalid");
    expect(confirmInput).not.toContain("chq-field-invalid");
  });
});

describe("RATE_LIMIT_ERROR text and band shape are unchanged by the amendment", () => {
  it("RATE_LIMIT_ERROR headline text is exactly the pre-existing string", () => {
    expect(RATE_LIMIT_ERROR).toBe("Too many attempts. Try again in a few minutes.");
    expect(RATE_LIMIT_BAND.headline).toBe(RATE_LIMIT_ERROR);
  });

  it("RATE_LIMIT_BAND is kind: throttle, LOGIN_REJECTED is kind: credential", () => {
    expect(RATE_LIMIT_BAND.kind).toBe("throttle");
    expect(LOGIN_REJECTED.kind).toBe("credential");
  });
});
