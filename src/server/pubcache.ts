// J10 / DEC-083: real purge-on-publish edge caching for public surfaces.
// Supersedes DEC-022's "no purge machinery" sentence (client-facing
// Cache-Control stays DEC-022's max-age=60 + stale-while-revalidate=300;
// setCacheHeaders in src/routes/public.tsx is unchanged). The stored copy
// in caches.default carries a long max-age because purge is a version
// swap, not a TTL wait: bumpPublicVersionMiddleware writes a fresh random
// token to KV after any successful (status < 400) non-GET/HEAD/OPTIONS
// request, and publicCacheMiddleware folds that version into the cache
// key so a purge is just "the old key is never looked up again" (O(1),
// no URL enumeration, no lost-update window from concurrent counters).
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

import type { Context, Next } from "hono";
import type { AppEnv } from "./env";
import type { KVStore } from "../lib/draft";
import { DEC_627 } from "../decisions";

void DEC_627;

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
const CLIENT_CACHE_CONTROL_OVERRIDE = "public, max-age=86400";

/** DEC-099: client-facing Cache-Control for cache-hit responses. Must stay
 * byte-identical to setCacheHeaders's header value in src/routes/public.tsx
 * (line ~61) — that module is not pure-core so it isn't imported here. */
export const CLIENT_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";

/** Reads the current public version, defaulting to 'v0' when the key is
 * simply absent (a fresh KV namespace pre-first-mutation). A missing KV
 * *binding* is a caller bug and is not handled here — fail loudly. */
export async function readPublicVersion(kv: KVStore): Promise<string> {
  const raw = await kv.get(PUBVER_KEY);
  return raw ?? ABSENT_VERSION;
}

/** Builds the version-salted cache key for a given request URL. */
export function versionedCacheKey(url: string, version: string): Request {
  const keyed = new URL(url);
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
): Promise<Response> {
  const version = await readPublicVersion(kv);
  const cacheKey = versionedCacheKey(request.url, version);

  const hit = await cache.match(cacheKey);
  if (hit) {
    // Cached Response headers are immutable, so build a fresh Response
    // wrapping the same body and restore the client-facing Cache-Control
    // (the stored copy carries the internal 86400 override).
    const restored = new Response(hit.body, hit);
    restored.headers.set("Cache-Control", CLIENT_CACHE_CONTROL);
    return restored;
  }

  const response = await next();
  if (response.status === 200) {
    const stored = new Response(response.clone().body, response);
    stored.headers.set("Cache-Control", CLIENT_CACHE_CONTROL_OVERRIDE);
    await cache.put(cacheKey, stored);
  }
  return response;
}

/** DEC-627: a single path pattern in one of the two closed lists below.
 * `:seg` matches exactly one non-empty path segment; a trailing `*`
 * (whether or not preceded by `/`) matches any suffix (including none) —
 * i.e. it's a plain string-prefix match on the pattern with the `*`
 * stripped. Every other segment must match literally. */
type PathPattern = string;

function matchPattern(pattern: PathPattern, path: string): boolean {
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
 * /api/v1/submissions/:id/files (raw attachment upload) is here, not in
 * PUBLIC-AFFECTING: no public route ever renders a submission's files —
 * only submission content-status (separately listed below, PUBLIC-
 * AFFECTING) gates whether approved content is publicly visible.
 * /api/v1/forms/* and /api/v1/fields/* (CFP form-builder) are here too:
 * the /submit/:eventSlug page that renders them is never behind the
 * cache (only /e/* and /embed/* are), so editing the form structure has
 * nothing cached to invalidate. */
const NEVER_PUBLIC: PathPattern[] = [
  "/login",
  "/logout",
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
  "/api/v1/contacts/bulk-email*",
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
  "/api/v1/events/:id/files/archive",
  "/api/v1/submissions/:id/files",
  "/api/v1/forms/*",
  "/api/v1/fields/*",
  "/api/v1/users*",
  "/portal/tasks/*",
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
const PUBLIC_AFFECTING: PathPattern[] = [
  "/api/v1/events",
  "/api/v1/events/:id",
  "/api/v1/events/:id/tracks",
  "/api/v1/tracks/:id",
  "/api/v1/events/:id/rooms",
  "/api/v1/rooms/:id",
  "/api/v1/events/:id/submissions",
  "/api/v1/events/:id/submissions/status",
  "/api/v1/submissions/:id",
  "/api/v1/submissions/:id/clone",
  "/api/v1/submissions/:id/revisions/:revisionId/restore",
  "/api/v1/submissions/:id/participants",
  "/api/v1/submissions/:id/participants/:participantId",
  "/api/v1/submissions/:id/content-status",
  "/api/v1/events/:id/agenda/publish",
  "/api/v1/events/:id/agenda/auto-schedule",
  "/api/v1/submissions/:id/slot",
  "/api/v1/contacts",
  "/api/v1/contacts/:id",
  "/api/v1/contacts/:id/headshot",
  "/api/v1/contacts/:id/add-to-event",
  "/api/v1/contacts/import",
  "/api/v1/contacts/merge",
  "/portal/submissions/*",
  "/portal/profile",
  "/portal/invitations/*",
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
    if (!c.env.KV) throw new Error("publicCacheMiddleware requires the KV binding");
    const kv: KVStore = c.env.KV;
    const response = await servePublicGet(cache(), kv, c.req.raw, async () => {
      await next();
      return c.res;
    });
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
