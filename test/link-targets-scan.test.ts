// DEC-837 source-scan guard: a link is the route it LANDS on.
//
// (a) The whole app mounts under <BrowserRouter basename="/admin">
// (app/src/App.tsx). Every react-router in-app target (`to="…"`,
// `to={`…`}`, `navigate('…')`, `navigate(`…`)`) is resolved AGAINST that
// basename already -- a literal that itself starts with "/admin" doubles
// the prefix (e.g. "/admin/contacts" -> "/admin/admin/contacts", a 404).
// The one-time bug this guards: NewContactModal's duplicate-hint <Link>
// pointed at `/admin/contacts?openContact=<id>` instead of
// `/contacts?openContact=<id>`.
//
// (b) A handful of /admin pages (Comms, Contacts) are internally
// tab/panel-based, reading their active tab from `?tab=` (Comms.tsx,
// ContactsApp.tsx). A plain <a href> or <Link to> whose visible label
// names one of those tabs, but whose target carries no `?tab=`/`?section=`
// param, silently lands on the surface's *fallback* tab instead of the one
// the label promised (e.g. BulkEmailModal's "View in Comms history" link
// landing on Compose because it pointed at bare `/admin/comms`).
//
// This is a pure source-text scan (no bundler, no DOM) so it stays cheap
// and catches the literal-string class of bug even though it can't reason
// about dynamically-built hrefs.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..");
const APP_SRC_DIR = join(REPO_ROOT, "app", "src");

function glob(dir: string, suffixes: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...glob(full, suffixes));
    } else if (suffixes.some((suffix) => entry.endsWith(suffix))) {
      out.push(full);
    }
  }
  return out;
}

// Test/story files aren't shipped routes; scanning them would just chase
// fixture strings the scan itself doesn't own.
const sourceFiles = glob(APP_SRC_DIR, [".tsx"]).filter((f) => !f.includes(".test."));

interface LineHit {
  line: number;
  text: string;
}

function findLine(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

// ---- rule (a): no basename-prefixed react-router target -----------------

// Narrower, deliberate patterns rather than one greedy regex, so each
// capture group's semantics stay obvious at each call site. Shared between
// rule (a)'s basename check and rule (c)'s route-resolution check below --
// both scan the exact same set of `to=`/`navigate()` targets.
const ROUTER_TARGET_PATTERNS = [
  /\bto=\{`([^`]*)`\}/g, // to={`...`}
  /\bto="([^"]*)"/g, // to="..."
  /\bto='([^']*)'/g, // to='...'
  /\bnavigate\(`([^`]*)`\)/g, // navigate(`...`)
  /\bnavigate\("([^"]*)"\)/g, // navigate("...")
  /\bnavigate\('([^']*)'\)/g, // navigate('...')
];

interface RouterTargetHit extends LineHit {
  literal: string;
  isPrefix: boolean; // template literal: only the static prefix is known
}

function scanAllRouterTargets(text: string): RouterTargetHit[] {
  const hits: RouterTargetHit[] = [];
  for (const re of ROUTER_TARGET_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const literal = m[1] ?? "";
      const isTemplate = m[0].includes("`");
      // For a template literal, only the static prefix before the first
      // interpolation is a real literal; that's still enough to catch a
      // "/admin"-prefixed target or resolve against the route table.
      const staticPrefix = literal.split("${")[0]!;
      hits.push({
        line: findLine(text, m.index),
        text: m[0],
        literal: staticPrefix,
        isPrefix: isTemplate && staticPrefix !== literal,
      });
    }
  }
  return hits;
}

function scanRouterTargets(text: string): LineHit[] {
  return scanAllRouterTargets(text)
    .filter((h) => h.literal.startsWith("/admin"))
    .map((h) => ({ line: h.line, text: h.text }));
}

// ---- rule (c continued): to=/navigate() targets must resolve too --------

function scanUnresolvedRouterTargets(text: string): HrefTargetHit[] {
  const hits: HrefTargetHit[] = [];
  for (const hit of scanAllRouterTargets(text)) {
    // Rule (a) already flags a literal-"/admin"-prefixed target as a
    // basename-doubling bug in its own right; don't double-report it here.
    if (hit.literal.startsWith("/admin")) continue;
    // A target with no leading "/" (e.g. `to={`plans/${id}`}` in
    // ReviewerQueue.tsx) is a react-router RELATIVE target, resolved
    // against the current route rather than the basename root -- this
    // scan's route table only covers basename-relative absolute paths, so
    // a relative target is out of scope here (it can't 404 the way an
    // absolute-but-wrong path can; it always lands somewhere under the
    // current route).
    if (!hit.literal.startsWith("/")) continue;
    const resolved = stripQueryAndHash(hit.literal);
    if (!resolvesToRoute(resolved, hit.isPrefix)) {
      hits.push({ line: hit.line, text: hit.text, raw: hit.literal, resolved });
    }
  }
  return hits;
}

// ---- rule (b): a labeled tab/section link must carry its param ----------

interface TabSurface {
  // e.g. "/admin/comms" or "/comms" (both basename-relative and literal
  // "/admin"-prefixed hrefs are checked -- rule (a) already flags the
  // latter, but a mis-landed tab is a separate failure mode worth its own
  // message).
  pathPrefixes: string[];
  param: "tab" | "section";
  // Known closed set of tab/section labels this surface actually renders,
  // taken from the surface's own tab strip / rail (Comms.tsx TABS,
  // ContactsApp.tsx PANEL_LABELS, Settings.tsx SECTIONS) -- kept as exact
  // (not substring-of-anything-vaguely-similar) label text so this stays a
  // precise regression guard rather than a source of false positives on
  // labels that merely mention a related word (e.g. Agenda.tsx's "Add a
  // room or track" does NOT literally name the "Tracks and rooms" section).
  labels: string[];
}

// DEC-837 (wave-16 amendment): the label sets below are no longer hand-
// copied into this file (a hand copy only agrees with the surface's own
// tab/section table until the next label is renamed and nobody remembers to
// update the copy here -- exactly the drift risk this amendment closes).
// Each surface's labels are PARSED at scan time from that surface's own
// source-of-truth table, the same house pattern app/src/page-loading-
// structure.scan.test.ts's derivePageFiles() uses to parse App.tsx's
// pageLoaders rather than hand-listing pages.

/** Parses every `label: '...'` (or `label: "..."`) literal out of Settings.tsx's
 * `export const SECTIONS: SettingsSection[] = [...]` array -- the settings
 * rail's own source of truth for its section labels. */
function parseSettingsSectionLabels(): string[] {
  const source = readFileSync(join(APP_SRC_DIR, "pages", "Settings.tsx"), "utf-8");
  const arrayMatch = /export const SECTIONS: SettingsSection\[\] = \[([\s\S]*?)\n\];/.exec(source);
  if (!arrayMatch) throw new Error("Settings.tsx: could not find `export const SECTIONS: SettingsSection[] = [...]`");
  const body = arrayMatch[1]!;
  const labels: string[] = [];
  const labelRe = /label:\s*'([^']*)'|label:\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = labelRe.exec(body))) {
    labels.push((m[1] ?? m[2])!);
  }
  return labels;
}

/** Parses every `label: '...'` (or `label: "..."`) literal out of Comms.tsx's
 * `TABS: { id: Tab; label: string }[] = [...]` tab table -- the comms tab
 * strip's own source of truth for its tab labels. */
function parseCommsTabLabels(): string[] {
  const source = readFileSync(join(APP_SRC_DIR, "pages", "Comms.tsx"), "utf-8");
  const arrayMatch = /const TABS: \{ id: Tab; label: string \}\[\] = \[([\s\S]*?)\n\];/.exec(source);
  if (!arrayMatch) throw new Error("Comms.tsx: could not find `const TABS: { id: Tab; label: string }[] = [...]`");
  const body = arrayMatch[1]!;
  const labels: string[] = [];
  const labelRe = /label:\s*'([^']*)'|label:\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = labelRe.exec(body))) {
    labels.push((m[1] ?? m[2])!);
  }
  return labels;
}

/** Parses every value literal out of ContactsApp.tsx's
 * `PANEL_LABELS: Record<Panel, string> = {...}` map -- the contacts panel
 * strip's own source of truth for its panel labels. */
function parseContactsPanelLabels(): string[] {
  const source = readFileSync(join(APP_SRC_DIR, "pages", "contacts", "ContactsApp.tsx"), "utf-8");
  const objectMatch = /const PANEL_LABELS: Record<Panel, string> = \{([\s\S]*?)\n\};/.exec(source);
  if (!objectMatch) throw new Error("ContactsApp.tsx: could not find `const PANEL_LABELS: Record<Panel, string> = {...}`");
  const body = objectMatch[1]!;
  const labels: string[] = [];
  const valueRe = /:\s*'([^']*)'|:\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = valueRe.exec(body))) {
    labels.push((m[1] ?? m[2])!);
  }
  return labels;
}

const PARSED_SETTINGS_LABELS = parseSettingsSectionLabels();
const PARSED_COMMS_LABELS = parseCommsTabLabels();
const PARSED_CONTACTS_LABELS = parseContactsPanelLabels();

// Deliberate extra synonyms this scan also treats as naming a tab/section,
// kept as an explicit, separately-named additive list (not folded into the
// parsed set) so an intentional extra label still reads as intent rather
// than looking like a stray parse artifact.
const COMMS_EXTRA_LABELS = ["Comms history"];
const CONTACTS_EXTRA_LABELS = ["Duplicates tab"];

const TAB_SURFACES: TabSurface[] = [
  {
    pathPrefixes: ["/admin/comms", "/comms"],
    param: "tab",
    labels: [...PARSED_COMMS_LABELS, ...COMMS_EXTRA_LABELS],
  },
  {
    pathPrefixes: ["/admin/contacts", "/contacts"],
    param: "tab",
    labels: [...PARSED_CONTACTS_LABELS, ...CONTACTS_EXTRA_LABELS],
  },
  {
    pathPrefixes: ["/admin/settings", "/settings"],
    param: "section",
    labels: PARSED_SETTINGS_LABELS,
  },
];

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

interface LabeledLinkHit extends LineHit {
  href: string;
  label: string;
}

// Matches a single-line `<a href="...">label</a>` or `<Link to="...">label</Link>`
// (including template-literal hrefs). Multi-line link bodies and hrefs built
// from expressions (not string/template literals) are out of scope for a
// pure text scan -- both existing violations this test guards were
// single-line literal hrefs.
const LABELED_LINK_RE =
  /<(a|Link)\s+(?:[^>]*?\s)?(?:href|to)=(?:\{`([^`]*)`\}|"([^"]*)"|'([^']*)')[^>]*>([^<]*(?:<[^/][^>]*>[^<]*<\/[^>]+>[^<]*)*)<\/\1>/g;

function scanLabeledLinks(text: string): LabeledLinkHit[] {
  const hits: LabeledLinkHit[] = [];
  let m: RegExpExecArray | null;
  while ((m = LABELED_LINK_RE.exec(text))) {
    // A <Link> that also carries a `state={...}` prop uses react-router's
    // in-memory navigation state as its alternate wire (e.g.
    // MergePage.tsx's back link: `state={{ panel: 'duplicates' }}`, read by
    // ContactsApp.tsx's one-shot navState effect, DEC-684) -- a working,
    // deliberate SPA mechanism distinct from the reload-surviving ?tab=/
    // ?section= param this rule polices, so it's exempt.
    const openTag = m[0].slice(0, m[0].indexOf(">") + 1);
    if (/\bstate=\{/.test(openTag)) continue;
    const href = m[2] ?? m[3] ?? m[4] ?? "";
    const label = stripTags(m[5] ?? "");
    hits.push({ line: findLine(text, m.index), text: m[0], href, label });
  }
  return hits;
}

function violatesTabRule(href: string, label: string): TabSurface | undefined {
  return TAB_SURFACES.find((surface) => {
    const matchesSurface = surface.pathPrefixes.some((p) => href === p || href.startsWith(`${p}?`) || href.startsWith(`${p}#`));
    if (!matchesSurface) return false;
    // A hash-fragment target (e.g. "/settings#chq-settings-section-tracks")
    // is a same-page scroll anchor by design (Settings.tsx: desktop keeps
    // every section visible, no ?section= drill needed just to view one) --
    // not the ?tab=/?section= param this rule is about.
    if (href.includes("#")) return false;
    const hasParam = new RegExp(`[?&]${surface.param}=`).test(href);
    if (hasParam) return false;
    return surface.labels.some((known) => label.toLowerCase() === known.toLowerCase() || label.toLowerCase().includes(known.toLowerCase()));
  });
}

// ---- rule (c): every target must resolve to a route App.tsx actually declares ----
//
// DEC-837 (wave-17 amendment): rules (a) and (b) both police the SHAPE of a
// target string but never ask whether the path EXISTS. A `to="/contact"`
// typo or an `href="/admin/comms?tab=compose&template=…"` forward path
// (BulkEmailModal, live today) pass both existing rules and would still
// 404/fallback at runtime. This rule derives the declared route set
// straight from app/src/App.tsx's own source (never a re-typed list) and
// resolves every literal target against it.
//
// App.tsx does not actually export anything literally named `ROUTES` (the
// DEC-837 amendment text names one) -- the object that plays that role is
// `ELEMENT_BY_PATTERN`, the Record whose keys are the same literal path
// patterns as ADMIN_ROUTE_PATTERNS (src/lib/admin-routes.ts) and whose
// values are the elements each pattern renders (App.tsx:75-109). Its keys
// are parsed here as the "ROUTES" table the amendment describes; NAV_
// SECTIONS' `path` values are parsed too (a strict subset of the same set
// today, but kept as its own union member so this scan stays derived from
// BOTH literal tables the amendment names, not just one).
const APP_TSX_PATH = join(APP_SRC_DIR, "App.tsx");
const APP_TSX_SOURCE = readFileSync(APP_TSX_PATH, "utf-8");

/** Parses every `'/…':` (or `"/…":`) object-key literal out of App.tsx's
 * `const ELEMENT_BY_PATTERN: Record<...> = {...}` -- the table App.tsx
 * actually renders a <Route> for every entry of (RoutedContent maps
 * ADMIN_ROUTE_PATTERNS through this same Record). This is the "ROUTES"
 * table the DEC-837 wave-17 amendment names. */
function parseElementByPatternKeys(): string[] {
  const blockMatch = /const ELEMENT_BY_PATTERN: Record<[^>]*> = \{([\s\S]*?)\n\};/.exec(APP_TSX_SOURCE);
  if (!blockMatch) throw new Error("App.tsx: could not find `const ELEMENT_BY_PATTERN: Record<...> = {...}`");
  const body = blockMatch[1]!;
  const keys: string[] = [];
  const keyRe = /^\s*'([^']*)':|^\s*"([^"]*)":/gm;
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(body))) {
    keys.push((m[1] ?? m[2])!);
  }
  return keys;
}

/** Parses every `path: '…'` (or `path: "…"`) literal out of App.tsx's
 * `export const NAV_SECTIONS = [...] as const;` array -- the top-nav's own
 * source of truth for its route paths. */
function parseNavSectionPaths(): string[] {
  const blockMatch = /export const NAV_SECTIONS = \[([\s\S]*?)\n\] as const;/.exec(APP_TSX_SOURCE);
  if (!blockMatch) throw new Error("App.tsx: could not find `export const NAV_SECTIONS = [...] as const;`");
  const body = blockMatch[1]!;
  const paths: string[] = [];
  const pathRe = /path:\s*'([^']*)'|path:\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(body))) {
    paths.push((m[1] ?? m[2])!);
  }
  return paths;
}

const PARSED_ROUTE_KEYS = parseElementByPatternKeys();
const PARSED_NAV_PATHS = parseNavSectionPaths();

interface RoutePattern {
  segments: string[];
  wildcard: boolean; // trailing "/*" -- matches ONE OR MORE trailing segments
}

function toRoutePattern(path: string): RoutePattern {
  const trimmed = path.replace(/^\/+/, "").replace(/\/+$/, "");
  const raw = trimmed === "" ? [] : trimmed.split("/");
  if (raw[raw.length - 1] === "*") {
    return { segments: raw.slice(0, -1), wildcard: true };
  }
  return { segments: raw, wildcard: false };
}

// The declared route table: every ELEMENT_BY_PATTERN key and every
// NAV_SECTIONS path (a strict subset today), PLUS -- for each pattern that
// ends in a wildcard "/*" -- the bare prefix with the wildcard stripped.
// App.tsx's own NavLink code performs exactly this strip
// (`section.path.replace(/\/\*$/, '')`, App.tsx ~line 175/284) to build
// the actual `to=`/`navigate()` target for a wildcard section (e.g.
// '/review/*' -> '/review'), and real `to="/review"` / `navigate('/review')`
// literals exist throughout app/src/pages/review/**. A trailing "/*" here
// is treated strictly as ONE OR MORE trailing segments (the DEC-837 wave-17
// amendment's rule), so the bare prefix is registered as its OWN exact
// route rather than folded into the wildcard's match.
const ROUTE_PATTERNS: RoutePattern[] = [];
for (const raw of [...PARSED_ROUTE_KEYS, ...PARSED_NAV_PATHS]) {
  const pattern = toRoutePattern(raw);
  ROUTE_PATTERNS.push(pattern);
  if (pattern.wildcard) {
    ROUTE_PATTERNS.push({ segments: pattern.segments, wildcard: false });
  }
}

function pathSegmentsOf(path: string): string[] {
  const trimmed = path.replace(/^\/+/, "").replace(/\/+$/, "");
  return trimmed === "" ? [] : trimmed.split("/").filter((s) => s.length > 0);
}

function segmentMatchesRoute(patternSeg: string, targetSeg: string | undefined): boolean {
  if (targetSeg === undefined) return false;
  if (patternSeg.startsWith(":")) return targetSeg.length > 0;
  return patternSeg === targetSeg;
}

/** True when `path` (basename-relative, e.g. "/overview" or "/review/plans/9")
 * resolves against the declared route table. `isPrefix` is true for a
 * template-literal target where only the STATIC PREFIX (text before the
 * first `${`) is known -- the target may legitimately continue past what
 * we can see, so a route pattern longer than the known prefix still
 * counts as a match as long as every segment we DO know agrees. */
function resolvesToRoute(path: string, isPrefix: boolean): boolean {
  const targetSegments = pathSegmentsOf(path);
  return ROUTE_PATTERNS.some((route) => {
    if (route.wildcard) {
      // Needs >=1 trailing segment beyond the pattern's own prefix. For a
      // known-prefix (dynamic) target we can't see the trailing segment
      // yet, so any prefix match against the pattern's own segments is
      // accepted (the trailing segment is assumed to come from the
      // interpolated part); for a full literal we require it outright.
      const prefix = route.segments;
      if (isPrefix) {
        const n = Math.min(prefix.length, targetSegments.length);
        return prefix.slice(0, n).every((seg, i) => segmentMatchesRoute(seg, targetSegments[i]));
      }
      if (targetSegments.length < prefix.length + 1) return false;
      return prefix.every((seg, i) => segmentMatchesRoute(seg, targetSegments[i]));
    }
    if (isPrefix) {
      if (targetSegments.length > route.segments.length) return false;
      return targetSegments.every((seg, i) => segmentMatchesRoute(route.segments[i]!, seg));
    }
    if (targetSegments.length !== route.segments.length) return false;
    return route.segments.every((seg, i) => segmentMatchesRoute(seg, targetSegments[i]));
  });
}

/** Strips a query string and/or hash fragment off a path-ish string. */
function stripQueryAndHash(path: string): string {
  return path.split("?")[0]!.split("#")[0]!;
}

// Absolute hrefs that deliberately leave the SPA (real full-page nav, not a
// react-router target) -- the SSR scan's business, not this file's. Kept as
// an explicit, reviewable allowlist (each with a one-line reason) rather
// than silently falling out of the "/admin"-prefix filter unnoticed.
const NON_ADMIN_HREF_ALLOWLIST: { prefix: string; reason: string }[] = [
  { prefix: "/portal", reason: "PortalSettingsPanel 'Open as speaker' link into the separate speaker portal app" },
  { prefix: "/files/", reason: "file download/proxy served directly by the Worker, not part of the /admin SPA" },
  { prefix: "/e/", reason: "public event page (agenda view / .ics feed), a separate audience-facing surface" },
  { prefix: "/submit/", reason: "public submission form, a separate audience-facing surface" },
  { prefix: "/api/v1/", reason: "raw API export links (CSV/JSON download), hit the Worker's API directly" },
  { prefix: "/docs/api", reason: "external API documentation page" },
  { prefix: "/account/password", reason: "account/password change page, outside admin SPA routing" },
  {
    prefix: "/settings",
    reason:
      "Agenda.tsx's 'Add a room or track' anchor (`/settings#chq-settings-section-tracks`) is a plain <a>, not a " +
      "<Link>, and is written without the /admin basename -- a real full-page nav, so it is out of this scan's " +
      "scope (whether it SHOULD instead be an in-SPA link is a separate question this rule doesn't answer).",
  },
];

function matchesAllowlistEntry(href: string, prefix: string): boolean {
  // A prefix already ending in "/" (e.g. "/files/", "/api/v1/") is itself a
  // directory-style boundary -- anything beginning with it matches. A bare
  // prefix (e.g. "/portal", "/docs/api") needs a word boundary (end of
  // string, or the next char starts a path segment/query/hash) so it
  // doesn't accidentally swallow an unrelated sibling like "/portaltown".
  if (prefix.endsWith("/")) return href.startsWith(prefix);
  return href === prefix || href.startsWith(`${prefix}/`) || href.startsWith(`${prefix}?`) || href.startsWith(`${prefix}#`);
}

interface HrefTargetHit extends LineHit {
  raw: string;
  resolved: string;
}

// Matches href="/admin..." / href='/admin...' / href={`/admin...`} literals
// (static prefix only for the template-literal form) anywhere in app/src --
// this is deliberately a plain attribute scan, independent of the
// LABELED_LINK_RE tag scan above, since rule (c) doesn't care about the
// link's label, only where it lands.
const ADMIN_HREF_RE = /\bhref=(?:\{`(\/admin[^`]*)`\}|"(\/admin[^"]*)"|'(\/admin[^']*)')/g;
function scanAdminHrefTargets(text: string): HrefTargetHit[] {
  const hits: HrefTargetHit[] = [];
  let m: RegExpExecArray | null;
  ADMIN_HREF_RE.lastIndex = 0;
  while ((m = ADMIN_HREF_RE.exec(text))) {
    const raw = (m[1] ?? m[2] ?? m[3])!;
    const isPrefix = m[1] !== undefined; // the `{`...`}` alternative captured a template literal
    const withoutBasename = raw.startsWith("/admin") ? raw.slice("/admin".length) || "/" : raw;
    const resolved = stripQueryAndHash(withoutBasename);
    if (!resolvesToRoute(resolved, isPrefix)) {
      hits.push({ line: findLine(text, m.index), text: m[0], raw, resolved });
    }
  }
  return hits;
}

// Every literal href="/..." that is NOT "/admin"-prefixed, checked against
// NON_ADMIN_HREF_ALLOWLIST so a new absolute href out of that set fails
// loudly instead of silently falling out of scope.
function scanUnlistedAbsoluteHrefs(text: string): LineHit[] {
  const hits: LineHit[] = [];
  const re = /\bhref=(?:\{`([^`]*)`\}|"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = (m[1] ?? m[2] ?? m[3])!;
    if (!raw.startsWith("/") || raw.startsWith("//")) continue; // relative / protocol-relative: not this rule's business
    if (raw.startsWith("/admin")) continue; // covered by scanAdminHrefTargets above
    const allowed = NON_ADMIN_HREF_ALLOWLIST.some((entry) => matchesAllowlistEntry(raw, entry.prefix));
    if (!allowed) {
      hits.push({ line: findLine(text, m.index), text: m[0] });
    }
  }
  return hits;
}

describe("in-app link targets land where they say (DEC-837)", () => {
  it("scans at least a floor count of app source files", () => {
    expect(sourceFiles.length).toBeGreaterThan(50);
  });

  // Per-surface vacuous-parse tripwires: a future rename of SECTIONS/TABS/
  // PANEL_LABELS (or their shape) that breaks the regexes above must fail
  // loudly here instead of silently shrinking TAB_SURFACES to an
  // under-populated (or empty) label set that then rubber-stamps every link.
  // Floors are the count each parse yields on main today.
  it("parses at least 7 settings section labels from Settings.tsx SECTIONS (vacuous-scan tripwire)", () => {
    expect(PARSED_SETTINGS_LABELS.length).toBeGreaterThanOrEqual(7);
  });

  it("parses at least 3 comms tab labels from Comms.tsx TABS (vacuous-scan tripwire)", () => {
    expect(PARSED_COMMS_LABELS.length).toBeGreaterThanOrEqual(3);
  });

  it("parses at least 4 contacts panel labels from ContactsApp.tsx PANEL_LABELS (vacuous-scan tripwire)", () => {
    expect(PARSED_CONTACTS_LABELS.length).toBeGreaterThanOrEqual(4);
  });

  // Vacuous-parse tripwire for the rule (c) route table itself: a renamed/
  // reshaped ELEMENT_BY_PATTERN or NAV_SECTIONS in App.tsx must fail loudly
  // here instead of silently shrinking ROUTE_PATTERNS to a near-empty set
  // that then rubber-stamps every href/target. Floor is today's count
  // (16 ELEMENT_BY_PATTERN keys + 9 NAV_SECTIONS paths).
  it("parses at least 16 declared route keys from App.tsx's ELEMENT_BY_PATTERN (vacuous-scan tripwire)", () => {
    expect(PARSED_ROUTE_KEYS.length).toBeGreaterThanOrEqual(16);
  });

  it("parses at least 9 nav section paths from App.tsx's NAV_SECTIONS (vacuous-scan tripwire)", () => {
    expect(PARSED_NAV_PATHS.length).toBeGreaterThanOrEqual(9);
  });

  // Sanity checks on the two BulkEmailModal targets DEC-837's wave-17
  // amendment names as live examples that must resolve.
  it("resolves BulkEmailModal's live /admin/comms?tab=... targets against the declared route table", () => {
    expect(resolvesToRoute(stripQueryAndHash("/comms?tab=compose&template=x"), false)).toBe(true);
    expect(resolvesToRoute(stripQueryAndHash("/comms?tab=history"), false)).toBe(true);
  });

  it("every NON_ADMIN_HREF_ALLOWLIST entry still matches a real absolute href in app/src (no stale lines)", () => {
    // DEC-078 wave-21 amendment: an allowlist that only names a reviewable
    // prefix, never checked against a live hit, would keep passing forever
    // after the href it excused was deleted or rewritten -- silently
    // pre-clearing any future, unrelated href that happens to reuse the
    // same prefix. Collects every absolute, non-"/admin" href= literal
    // across app/src (the same raw values scanUnlistedAbsoluteHrefs checks
    // against the allowlist) and requires each allowlist prefix to match at
    // least one of them.
    const rawHrefRe = /\bhref=(?:\{`([^`]*)`\}|"([^"]*)"|'([^']*)')/g;
    const allRawHrefs: string[] = [];
    for (const file of sourceFiles) {
      const text = readFileSync(file, "utf-8");
      rawHrefRe.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rawHrefRe.exec(text))) {
        const raw = (m[1] ?? m[2] ?? m[3])!;
        if (!raw.startsWith("/") || raw.startsWith("//")) continue;
        if (raw.startsWith("/admin")) continue;
        allRawHrefs.push(raw);
      }
    }
    const stale = NON_ADMIN_HREF_ALLOWLIST.filter(
      (entry) => !allRawHrefs.some((raw) => matchesAllowlistEntry(raw, entry.prefix)),
    );
    expect(
      stale,
      stale
        .map((entry) => `NON_ADMIN_HREF_ALLOWLIST prefix "${entry.prefix}": stale entry -- delete this line (test/link-targets-scan.test.ts) -- no matching href="${entry.prefix}..." was found in app/src.`)
        .join("\n"),
    ).toEqual([]);
  });

  for (const file of sourceFiles) {
    const rel = relative(REPO_ROOT, file);
    const text = readFileSync(file, "utf-8");

    it(`${rel}: no react-router target literal starts with the basename ("/admin")`, () => {
      const hits = scanRouterTargets(text);
      if (hits.length > 0) {
        const detail = hits.map((h) => `  line ${h.line}: ${h.text}`).join("\n");
        throw new Error(
          `${rel} has a react-router target literal beginning with "/admin". The app mounts under ` +
            `<BrowserRouter basename="/admin"> (app/src/App.tsx), so an in-app \`to\`/\`navigate\` target ` +
            `must be basename-relative (e.g. "/contacts", not "/admin/contacts") or it doubles the prefix ` +
            `to "/admin/admin/..." (a 404):\n${detail}`,
        );
      }
    });

    it(`${rel}: no labeled tab/section link omits its ?tab=/?section= param`, () => {
      const hits = scanLabeledLinks(text);
      const violations = hits
        .map((h) => ({ ...h, surface: violatesTabRule(h.href, h.label) }))
        .filter((h) => h.surface);
      if (violations.length > 0) {
        const detail = violations
          .map((v) => `  line ${v.line}: href="${v.href}" label="${v.label}" (expected ?${v.surface!.param}=…)`)
          .join("\n");
        throw new Error(
          `${rel} has a link whose visible label names a tab/section of its target surface, but the ` +
            `target sets no ?${violations[0]!.surface!.param}= param, so it lands on that surface's fallback ` +
            `tab instead:\n${detail}`,
        );
      }
    });

    it(`${rel}: every basename-relative to=/navigate() target resolves to a declared route`, () => {
      const hits = scanUnresolvedRouterTargets(text);
      if (hits.length > 0) {
        const detail = hits.map((h) => `  line ${h.line}: ${h.text} (raw "${h.raw}", resolved "${h.resolved}")`).join("\n");
        throw new Error(
          `${rel} has a react-router \`to\`/\`navigate\` target that does not resolve to any route App.tsx ` +
            `declares (ELEMENT_BY_PATTERN / NAV_SECTIONS in app/src/App.tsx):\n${detail}`,
        );
      }
    });

    it(`${rel}: every literal href="/admin/..." resolves to a declared route`, () => {
      const hits = scanAdminHrefTargets(text);
      if (hits.length > 0) {
        const detail = hits.map((h) => `  line ${h.line}: ${h.text} (raw "${h.raw}", resolved "${h.resolved}")`).join("\n");
        throw new Error(
          `${rel} has an href="/admin/..." target that does not resolve to any route App.tsx declares ` +
            `(ELEMENT_BY_PATTERN / NAV_SECTIONS in app/src/App.tsx):\n${detail}`,
        );
      }
    });

    it(`${rel}: every non-"/admin" absolute href is in the leaves-the-SPA allowlist`, () => {
      const hits = scanUnlistedAbsoluteHrefs(text);
      if (hits.length > 0) {
        const detail = hits.map((h) => `  line ${h.line}: ${h.text}`).join("\n");
        throw new Error(
          `${rel} has an absolute href="/..." that is neither "/admin"-prefixed nor in ` +
            `NON_ADMIN_HREF_ALLOWLIST (test/link-targets-scan.test.ts). Either fix it to a declared /admin ` +
            `route, or add it to the allowlist with a one-line reason so it stays reviewable instead of ` +
            `silently ignored:\n${detail}`,
        );
      }
    });
  }
});
