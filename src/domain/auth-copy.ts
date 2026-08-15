// Pure-core auth copy/caps (DEC-002: no node:/cloudflare imports). Split out
// so route modules (src/routes/auth-views.tsx and friends) never hand-
// declare their own text-length cap literal -- caught by
// test/text-cap-declaration.scan.test.ts (DEC-422, w59-a: the scan now
// walks .tsx route files too, which is how this one surfaced).

// DEC-583's login demo affordance and the password inputs across
// auth-views.tsx/auth-reset.tsx/auth-claim.tsx/account.tsx all key off this
// single minimum.
export const MIN_PASSWORD_LENGTH = 12;

// DEC-740 (amendment): no path bounded a caller-supplied password -- the
// anonymous /login surface's rate limiter counts failures only (DEC-180), so
// an unbounded password could be posted repeatedly at no cost to an
// attacker. This ceiling is enforced inside src/auth/password.ts (the one
// chokepoint every hashPassword/verifyPassword caller goes through) and
// pre-checked by every user-facing form so the refusal is disclosed before
// submit.
export const MAX_PASSWORD_LENGTH = 128;
