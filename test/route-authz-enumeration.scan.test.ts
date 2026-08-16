// DEC-459 amendment (wave 21): the route-authorization enumeration becomes
// executable. docs/verification-log/task-w18-d-route-authz-inventory-stage1.md
// is prose pinned to sha d034a9e0 -- true the moment it was written, false
// the moment a route is added or a guard is removed. This scan re-derives
// the population AT TEST TIME: every `<subApp>.(get|post|put|patch|delete|
// all)(<string literal path>, ...)` registration under src/routes/**, text-
// matched (not parsed by a real TS parser -- this repo already does text
// scans elsewhere, e.g. test/file-delete-ordering.scan.test.ts, whose
// length-preserving stripComments is copied verbatim below so line numbers
// stay accurate).
//
// Classification, two-directional:
//   GUARDED    - registrationText names one of the real exported role
//                guards read out of src/server/middleware.ts (requireRole-
//                derived exports), OR the two named review-plan guards that
//                live outside middleware.ts and are called as the first
//                statement in the handler body rather than in the Hono
//                middleware chain (requireReviewerOrOrganizer,
//                requireAssignedPlan -- src/routes/review/shared.ts), OR a
//                `<subApp>.use(prefix, guard)` in the same file whose prefix
//                covers the route's path (the "Mount-level guard" pattern
//                the doc cites repeatedly: requireOrganizer on contacts/
//                events/pipeline/portal-config, speakerGate on the portal
//                sub-apps), OR registrationText contains an object-level
//                ownership marker
//                -- the doc's own vocabulary generalized to the naming
//                convention it exhibits throughout (requireOwned*, *Scope,
//                *Ownership, *ForOrg, assert*, authz*, canAccess*, plus the
//                literal markers DEC-459 names: requireAuth(,
//                assertEventOwnership(, requireOwnedEvent(,
//                requireOwnedContact(, getEventForOrg(, currentOrgId(,
//                c.var.auth, and auth.userId/auth.orgId/auth.contactId self-
//                scoping reads).
//   PUBLIC_BY_DESIGN - not GUARDED, but present in the ledger below, seeded
//                from the PBD rows already audited and cited in
//                docs/verification-log/task-w18-d-route-authz-inventory-stage1.md.
//   GAP        - neither. Fails the test naming file:line.
//
// A second, independent direction: every registration whose method is not
// GET/HEAD/OPTIONS must name a CSRF guard (csrfJson, csrfForm,
// csrfFormOrHeader) in registrationText, or appear in CSRF_EXEMPT with a
// reason.
//
// Both ledgers are two-directional: an entry matching no live registration
// fails as stale ("delete this ledger line").
//
// Tripwires: total registrations >= 140 (the doc counted 157 at its sha) and
// PUBLIC_BY_DESIGN entries <= 40, so neither the regex nor the ledger can
// quietly swallow the population.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const ROUTES_ROOT = join(ROOT, "src", "routes");
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

// ---------------------------------------------------------------------------
// stripComments -- copied verbatim from test/file-delete-ordering.scan.test.ts
// so line numbers stay accurate (length-preserving: comments become spaces,
// newlines inside block comments are kept as newlines).
// ---------------------------------------------------------------------------
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = i + 1 < n ? src[i + 1] : "";
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (c === "/" && c2 === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < n) {
        out += "  ";
        i += 2;
      }
      continue;
    }
    // Amendment to the copied stripComments: a bare `'` preceded by a word
    // character is an English contraction inside raw JSX text (e.g. "You'll",
    // "contact's", "don't" in src/routes/auth.tsx), not a string literal
    // opener -- .tsx JSX text nodes are NOT string literals, so treating
    // every apostrophe as a quote desyncs paren-matching across the rest of
    // the file. Only `'` gets this treatment (`"` and `` ` `` never appear
    // mid-word in prose).
    if (c === "'" && /[A-Za-z0-9_]/.test(src[i - 1] ?? "")) {
      out += c;
      i++;
      continue;
    }
    // Amendment to the copied stripComments: a regex literal (e.g.
    // `/[\r\n"]/g` in src/routes/files.ts) can contain quote/paren
    // characters that are not string/paren syntax -- undetected, they
    // desync both quote-tracking and paren-matching for the rest of the
    // file. Detected by the standard lexer heuristic (a `/` is a regex
    // opener, not division, when the last significant char emitted isn't
    // an identifier/`)`/`]`); its interior (including any `(`, `)`, `"`,
    // `'`) is neutralized to `x` so it can never register as one.
    if (c === "/" && c2 !== "/" && c2 !== "*") {
      const prevSignificant = out.trimEnd().slice(-1);
      // Whitelist (not blacklist): JSX self-closing tags routinely put a
      // `/` right after `}` or `>` (e.g. `value={x} />`) which is not a
      // regex-preceding token in ordinary JS/TS lexing, but reads as "not a
      // word char" under a blacklist -- it must not trigger regex-literal
      // scanning and neutralize real code.
      // `<` is deliberately excluded: `</Foo>` (a JSX closing tag) puts a
      // `/` right after `<`, which is not a regex-preceding token here.
      const isRegexContext = prevSignificant === "" || "(,=:[!&|?;{+-*%^~".includes(prevSignificant);
      if (isRegexContext) {
        let j = i + 1;
        let inClass = false;
        let closed = false;
        while (j < n && src[j] !== "\n") {
          if (src[j] === "\\" && j + 1 < n) {
            j += 2;
            continue;
          }
          if (src[j] === "[") {
            inClass = true;
            j++;
            continue;
          }
          if (src[j] === "]") {
            inClass = false;
            j++;
            continue;
          }
          if (src[j] === "/" && !inClass) {
            j++;
            closed = true;
            break;
          }
          j++;
        }
        if (closed) {
          while (j < n && /[a-z]/i.test(src[j] ?? "")) j++;
          out += "x".repeat(j - i);
          i = j;
          continue;
        }
        // Not actually a regex (no closing `/` before end of line) --
        // fall through and treat `/` as an ordinary character.
      }
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\" && i + 1 < n) {
          out += (src[i] ?? "") + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i];
        i++;
      }
      if (i < n) {
        out += src[i];
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

/** Finds the index of the `)` matching the `(` at `openIdx`, walking the
 * (comment-stripped, but still string-bearing) source and skipping over
 * string/template literal contents so a stray paren inside a literal can't
 * desynchronize the count. */
function findMatchingParen(src: string, openIdx: number): number {
  let depth = 0;
  let i = openIdx;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === "(") {
      depth++;
    } else if (c === ")") {
      depth--;
      if (depth === 0) return i;
    } else if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\" && i + 1 < n) i++;
        i++;
      }
    }
    i++;
  }
  throw new Error(`unbalanced parens starting at index ${openIdx}`);
}

/** Reads a string literal starting at `quoteIdx` (the index OF the opening
 * quote char), returning its raw (unescaped) contents. */
function readStringLiteral(src: string, quoteIdx: number): string {
  const quote = src[quoteIdx];
  let i = quoteIdx + 1;
  let out = "";
  while (i < src.length && src[i] !== quote) {
    if (src[i] === "\\" && i + 1 < src.length) {
      out += src[i + 1];
      i += 2;
      continue;
    }
    out += src[i];
    i++;
  }
  return out;
}

interface RouteReg {
  file: string; // repo-relative path
  line: number; // 1-indexed line of the registration call
  method: string; // GET, POST, ...
  path: string;
  registrationText: string;
}

const REG_CALL = /\b[A-Za-z_$][\w$]*\.(get|post|put|patch|delete|all)\s*\(/g;

function findRegistrations(file: string, rawSrc: string): RouteReg[] {
  const src = stripComments(rawSrc);
  const out: RouteReg[] = [];
  let match: RegExpExecArray | null;
  REG_CALL.lastIndex = 0;
  while ((match = REG_CALL.exec(src))) {
    const methodGroup = match[1];
    if (!methodGroup) continue;
    const method = methodGroup.toUpperCase();
    const openParenIdx = match.index + match[0].length - 1;
    // First arg must be a string literal path -- skip non-literal-path
    // call sites (e.g. helper wrappers, unrelated `.get(` calls on plain
    // objects/Maps that happen to match the receiver.method( shape).
    let j = openParenIdx + 1;
    while (j < src.length && /\s/.test(src[j] ?? "")) j++;
    const q = src[j];
    if (q !== '"' && q !== "'" && q !== "`") continue;
    const path = readStringLiteral(src, j);
    if (!path.startsWith("/")) continue; // not a route path literal
    const closeParenIdx = findMatchingParen(src, openParenIdx);
    const registrationText = src.slice(match.index, closeParenIdx + 1);
    const lineIdx = src.slice(0, match.index).split("\n").length - 1;
    out.push({
      file: relative(ROOT, file).split("\\").join("/"),
      line: lineIdx + 1,
      method,
      path,
      registrationText,
    });
  }
  return out;
}

interface MountUse {
  file: string;
  prefix: string; // "*" or a leading path segment like "/contacts" or "/profile/*"
  useText: string; // the args between the prefix literal and the closing paren
}

const USE_CALL = /\b[A-Za-z_$][\w$]*\.use\s*\(/g;

/** Finds every `<subApp>.use(<literal prefix>, <middleware...>)` call in a
 * file -- e.g. `contactsRoutes.use("/contacts", requireOrganizer)`,
 * `portalRoutes.use("*", speakerGate)` -- a route-level guard many mounts
 * apply once for a whole sub-app or path prefix rather than per registration
 * (cited throughout docs/verification-log/task-w18-d-...: "Mount-level
 * guard"). A route registration is GUARDED if any such use's prefix covers
 * its path and its middleware args name a real guard. */
function findMountUses(file: string, rawSrc: string): MountUse[] {
  const src = stripComments(rawSrc);
  const out: MountUse[] = [];
  let match: RegExpExecArray | null;
  USE_CALL.lastIndex = 0;
  while ((match = USE_CALL.exec(src))) {
    const openParenIdx = match.index + match[0].length - 1;
    let j = openParenIdx + 1;
    while (j < src.length && /\s/.test(src[j] ?? "")) j++;
    const q = src[j];
    if (q !== '"' && q !== "'" && q !== "`") continue;
    const prefix = readStringLiteral(src, j);
    const closeParenIdx = findMatchingParen(src, openParenIdx);
    const literalEnd = src.indexOf(q, j + 1) + 1;
    const useText = src.slice(literalEnd, closeParenIdx);
    out.push({ file: relative(ROOT, file).split("\\").join("/"), prefix, useText });
  }
  return out;
}

/** True when a `.use(prefix, ...)` registration's prefix covers `path` --
 * `"*"` covers everything; `"/foo/*"` covers `/foo` and anything under it;
 * otherwise an exact match. */
function prefixCovers(prefix: string, path: string): boolean {
  if (prefix === "*") return true;
  if (prefix.endsWith("/*")) {
    const base = prefix.slice(0, -2);
    return path === base || path.startsWith(`${base}/`);
  }
  return path === prefix;
}

// ---------------------------------------------------------------------------
// Guard names -- read out of src/server/middleware.ts rather than assumed,
// per DEC-459's own instruction. Matches `export const NAME` / `export
// function NAME` where NAME looks like a role guard (require*).
//
// DEC-459 wave 35 amendment: sessionLoader and noStoreByDefault are
// deliberately excluded from the guard vocabulary. sessionLoader only SETS
// c.var.auth (it never refuses a request -- it runs on every request,
// authenticated or not, and downstream code decides what to do with an
// absent auth). noStoreByDefault only sets a Cache-Control header. Neither
// one refuses anything, so neither can stand as evidence of authorization.
// ---------------------------------------------------------------------------
const middlewareSrc = stripComments(readFileSync(join(ROOT, "src", "server", "middleware.ts"), "utf8"));
const MIDDLEWARE_EXPORT_NAMES: string[] = [];
{
  const re = /export (?:const|function) (require\w+)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(middlewareSrc))) {
    const name = m[1];
    if (name) MIDDLEWARE_EXPORT_NAMES.push(name);
  }
}
// Sanity: middleware.ts must actually export the role guards this scan
// depends on -- if a rename ever drops these, fail loudly here rather than
// silently classifying every organizer-only route as a GAP.
expect_(MIDDLEWARE_EXPORT_NAMES.includes("requireOrganizer"), "middleware.ts must export requireOrganizer");
expect_(MIDDLEWARE_EXPORT_NAMES.includes("requireSpeaker"), "middleware.ts must export requireSpeaker");
function expect_(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

// The two review-plan guards live in src/routes/review/shared.ts (not
// middleware.ts) and are called as the first line of the handler body
// rather than passed in the Hono middleware chain -- named explicitly by
// DEC-459 ("the reviewer guard") because a chain-only scan would miss them.
// requireAuthOr302 lives locally in src/routes/account.tsx for the same
// reason (also named explicitly by DEC-459).
// speakerGate (src/routes/portal/shared.tsx) is the portal sub-apps' own
// role guard, applied the same way requireOrganizer is applied to the
// contacts/pipeline/events mounts -- via `<subApp>.use(prefix, guard)`
// rather than per-route, so it never appears in an individual
// registration's own chain (see MOUNT_LEVEL_USES below).
const EXTRA_GUARD_NAMES = ["requireReviewerOrOrganizer", "requireAssignedPlan", "requireAuthOr302", "speakerGate"];
const ROLE_GUARD_EXPORTS = [...MIDDLEWARE_EXPORT_NAMES, ...EXTRA_GUARD_NAMES];
const GUARD_NAMES = new Set(ROLE_GUARD_EXPORTS);

// DEC-459 wave 35 amendment: a CSRF guard proves the request came from our
// own page (double-submit token match) -- it says nothing about WHO may
// perform it, so it must never fold into GUARD_NAMES. Kept in a disjoint
// set, asserted below.
const CSRF_GUARD_NAMES = ["csrfJson", "csrfForm", "csrfFormOrHeader"];

// Negative control on the vocabulary split itself: if a rename ever makes a
// CSRF guard's name collide with a role-guard name (or vice versa), the
// whole classification direction silently degrades back to "any mutating
// route self-certifies" -- fail loudly here instead.
{
  const overlap = ROLE_GUARD_EXPORTS.filter((n) => (CSRF_GUARD_NAMES as string[]).includes(n));
  expect_(overlap.length === 0, `ROLE_GUARD_EXPORTS and CSRF_GUARD_NAMES must be disjoint, found: ${overlap.join(", ")}`);
}

/** Object-level ownership markers -- the doc's own vocabulary (requireAuth(,
 * assertEventOwnership(, requireOwnedEvent(, requireOwnedContact(,
 * getEventForOrg(, currentOrgId(, c.var.auth) generalized to the naming
 * convention every other ownership check in this codebase follows, so the
 * scan doesn't hand-enumerate ~40 more one-off function names the doc
 * already audited individually (requireOwnedForm, requireOwnedField,
 * requireOwnedPlan, requireOwnedSegment, requireOwnedEntry,
 * getSubmissionOwnership, getTaskOwnership, getAssignmentOwnership,
 * getSavedViewOwnership, findTemplateForOrg, findContactForOrg,
 * findEventForOrg, getEventOrgId, getOrgUserById, authzSubmissionWrite,
 * authzFileRead, authzServeFile, getHeadshotServeScope,
 * getResourceDownloadScope, getAssignmentScope, getParticipantScope,
 * assertSpeakerContactId, assertOwnAssignmentOr403, assertCookieSession,
 * loadEditableSubmission, getPortalSubmissionDetail, requireOrgUser, ...).
 */
const OWNERSHIP_MARKER = new RegExp(
  [
    "requireOwned\\w*\\(",
    "requireEvent\\(",
    "requireOrgUser\\(",
    "requireAuth\\(",
    "assert\\w*\\(",
    "authz\\w*\\(",
    "canAccess\\w*\\(",
    "currentOrgId\\(",
    "get\\w*(Ownership|Scope|ForOrg|OrgId)\\(",
    "find\\w*ForOrg\\(",
    "getOrgUserById\\(",
    "getSubmissionSummaryInEvent\\(",
    "listPlanIdsForReviewer\\(",
    "c\\.var\\.auth",
    "auth\\.(userId|orgId|contactId)",
  ].join("|"),
);

// ---------------------------------------------------------------------------
// PUBLIC_BY_DESIGN ledger -- seeded from the PBD rows audited and cited in
// docs/verification-log/task-w18-d-route-authz-inventory-stage1.md (sha
// d034a9e0), reusing their stated reasons.
// ---------------------------------------------------------------------------
interface LedgerEntry {
  file: string;
  method: string;
  path: string;
  reason: string;
}

const PUBLIC_BY_DESIGN: LedgerEntry[] = [
  // src/routes/auth.tsx
  { file: "src/routes/auth-login.tsx", method: "GET", path: "/login", reason: "renders the login form itself; must be reachable with no session" },
  { file: "src/routes/auth-login.tsx", method: "POST", path: "/login", reason: "the auth-establishing endpoint; guarded by per-email+per-IP rate limiting (DEC-072/DEC-180), never by session" },
  { file: "src/routes/auth-login.tsx", method: "POST", path: "/logout", reason: "DEC-459 (wave 35 amendment): self-scoped by possession of the caller's own session cookie -- it deletes only the session row matching the presented cookie, if any, never another caller's; a no-op for an anonymous caller with no cookie at all" },
  { file: "src/routes/auth-login.tsx", method: "GET", path: "/logout", reason: "DEC-154 (wave 25 amendment): mutates nothing at all -- it exists precisely so a bookmarked/prefetched GET cannot sign anyone out, and redirects to /login. Nothing to guard: it reads no session and touches no row" },
  { file: "src/routes/auth-claim.tsx", method: "GET", path: "/claim/:token", reason: "the 'auth' is possession of an unguessable KV claim token, not a session; this is the account-creation entry point by design" },
  { file: "src/routes/auth-claim.tsx", method: "POST", path: "/claim/:token", reason: "same token-possession model, plus per-IP rate limiting" },
  { file: "src/routes/auth-reset.tsx", method: "GET", path: "/forgot", reason: "DEC-014 (wave 25 amendment): renders the ask-for-a-link form itself; must be reachable with no session" },
  { file: "src/routes/auth-reset.tsx", method: "GET", path: "/reset/:token", reason: "DEC-014 (wave 25 amendment): the 'auth' is possession of an unguessable KV reset token, not a session, same model as /claim/:token" },
  { file: "src/routes/auth-reset.tsx", method: "POST", path: "/forgot", reason: "DEC-459 (wave 35 amendment): the auth-establishing recovery endpoint itself -- no session exists yet to check a role against; protected by per-email+per-IP rate limiting (DEC-180), not CSRF middleware" },
  { file: "src/routes/auth-reset.tsx", method: "POST", path: "/reset/:token", reason: "DEC-459 (wave 35 amendment): the 'auth' is possession of the unguessable KV reset token minted for /forgot, not a session; CSRF middleware proves nothing about who holds that token" },
  // src/routes/dev/mailbox.tsx
  { file: "src/routes/dev/mailbox.tsx", method: "GET", path: "/dev/mailbox", reason: "DEC-005: routes literally don't exist (404) unless DEV_MODE==='1'; single-tenant local dev tooling, no secrets present in Stage 1" },
  { file: "src/routes/dev/mailbox.tsx", method: "GET", path: "/dev/mailbox/:emailId/ics", reason: "same DEV_MODE gate" },
  { file: "src/routes/dev/mailbox.tsx", method: "GET", path: "/dev/mailbox/:emailId", reason: "same DEV_MODE gate" },
  // src/routes/docs.tsx
  { file: "src/routes/docs.tsx", method: "GET", path: "/docs/api", reason: "DEC-056: public no-login API docs page; documents no secrets" },
  // src/routes/docs-site.tsx -- DEC-382 (wave-3 amendment): the public docs
  // site. Reads no request-scoped data at all: every article is compiled
  // from the in-repo DOCS_GROUPS manifest, so there is no row, session or
  // tenant for a guard to scope. An unknown slug is a 404, never a redirect.
  { file: "src/routes/docs-site.tsx", method: "GET", path: "/docs", reason: "DEC-382 (wave-3 amendment): public no-login documentation index; renders the in-repo DOCS_GROUPS manifest only, no request-scoped or tenant data" },
  { file: "src/routes/docs-site.tsx", method: "GET", path: "/docs/:slug", reason: "DEC-382 (wave-3 amendment): public no-login documentation article; renders in-repo article content only, 404s an unknown slug, no request-scoped or tenant data" },
  // src/routes/root.tsx
  { file: "src/routes/root.tsx", method: "GET", path: "/admin", reason: "redirects to /login when !auth, /portal when role==='speaker'; otherwise proxies the SPA shell, which itself calls org-scoped /api/v1/* endpoints" },
  { file: "src/routes/root.tsx", method: "GET", path: "/admin/*", reason: "same redirect pattern; /admin/assets/* bypasses to the ASSETS binding (static JS/CSS, no data)" },
  { file: "src/routes/root.tsx", method: "GET", path: "/", reason: "public landing page" },
  // src/routes/public/index.tsx -- DEC-022/DEC-289. Several rows below post-
  // date the doc's sha d034a9e0 (the surface-loop path is a template
  // literal capturing verbatim as `${surface}`; the bare /e/:eventSlug and
  // /embed/:eventSlug redirects, the .xml feed twin, the chromeless embed
  // twins of the sessions/speakers drill-ins, and /e/:eventSlug/programme
  // were all added since) -- same public, no-login, DEC-022/DEC-289 SSR
  // surface convention as every other row in this file, re-verified
  // individually at this sha rather than carried over from the doc.
  { file: "src/routes/public/index.tsx", method: "GET", path: "/e/:eventSlug/${surface}", reason: "DEC-022/DEC-289: public SSR surfaces (one per SURFACES entry, template-literal registration inside the loop), no login/session dependence; visibility gated once in src/server/repo/public.ts" },
  { file: "src/routes/public/index.tsx", method: "GET", path: "/e/:eventSlug", reason: "DEC-661: bare-slug redirect to the sessions surface, resolves the event (404s an unknown slug) before redirecting; no auth" },
  { file: "src/routes/public/index.tsx", method: "GET", path: "/embed/:eventSlug", reason: "DEC-661: bare-slug redirect to the embed sessions surface, same pattern as /e/:eventSlug; no auth" },
  { file: "src/routes/public/index.tsx", method: "GET", path: "/e/:eventSlug/speakers/:contactId", reason: "DEC-022/DEC-289 public SSR surface" },
  { file: "src/routes/public/index.tsx", method: "GET", path: "/e/:eventSlug/sessions/:sessionId", reason: "DEC-022/DEC-289 public SSR surface" },
  { file: "src/routes/public/index.tsx", method: "GET", path: "/embed/:eventSlug/:surface{[a-z]+\\.json}", reason: "EMB-15/DEC-289 public embed JSON feed" },
  { file: "src/routes/public/index.tsx", method: "GET", path: "/embed/:eventSlug/:surface{[a-z]+\\.xml}", reason: "DEC-775 XML twin of the .json feed above; same visibility gate" },
  { file: "src/routes/public/index.tsx", method: "GET", path: "/embed/:eventSlug/:surface", reason: "DEC-022/DEC-289 public embed surface" },
  { file: "src/routes/public/index.tsx", method: "GET", path: "/embed/:eventSlug/sessions/:sessionId", reason: "DEC-672 chromeless embed twin of /e/:eventSlug/sessions/:sessionId; same visibility gate (getPublicSessionDetail), no new query" },
  { file: "src/routes/public/index.tsx", method: "GET", path: "/embed/:eventSlug/speakers/:contactId", reason: "DEC-672 chromeless embed twin of /e/:eventSlug/speakers/:contactId; same visibility gate (getPublicSpeakerDetail), no new query" },
  { file: "src/routes/public/index.tsx", method: "GET", path: "/e/:eventSlug/schedule.ics", reason: "DEC-022/DEC-289 public calendar feed" },
  { file: "src/routes/public/index.tsx", method: "GET", path: "/e/:eventSlug/programme", reason: "DEC-683: printable, no-login, public programme page alongside the other literal /e/ routes" },
  { file: "src/routes/public/index.tsx", method: "GET", path: "/e/:eventSlug/agenda.ics", reason: "DEC-022/DEC-289 public calendar feed" },
  // src/routes/public/saved-embed.tsx -- DEC-785/DEC-822/DEC-839, not in the
  // doc (file didn't exist at sha d034a9e0)
  { file: "src/routes/public/saved-embed.tsx", method: "GET", path: "/embed/e/:embedId", reason: "DEC-785/DEC-822/DEC-839: public saved-embed resolver, same no-login public embed model as public/index.tsx's /embed/* rows -- resolves by unguessable embedId, no org/session data returned" },
  // src/routes/public/submit.tsx -- split (wave 64) into per-route modules
  // purely to reduce merge contention on that file; no behavior change.
  { file: "src/routes/public/submit-get.tsx", method: "GET", path: "/submit/:eventSlug", reason: "public CFP form" },
  { file: "src/routes/public/submit-draft.tsx", method: "POST", path: "/submit/:eventSlug/save-draft", reason: "rate-limited (DEC-072/DEC-422), no session model" },
  { file: "src/routes/public/submit-post.tsx", method: "POST", path: "/submit/:eventSlug", reason: "rate-limited, no session model" },
];

// ---------------------------------------------------------------------------
// CSRF_EXEMPT ledger -- non-GET/HEAD/OPTIONS registrations that deliberately
// carry no csrfJson/csrfForm/csrfFormOrHeader guard.
// ---------------------------------------------------------------------------
const CSRF_EXEMPT: LedgerEntry[] = [
  { file: "src/routes/auth-login.tsx", method: "POST", path: "/login", reason: "the auth-establishing endpoint itself -- no session/cookie exists yet to double-submit against; protected by rate limiting instead (DEC-072/DEC-180)" },
  { file: "src/routes/auth-claim.tsx", method: "POST", path: "/claim/:token", reason: "no session exists yet at account-claim time; protected by the unguessable token + per-IP rate limiting instead" },
  { file: "src/routes/public/submit-draft.tsx", method: "POST", path: "/submit/:eventSlug/save-draft", reason: "anonymous public CFP submitter has no session to double-submit against; protected by rate limiting instead (DEC-072/DEC-422)" },
  { file: "src/routes/public/submit-post.tsx", method: "POST", path: "/submit/:eventSlug", reason: "anonymous public CFP submitter has no session to double-submit against; protected by rate limiting instead" },
];

function findLedgerMatch(ledger: LedgerEntry[], reg: RouteReg): LedgerEntry | undefined {
  return ledger.find((e) => e.file === reg.file && e.method === reg.method && e.path === reg.path);
}

/** True when some `.use(prefix, ...)` in the SAME file names a guard (role
 * middleware or ownership marker) and its prefix covers `reg`'s path -- the
 * "Mount-level guard" pattern the doc cites throughout (contacts/segments,
 * events, pipeline, portal-config, the whole portal sub-apps via
 * speakerGate). */
function mountLevelGuardCovers(reg: RouteReg, mountUses: MountUse[]): boolean {
  return mountUses.some((u) => {
    if (u.file !== reg.file) return false;
    if (!prefixCovers(u.prefix, reg.path)) return false;
    const hasGuard = [...GUARD_NAMES].some((name) => new RegExp(`\\b${name}\\b`).test(u.useText));
    const hasOwnershipMarker = OWNERSHIP_MARKER.test(u.useText);
    return hasGuard || hasOwnershipMarker;
  });
}

/** DEC-459 wave 35 amendment: the classifier as a pure, exported function so
 * it can be shown a violation directly -- a synthetic registration whose
 * only middleware is a CSRF guard (or sessionLoader/noStoreByDefault) must
 * classify 'gap', not 'guarded'. Both the population test below and the
 * negative-control unit tests call this same function, so there is no
 * second copy of the logic to drift out of sync. */
export function classifyRegistration(reg: RouteReg, mountUses: MountUse[]): "guarded" | "public-by-design" | "gap" {
  const chainHasGuard = [...GUARD_NAMES].some((name) => new RegExp(`\\b${name}\\b`).test(reg.registrationText));
  const hasOwnershipMarker = OWNERSHIP_MARKER.test(reg.registrationText);
  if (chainHasGuard || hasOwnershipMarker) return "guarded";
  if (mountLevelGuardCovers(reg, mountUses)) return "guarded";
  if (findLedgerMatch(PUBLIC_BY_DESIGN, reg)) return "public-by-design";
  return "gap";
}

describe("route-authz-enumeration.scan (DEC-459 amendment, wave 21)", () => {
  const files: string[] = [];
  walk(ROUTES_ROOT, files);

  const registrations: RouteReg[] = [];
  const mountUses: MountUse[] = [];
  for (const file of files) {
    const rawSrc = readFileSync(file, "utf8");
    try {
      registrations.push(...findRegistrations(file, rawSrc));
      mountUses.push(...findMountUses(file, rawSrc));
    } catch (err) {
      throw new Error(`${file}: ${(err as Error).message}`);
    }
  }

  it("tripwire: registration count doesn't silently collapse", () => {
    expect(registrations.length).toBeGreaterThanOrEqual(140);
  });

  it("tripwire: PUBLIC_BY_DESIGN ledger stays a small, deliberate list", () => {
    expect(PUBLIC_BY_DESIGN.length).toBeLessThanOrEqual(40);
  });

  it("every registration is GUARDED or ledgered PUBLIC_BY_DESIGN -- no GAP", () => {
    const gaps: string[] = [];
    for (const reg of registrations) {
      const verdict = classifyRegistration(reg, mountUses);
      if (verdict === "gap") gaps.push(`${reg.file}:${reg.line} ${reg.method} ${reg.path}`);
    }
    expect(gaps, `unguarded, unledgered registrations (add a guard or a PUBLIC_BY_DESIGN ledger row):\n${gaps.join("\n")}`).toEqual([]);
  });

  it("every non-GET/HEAD/OPTIONS registration names a CSRF guard, or is CSRF_EXEMPT", () => {
    const gaps: string[] = [];
    for (const reg of registrations) {
      if (reg.method === "GET" || reg.method === "HEAD" || reg.method === "OPTIONS") continue;
      const hasCsrfGuard = CSRF_GUARD_NAMES.some((name) => new RegExp(`\\b${name}\\b`).test(reg.registrationText));
      if (hasCsrfGuard) continue;
      if (findLedgerMatch(CSRF_EXEMPT, reg)) continue;
      gaps.push(`${reg.file}:${reg.line} ${reg.method} ${reg.path}`);
    }
    expect(gaps, `mutating registrations with no CSRF guard and no CSRF_EXEMPT ledger row:\n${gaps.join("\n")}`).toEqual([]);
  });

  it("PUBLIC_BY_DESIGN ledger has no stale entries (every row matches a live registration)", () => {
    const stale: string[] = [];
    for (const entry of PUBLIC_BY_DESIGN) {
      const match = registrations.find((r) => r.file === entry.file && r.method === entry.method && r.path === entry.path);
      if (!match) stale.push(`${entry.file} ${entry.method} ${entry.path}`);
    }
    expect(stale, `stale PUBLIC_BY_DESIGN entries (delete these lines -- no matching live registration):\n${stale.join("\n")}`).toEqual([]);
  });

  it("CSRF_EXEMPT ledger has no stale entries (every row matches a live registration)", () => {
    const stale: string[] = [];
    for (const entry of CSRF_EXEMPT) {
      const match = registrations.find((r) => r.file === entry.file && r.method === entry.method && r.path === entry.path);
      if (!match) stale.push(`${entry.file} ${entry.method} ${entry.path}`);
    }
    expect(stale, `stale CSRF_EXEMPT entries (delete these lines -- no matching live registration):\n${stale.join("\n")}`).toEqual([]);
  });

  it("every non-GET/HEAD/OPTIONS PUBLIC_BY_DESIGN row names a non-session protection in its reason", () => {
    const NON_SESSION_PROTECTION = /rate.?limit|token|unguessable|possession/i;
    const bad: string[] = [];
    for (const entry of PUBLIC_BY_DESIGN) {
      if (entry.method === "GET" || entry.method === "HEAD" || entry.method === "OPTIONS") continue;
      if (!NON_SESSION_PROTECTION.test(entry.reason)) bad.push(`${entry.file} ${entry.method} ${entry.path}: ${entry.reason}`);
    }
    expect(
      bad,
      `PUBLIC_BY_DESIGN rows for a mutating route must name a real, non-session protection (rate limit, or possession of an unguessable token) in their reason -- CSRF middleware proves nothing about who may perform the action:\n${bad.join("\n")}`,
    ).toEqual([]);
  });
});

describe("classifyRegistration negative controls (DEC-459 wave 35 amendment)", () => {
  function synthReg(registrationText: string): RouteReg {
    return { file: "src/routes/__synthetic__.tsx", line: 1, method: "POST", path: "/__synthetic__", registrationText };
  }

  it("a registration whose ONLY middleware is a CSRF guard classifies 'gap' -- proves the scan can fail", () => {
    const reg = synthReg('app.post("/__synthetic__", csrfJson, async (c) => c.json({}))');
    expect(classifyRegistration(reg, [])).toBe("gap");
  });

  it("a registration whose ONLY middleware is sessionLoader classifies 'gap' -- setting auth is not refusing", () => {
    const reg = synthReg('app.post("/__synthetic__", sessionLoader, async (c) => c.json({}))');
    expect(classifyRegistration(reg, [])).toBe("gap");
  });

  it("a registration whose ONLY middleware is noStoreByDefault classifies 'gap' -- a header is not a refusal", () => {
    const reg = synthReg('app.post("/__synthetic__", noStoreByDefault, async (c) => c.json({}))');
    expect(classifyRegistration(reg, [])).toBe("gap");
  });

  it("a registration naming a real role guard classifies 'guarded' -- proves the scan can pass", () => {
    const reg = synthReg('app.post("/__synthetic__", requireOrganizer, async (c) => c.json({}))');
    expect(classifyRegistration(reg, [])).toBe("guarded");
  });

  it("ROLE_GUARD_EXPORTS and CSRF_GUARD_NAMES are disjoint", () => {
    const overlap = ROLE_GUARD_EXPORTS.filter((n) => (CSRF_GUARD_NAMES as string[]).includes(n));
    expect(overlap).toEqual([]);
  });

  it("sessionLoader and noStoreByDefault are excluded from both guard vocabularies", () => {
    expect(GUARD_NAMES.has("sessionLoader")).toBe(false);
    expect(GUARD_NAMES.has("noStoreByDefault")).toBe(false);
    expect(CSRF_GUARD_NAMES).not.toContain("sessionLoader");
    expect(CSRF_GUARD_NAMES).not.toContain("noStoreByDefault");
  });
});
