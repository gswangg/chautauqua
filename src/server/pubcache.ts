// J10 / DEC-083: real purge-on-publish edge caching for public surfaces.
// Supersedes DEC-022's "no purge machinery" sentence (client-facing
// Cache-Control stays DEC-022's max-age=60 + stale-while-revalidate=300;
// setCacheHeaders in src/routes/public.tsx is unchanged). The stored copy
// in caches.default carries a long max-age because purge is a version
// swap, not a TTL wait: bumpPublicVersionMiddleware writes a fresh random
// token to KV after any successful (status < 400) non-GET/HEAD/OPTIONS
// request, and publicCacheMiddleware folds that version into the cache
// key so a purge is a version swap: the old key is never looked up again
// (O(1), no URL enumeration, no lost-update window from concurrent
// counters), but the swap is NOT instantaneous for every reader. The
// version token itself is read from Workers KV (readPublicVersion below),
// and KV is edge-cached + eventually consistent — the platform floor on a
// KV read's cacheTtl is PUBLIC_VERSION_STALENESS_SECONDS (60s), so a colo
// that already has the old token cached can keep serving the pre-bump
// version for up to that window after the bump. Validating that bound in
// production is stage 2 (SPEC.md:59-62 assigns "production edge-cache
// validation" there); DEC-083's wave-26 amendment names this a documented
// bound, not a defect to re-architect in stage 1. What publicCacheMiddleware
// DOES do in this stage (see the cookie check at the top of the middleware,
// below) is make sure the one reader who would otherwise notice the lag —
// the signed-in organiser who just made the change — never hits the stale
// edge copy at all: any request carrying a chq_session cookie skips the
// cache entirely and renders fresh, so the staleness window is invisible
// to anonymous visitors' shared cache experience only.
//
// DEC-083's wave-70 amendment: PUBVER_KEY is deliberately ONE instance-wide
// key, not oversight. bumpIfMutating rewrites it on any successful
// non-NEVER_PUBLIC mutation, so a write on one event cold-caches every
// /e/* and /embed/* page of every event in the instance, not just the one
// that changed. Per-event scoping was considered and rejected for stage 1:
// it needs either a slug->event (and embedId->event) resolution added to
// the anonymous read path this cache exists to protect, or a
// context-variable protocol threaded through ~40 mutating routes, and the
// measured public surface still passes its budget cold (15-98ms adjusted
// against a 150ms budget at 2,030 submissions — see docs/AUDIT.md and
// docs/eval-findings.md's "PROD-LIKE LOAD TEST" section). Document the
// blast radius, don't re-architect the mechanism.
//
// DEC-099: the internal 86400 max-age on the stored copy must never reach
// clients/proxies. On a cache hit, servePublicGet rebuilds the Response
// with Cache-Control overwritten back to CLIENT_CACHE_CONTROL (byte-
// identical to setCacheHeaders's header value in src/routes/public.tsx,
// not imported from there since that module isn't pure-core) before
// returning it — the cached Response's headers are immutable, so a fresh
// Response wrapping the same body is required.
//
// Written against CacheLike + the KVStore interface from src/lib/draft.ts
// (DEC-002 pure-core convention) so the core logic unit-tests with fakes,
// no real Cache API / KVNamespace required.
//
// DEC-442: the ics skip is request-shaped, not path-shaped. Bare
// schedule.ics (no ?ids=) does identical work to agenda.ics, so it now
// joins the same version-salted cache key space and gets purged by the
// same bumpPublicVersionMiddleware swap. Only a schedule.ics request that
// carries an `ids` query string (even empty — per-user/unbounded
// cardinality) stays excluded; see isUncacheableIcsRequest.
//
// DEC-433 amendment (wave 45): isUncacheableIcsRequest is the ONE remaining
// request-shaped bypass (no cache.match, no cache.put). The former
// hasOverlongQueryValue whole-request bypass is deleted: versionedCacheKey
// now skips a keyed param whose value exceeds MAX_PUBLIC_QUERY_VALUE_LENGTH
// (treating it exactly as absent) instead of copying it into the key, and
// every route-layer parser for a PUBLIC_CACHE_KEY_PARAMS name already
// degrades an over-cap value to the same result as `undefined` — so an
// overlong non-keyed param was already dropped, and an overlong keyed one
// now keys identically to its absence rather than needing a bypass at all.
//
// DEC-083 wave-70 amendment (restated wave 72): PUBVER_KEY is ONE key for
// the WHOLE INSTANCE, not per-event — see the doc comment directly above
// PUBVER_KEY below for the blast-radius statement and the reason this is
// deliberate at stage 1, not an oversight.

import type { Context, Next } from "hono";
import type { AppEnv } from "./env";
import type { KVStore } from "../lib/draft";
import { DEC_627 } from "../decisions";
import { executionCtxOf } from "./execution-ctx";
import { MAX_PUBLIC_QUERY_VALUE_LENGTH, PUBLIC_CACHE_KEY_PARAMS } from "./repo/public/bounds";
import { SESSION_COOKIE_NAME, parseCookies } from "../auth/cookies";

void DEC_627;

/** One version key for the WHOLE INSTANCE — not per-event, not per-org.
 * `bumpIfMutating` (below) rewrites this single KV entry after ANY
 * successful (status < 400) non-GET/HEAD/OPTIONS request whose path is
 * NOT classified `never-public` (i.e. any request where
 * `affectsPublicOutput` is true, on any event). So a producer dragging one
 * agenda slot on event A cold-caches every `/e/*` and `/embed/*` page of
 * every OTHER event and org on the instance — the next anonymous visitor
 * to any of them pays a full origin render even though nothing on their
 * page changed.
 *
 * This is DELIBERATE at stage 1, per DEC-083's wave-70 amendment (restated
 * wave 72), not an oversight to fix opportunistically: per-event scoping
 * would require a slug→event (and embedId→event) resolution on the
 * anonymous read path this cache exists to protect — a D1 query added to
 * the exact request the cache is there to avoid — or a new
 * context-variable protocol threaded through ~40 mutating routes. The
 * public surfaces measure 15-98ms COLD against a 150ms budget at 2,030
 * submissions, so instance-wide over-purging costs only cache warmth, not
 * the budget. Do not scope this key without re-opening DEC-083. */
export const PUBVER_KEY = "chq:pubver";

/** @cloudflare/workers-types doesn't declare `caches.default` (it's a
 * documented Workers runtime API, just untyped) — this is the one place
 * that casts to reach it, so callers get a properly-typed CacheLike. */
export function defaultCache(): CacheLike {
  return (caches as unknown as { default: CacheLike }).default;
}

/** Structural subset of the Cache API (caches.default) — small enough to fake. */
export interface CacheLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

const ABSENT_VERSION = "v0";

/** DEC-083 wave-26 amendment: the bound on how long a signed-out visitor's
 * colo can keep serving a pre-bump public page after an organiser's write.
 * This is a platform property, not a chosen TTL: Workers KV's edge read
 * (readPublicVersion's `kv.get(PUBVER_KEY)` below) has a documented
 * cacheTtl floor of 60s, and KV writes propagate to the edge eventually
 * (not synchronously) on top of that — so no `kv.get` can promise a purge
 * lands sooner than this window. SPEC.md:59-62 assigns "production
 * edge-cache validation and perf measurement" to stage 2; this constant
 * documents the known bound now rather than deferring the honesty of the
 * claim. Exported (not just a comment) so a test can assert the number
 * can't be silently loosened. */
export const PUBLIC_VERSION_STALENESS_SECONDS = 60;

// This is CLIENT_CACHE_CONTROL_OVERRIDE (the internal caches.default max-age
// on the STORED copy, never sent to a real client — see DEC-099 above): its
// 86400 is correct as-is and is not touched by PUBLIC_VERSION_STALENESS_SECONDS.
// A stored entry's staleness is bounded by how stale the __chqv token used to
// key it can be (readPublicVersion's KV read, capped at
// PUBLIC_VERSION_STALENESS_SECONDS), not by this stored Response's own TTL —
// once the token in a new request's key differs, the old keyed entry is
// simply never looked up again, so a long TTL here does no harm and saves a
// re-store on every hit within the same version.
const CLIENT_CACHE_CONTROL_OVERRIDE = "public, max-age=86400";

/** DEC-099: client-facing Cache-Control for cache-hit responses. Must stay
 * byte-identical to setCacheHeaders's header value in src/routes/public.tsx
 * (line ~61) — that module is not pure-core so it isn't imported here. */
export const CLIENT_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";

/** Reads the current public version, defaulting to 'v0' when the key is
 * simply absent (a fresh KV namespace pre-first-mutation). A missing KV
 * *binding* is a caller bug and is not handled here — fail loudly.
 *
 * This `kv.get` is the read whose result can lag a bump by up to
 * PUBLIC_VERSION_STALENESS_SECONDS (Workers KV's edge cacheTtl floor plus
 * eventually-consistent propagation) — see that constant's comment. */
export async function readPublicVersion(kv: KVStore): Promise<string> {
  const raw = await kv.get(PUBVER_KEY);
  return raw ?? ABSENT_VERSION;
}

/** Builds the version-salted CANONICAL cache key for a given request URL.
 * DEC-433 amendment (wave 44): the key is origin + pathname + only the
 * params in PUBLIC_CACHE_KEY_PARAMS (in that fixed order, when present) +
 * __chqv last — every other query param (tracking params like
 * ?utm_source=, ?fbclid=, and any caller-supplied __chqv, which is simply
 * ignored/overwritten) is dropped. This both restores cache hits for
 * shared/tracked links and closes the unbounded-cache-entry surface an
 * arbitrary sub-cap param could otherwise open (the exact flooding shape
 * DEC-433 already clamped ?page= to close).
 *
 * DEC-433 amendment (wave 45): a keyed param whose value is longer than
 * MAX_PUBLIC_QUERY_VALUE_LENGTH is treated exactly as absent (skipped, not
 * copied) rather than folded into the key verbatim. Every route-layer
 * parser for a PUBLIC_CACHE_KEY_PARAMS name already degrades an over-cap
 * value to the same result it produces for `undefined` (proven by
 * test/pubcache-key-param-derivation.scan.test.ts's equivalence check), so
 * this closes the key-space flooding surface a long *keyed* value would
 * otherwise still open (an unkeyed param was already dropped above, but a
 * keyed one like ?q=<10000 chars> used to be copied whole into the key).
 * This supersedes hasOverlongQueryValue's whole-request bypass, which is
 * deleted below — the parsers' own equivalence is the reason the bypass is
 * no longer needed, not merely a second independent bound. */
export function versionedCacheKey(url: string, version: string): Request {
  const parsed = new URL(url);
  const keyed = new URL(parsed.pathname, parsed.origin);
  for (const name of PUBLIC_CACHE_KEY_PARAMS) {
    const value = parsed.searchParams.get(name);
    if (value !== null && value.length <= MAX_PUBLIC_QUERY_VALUE_LENGTH) keyed.searchParams.set(name, value);
  }
  keyed.searchParams.set("__chqv", version);
  return new Request(keyed.toString());
}

/** DEC-442: request-shaped (not path-shaped) skip. Only a schedule.ics
 * request carrying an `ids` query string (even empty) is per-user/
 * unbounded-cardinality and must bypass the cache; the bare whole-agenda
 * schedule.ics does identical work to agenda.ics and joins the same
 * version-salted cache as everything else. */
export function isUncacheableIcsRequest(url: string): boolean {
  const parsed = new URL(url);
  return parsed.pathname.endsWith("/schedule.ics") && parsed.searchParams.has("ids");
}

/** Core GET-path logic, pure against CacheLike + KVStore, so it's callable
 * both from the Hono middleware and directly from unit tests. */
export async function servePublicGet(
  cache: CacheLike,
  kv: KVStore,
  request: Request,
  next: () => Promise<Response>,
  waitUntil?: (p: Promise<unknown>) => void,
): Promise<Response> {
  const version = await readPublicVersion(kv);
  const cacheKey = versionedCacheKey(request.url, version);

  const hit = await cache.match(cacheKey);
  if (hit) {
    // DEC-083 amendment (wave 10): read the body from a clone, not `hit`
    // itself. A CacheLike implementation is free to return the same
    // Response object on repeat match() calls for the same key (the
    // in-memory test fake does this), and a Response body stream can only
    // be read once — reading `hit.body` directly would disturb/lock that
    // shared stream, breaking a second identical request. Cloning first
    // gives each read-through its own body stream. (Headers are also
    // immutable on the cached Response, which is the other reason this
    // must be a fresh Response rather than a mutation of `hit`.)
    const restored = new Response(hit.clone().body, hit);
    restored.headers.set("Cache-Control", CLIENT_CACHE_CONTROL);
    // DEC-099 wave-34 amendment: restore Vary: Cookie on every cache-hit
    // response, same idiom as the Cache-Control override immediately above
    // -- the stored copy has it stripped (see the `stored` branch below), so
    // it must be put back here rather than assumed to survive the copy.
    restored.headers.set("Vary", "Cookie");
    return restored;
  }

  const response = await next();
  if (response.status === 200) {
    const stored = new Response(response.clone().body, response);
    stored.headers.set("Cache-Control", CLIENT_CACHE_CONTROL_OVERRIDE);
    // DEC-099 wave-34 amendment: the stored copy is anonymous-only by
    // construction (publicCacheMiddleware skips both cache.match and
    // cache.put for any cookie-carrying request), so Vary: Cookie would only
    // ever fragment the shared edge entry into two identical copies keyed on
    // the same cookie-less value -- strip it before cache.put and restore it
    // on every read-through above instead (both restored and hit paths).
    stored.headers.delete("Vary");
    // wave 15 (DEC-083 amendment): the edge-store write is not on the
    // visitor's critical path. When a waitUntil is supplied (the Workers
    // execution context — see publicCacheMiddleware), the put runs after
    // the response has already been returned. When absent, the put is
    // still awaited here (the direct unit-test callers in
    // test/pubcache.test.ts rely on this — they call servePublicGet
    // without a waitUntil and then read `cache.store` synchronously right
    // after the call returns).
    if (waitUntil) {
      waitUntil(cache.put(cacheKey, stored));
    } else {
      await cache.put(cacheKey, stored);
    }
  }
  return response;
}

/** DEC-627: a single path pattern in one of the two closed lists below.
 * `:seg` matches exactly one non-empty path segment; a trailing `*`
 * (whether or not preceded by `/`) matches any suffix (including none) —
 * i.e. it's a plain string-prefix match on the pattern with the `*`
 * stripped. Every other segment must match literally. */
type PathPattern = string;

export function matchPattern(pattern: PathPattern, path: string): boolean {
  const isWildcard = pattern.endsWith("*");
  let corePattern = isWildcard ? pattern.slice(0, -1) : pattern;
  // A trailing "/*" (e.g. "/api/v1/tasks/*") leaves a dangling "/" once the
  // "*" is stripped ("/api/v1/tasks/") — drop it so segment-splitting lines
  // up 1:1 with a bare "/api/v1/tokens*" (no slash before the "*").
  if (isWildcard && corePattern.endsWith("/") && corePattern !== "/") corePattern = corePattern.slice(0, -1);
  const patternSegs = corePattern.split("/");
  const pathSegs = path.split("/");
  if (isWildcard ? pathSegs.length < patternSegs.length : pathSegs.length !== patternSegs.length) return false;
  return patternSegs.every((seg, i) => seg.startsWith(":") || seg === pathSegs[i]);
}

/** DEC-627: routes that never affect what /e/* or /embed/* render (the
 * ONLY two cached public prefixes — src/routes/public/index.tsx:85-86;
 * everything else, including /submit/* and /portal/* pages other than the
 * ones below, is never cached in the first place). A bump here would be
 * pure overhead, not a correctness bug, but keeping this list exhaustive
 * (enforced by the source-scanning test) is what makes the PUBLIC-
 * AFFECTING list trustworthy as "everything not here bumps".
 *
 * /api/v1/forms/* and /api/v1/fields/* (CFP form-builder) are here too:
 * the /submit/:eventSlug page that renders them is never behind the
 * cache (only /e/* and /embed/* are), so editing the form structure has
 * nothing cached to invalidate. */
export const NEVER_PUBLIC: PathPattern[] = [
  "/login",
  "/logout",
  // DEC-014 (wave-25 amendment): the password-reset pair writes a KV grant
  // and, on completion, a password hash + session. Exactly the /login and
  // /claim/* class -- credential and session state only, nothing that any
  // /e/* or /embed/* page renders.
  "/forgot",
  "/reset/*",
  "/claim/*",
  "/account/*",
  "/api/v1/tokens*",
  "/api/v1/views*",
  "/api/v1/events/:id/views",
  "/api/v1/plans*",
  "/api/v1/events/:id/plans",
  "/api/v1/review/*",
  "/api/v1/events/:id/templates",
  "/api/v1/templates/*",
  "/api/v1/events/:id/compose/*",
  // DEC-805: the per-speaker portal invitation is a send, not a status write —
  // it mints a claim link, mails it, and logs it; nothing it writes feeds
  // visibleParticipantConditions() (unlike /portal/invitations/*, which
  // writes participant.invite_status and is PUBLIC-AFFECTING below).
  "/api/v1/events/:id/portal-invites",
  "/api/v1/contacts/bulk-email*",
  // DEC-770: dismissing a duplicate pair records an organizer-side judgement
  // about two contact rows; no public page renders the duplicate list.
  "/api/v1/contacts/duplicates/dismiss",
  "/api/v1/segments*",
  "/api/v1/pipeline*",
  "/api/v1/events/:id/tasks",
  "/api/v1/tasks/*",
  "/api/v1/task-assignments/*",
  "/api/v1/events/:id/onboarding/*",
  "/api/v1/events/:id/portal-settings",
  "/api/v1/events/:id/resources",
  "/api/v1/resources/*",
  "/api/v1/files/:id/comments",
  // DEC-713: deleting a file version writes no content_status (it removes a
  // stored version row/object; see files.ts's DELETE /files/:id handler) —
  // it doesn't touch content_status at all, so nothing gates on it and no
  // public row's visibility can change from this write.
  "/api/v1/files/:id",
  "/api/v1/events/:id/files/archive",
  "/api/v1/forms/*",
  "/api/v1/fields/*",
  "/api/v1/users*",
  // DEC-627: only the three non-upload task-assignment mutations below are
  // never-public; /portal/tasks/:id/upload reopens content review (DEC-020)
  // and is PUBLIC-AFFECTING (see below) — a wildcard "/portal/tasks/*" would
  // have silently swallowed it too.
  "/portal/tasks/:id/complete",
  "/portal/tasks/:id/form",
  "/portal/tasks/:id/comments",
  // /submit/:eventSlug[/save-draft] (public CFP submission create/draft) is
  // never-public too: a freshly-created submission starts in a non-public
  // status and only becomes visible once an organizer accepts it, which
  // happens through /api/v1/events/:id/submissions/status (already
  // PUBLIC-AFFECTING below) — the create/draft write itself never changes
  // what any accepted/visible/approved row renders.
  "/submit/*",
];

/** DEC-627: routes whose write can change what a subsequent GET to /e/*
 * or /embed/* renders, so the version must bump. `/portal/invitations/*`
 * (invitation accept/decline) is here, not omitted: accepting/declining
 * writes participant.invite_status, and visibleParticipantConditions()
 * (src/server/repo/public/gates.ts) gates public speaker visibility on
 * invite_status IN ('none','accepted') — so this write can flip a
 * speaker's public visibility directly. */
export const PUBLIC_AFFECTING: PathPattern[] = [
  "/api/v1/events",
  "/api/v1/events/:id",
  "/api/v1/events/:id/tracks",
  "/api/v1/tracks/:id",
  "/api/v1/events/:id/rooms",
  "/api/v1/rooms/:id",
  "/api/v1/events/:id/submissions",
  "/api/v1/events/:id/submissions/status",
  // DEC-825 amendment: the bulk content-status write reaches the public gate
  // for exactly the reasons its single-id sibling
  // (/api/v1/submissions/:id/content-status, below) does — the amendment
  // names PUBLIC_AFFECTING explicitly.
  "/api/v1/events/:id/submissions/content-status",
  // DEC-886: a deleted submission that was public (accepted/visible/content-
  // approved) must stop rendering on /e/*|/embed/* — same reasoning as the
  // status route immediately above.
  "/api/v1/events/:id/submissions/delete",
  "/api/v1/submissions/:id",
  "/api/v1/submissions/:id/clone",
  "/api/v1/submissions/:id/revisions/:revisionId/restore",
  "/api/v1/submissions/:id/participants",
  "/api/v1/submissions/:id/participants/:participantId",
  "/api/v1/submissions/:id/content-status",
  // DEC-020 reopen amendment: a raw attachment upload calls
  // reopenContentReview, writing content_status back to 'pending' for a
  // submission that may have been publicly approved — the same gate
  // /api/v1/submissions/:id/content-status above bumps for. "no public
  // route ever renders a submission's files" (this list's old rationale)
  // is true but irrelevant: the write this route performs isn't the file
  // row, it's the content_status row that gates /e/*|/embed/* visibility.
  "/api/v1/submissions/:id/files",
  // DEC-741: the content note endpoint posts to the chain thread AND (when
  // requestChanges) performs the very same content_status write that
  // /api/v1/submissions/:id/content-status above bumps for, so it is
  // public-affecting for exactly that route's reasons. The note/mail half
  // alone would be never-public (cf. /api/v1/files/:id/comments), but a
  // route is classified by its most public-reaching write.
  "/api/v1/submissions/:id/content-note",
  "/api/v1/events/:id/agenda/publish",
  "/api/v1/events/:id/agenda/auto-schedule",
  "/api/v1/submissions/:id/slot",
  // DEC-022 amendment (wave 63): a break changes what the cached public
  // agenda renders (a new spanning quiet row, or one removed) — same
  // public-affecting reasoning as the slot routes immediately above.
  "/api/v1/events/:id/breaks",
  "/api/v1/breaks/:id",
  "/api/v1/contacts",
  "/api/v1/contacts/:id",
  "/api/v1/contacts/:id/headshot",
  "/api/v1/contacts/:id/add-to-event",
  "/api/v1/contacts/import",
  "/api/v1/contacts/merge",
  // Sessionboard import (DEC-612/DEC-613) writes tracks, submissions
  // (title/description/track/status) and contacts in bulk — the same rows
  // /api/v1/events/:id/tracks, /api/v1/events/:id/submissions and
  // /api/v1/contacts/import already bump for, so it is public-affecting
  // for exactly their reasons.
  "/api/v1/events/:id/import/sessionboard",
  // DEC-785: a saved embed's create/enable/disable/delete directly changes
  // whether/what GET /embed/e/:embedId (a cached public route) serves.
  "/api/v1/events/:id/embeds",
  "/api/v1/embeds/:id",
  "/portal/submissions/*",
  "/portal/profile",
  "/portal/invitations/*",
  // DEC-020 reopen amendment: the speaker-portal task-upload path reaches
  // reopenContentReview the same way /api/v1/submissions/:id/files does
  // (see above) — same content_status write, same public gate.
  "/portal/tasks/:id/upload",
];

/** DEC-627: GET/HEAD/OPTIONS never mutate, so they're always false without
 * consulting either list. For any other method, the two closed lists
 * above are consulted; anything matching neither BUMPS (fail-safe — a
 * stale public page is worse than a cold cache). The source-scanning test
 * in test/pubcache.test.ts requires every registered .post/.patch/.put/
 * .delete route under src/routes/** to match exactly one of the two
 * lists, so this fail-safe default is never exercised in practice. */
export function affectsPublicOutput(method: string, path: string): boolean {
  const upper = method.toUpperCase();
  if (upper === "GET" || upper === "HEAD" || upper === "OPTIONS") return false;
  return classifyMutatingPath(path) !== "never-public";
}

/** Which of DEC-627's two closed lists a (non-GET/HEAD/OPTIONS) path
 * matches — "unclassified" is the fail-safe-bump case that the source-
 * scanning test (test/pubcache-purge-classification.test.ts) asserts
 * never actually occurs for a real registered route. Exported (rather than
 * inlined into affectsPublicOutput) so that test can tell "matched
 * PUBLIC_AFFECTING" apart from "matched neither list" — both bump, but
 * only the former is a closed-list member. */
export function classifyMutatingPath(path: string): "never-public" | "public-affecting" | "unclassified" {
  if (NEVER_PUBLIC.some((p) => matchPattern(p, path))) return "never-public";
  if (PUBLIC_AFFECTING.some((p) => matchPattern(p, path))) return "public-affecting";
  return "unclassified";
}

/** After any successful (status < 400) non-GET/HEAD/OPTIONS request whose
 * path affectsPublicOutput (DEC-627), bump the public version to a fresh
 * random token — never a counter, per DEC-083 (race-proof: no lost-update
 * window from concurrent bumps). */
export async function bumpIfMutating(kv: KVStore, method: string, path: string, status: number): Promise<void> {
  if (status >= 400) return;
  if (!affectsPublicOutput(method, path)) return;
  await kv.put(PUBVER_KEY, crypto.randomUUID());
}

/** Hono middleware: GET-only, version-salted caches.default read-through
 * for public/embed HTML and the bare whole-agenda schedule.ics (DEC-442).
 * Skips only schedule.ics requests carrying an `ids` query string
 * (per-user selections would pollute the cache; DEC-083/DEC-442). Missing
 * KV/caches.default binding throws — fail loudly, no silent fallback to
 * uncached serving.
 *
 * `cache` is a thunk (not a resolved CacheLike) so module-level middleware
 * registration never touches the `caches` global at import time — it's a
 * real Workers-runtime global, but absent under vitest's node test
 * environment, and route sub-app modules must stay importable there. */
export function publicCacheMiddleware(cache: () => CacheLike) {
  return async (c: Context<AppEnv>, next: Next) => {
    if (c.req.method !== "GET" || isUncacheableIcsRequest(c.req.url)) {
      await next();
      return;
    }
    // DEC-083 wave-26 amendment: a signed-in organiser is the one visitor
    // who would actually notice the up-to-PUBLIC_VERSION_STALENESS_SECONDS
    // edge lag documented above — they're the person who just made the
    // change. Skip BOTH cache.match and cache.put for any request carrying
    // a chq_session cookie so they always render fresh; every anonymous
    // visitor (no session cookie) still reads/writes the shared cache
    // exactly as before, so scripts/perf-smoke.ts's bare-fetch, no-cookie
    // probes of public routes are unaffected.
    const cookies = parseCookies(c.req.header("cookie") ?? null);
    if (SESSION_COOKIE_NAME in cookies) {
      await next();
      return;
    }
    if (!c.env.KV) throw new Error("publicCacheMiddleware requires the KV binding");
    const kv: KVStore = c.env.KV;
    // executionCtxOf is the one deliberate reader of Hono's throwing
    // c.executionCtx getter (src/server/execution-ctx.ts) — captured once
    // here so the waitUntil closure below never re-accesses the getter.
    const ctx = executionCtxOf(c);
    const waitUntil = ctx ? (p: Promise<unknown>) => ctx.waitUntil(p) : undefined;
    const response = await servePublicGet(
      cache(),
      kv,
      c.req.raw,
      async () => {
        await next();
        return c.res;
      },
      waitUntil,
    );
    c.res = response;
  };
}

/** Registered once in createBaseApp (DEC-083), ahead of every route sub-app
 * mount, so any successful mutating request anywhere in the app bumps the
 * public cache version.
 *
 * DEC-427: a missing KV *binding* is a configuration bug (a violated
 * internal invariant) and still throws — fail loudly. But the KV *write*
 * itself runs after the handler's mutation has already committed, so a
 * rejection from that write is IO failure at an external boundary: it is
 * caught and logged loudly (console.error, naming PUBVER_KEY and the
 * error) rather than propagated, and the response keeps whatever status
 * the handler produced. Failing the request here would turn a successful,
 * already-committed write into a false failure for the caller. */
export async function bumpPublicVersionMiddleware(c: Context<AppEnv>, next: Next): Promise<void> {
  await next();
  if (!c.env.KV) throw new Error("bumpPublicVersionMiddleware requires the KV binding");
  try {
    const path = new URL(c.req.url).pathname;
    await bumpIfMutating(c.env.KV, c.req.method, path, c.res.status);
  } catch (err) {
    console.error(`bumpPublicVersionMiddleware: failed to bump ${PUBVER_KEY}`, err);
  }
}
