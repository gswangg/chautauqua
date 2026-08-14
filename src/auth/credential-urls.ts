// DEC-949 (wave 34 amendment): a mint (createClaimToken / createResetToken)
// produces a live, single-use account-takeover credential embedded in a URL.
// Every path segment that fronts a freshly minted token must be listed here
// so the organizer-readable audit view (src/routes/comms.ts send-detail)
// never renders it verbatim. Pure — no KV, no node:/cloudflare imports
// (DEC-002) — so this is fully vitest-testable in isolation.
//
// /dev/mailbox (src/routes/dev/mailbox.tsx) is intentionally left
// UNREDACTED: it is mounted only when DEV_MODE="1" and therefore does not
// exist in production, which is what keeps the walkthrough and the reset
// tests able to click a live claim/reset link.
export const CREDENTIAL_URL_SEGMENTS = ["claim", "reset"] as const;

// DEC-949: the base64url token charset newClaimToken/newResetToken emit
// (RFC 4648 §5, unpadded), long enough (16+) to avoid matching short
// incidental path segments elsewhere in a message body.
const TOKEN_CHARSET = "[A-Za-z0-9_-]{16,}";

function buildCredentialUrlRe(): RegExp {
  const alternation = CREDENTIAL_URL_SEGMENTS.join("|");
  return new RegExp(`\\/(${alternation})\\/${TOKEN_CHARSET}`, "g");
}

/** Rewrites every `/<segment>/<token>` URL in `text` — for every segment in
 * CREDENTIAL_URL_SEGMENTS — to `/<segment>/<redacted>`, leaving every other
 * byte identical. Pure — no KV access. */
export function redactCredentialUrls(text: string): string {
  return text.replace(buildCredentialUrlRe(), (_match, segment: string) => `/${segment}/<redacted>`);
}
