// Pure-core auth copy/caps (DEC-002: no node:/cloudflare imports). Split out
// so route modules (src/routes/auth-views.tsx and friends) never hand-
// declare their own text-length cap literal -- caught by
// test/text-cap-declaration.scan.test.ts (DEC-422, w59-a: the scan now
// walks .tsx route files too, which is how this one surfaced).

// DEC-583's login demo affordance and the password inputs across
// auth-views.tsx/auth-reset.tsx/auth-claim.tsx/account.tsx all key off this
// single minimum.
export const MIN_PASSWORD_LENGTH = 12;
