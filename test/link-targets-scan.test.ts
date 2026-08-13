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

function scanRouterTargets(text: string): LineHit[] {
  const hits: LineHit[] = [];
  // Narrower, deliberate patterns rather than one greedy regex, so each
  // capture group's semantics stay obvious at the call site.
  const patterns = [
    /\bto=\{`([^`]*)`\}/g, // to={`...`}
    /\bto="([^"]*)"/g, // to="..."
    /\bto='([^']*)'/g, // to='...'
    /\bnavigate\(`([^`]*)`\)/g, // navigate(`...`)
    /\bnavigate\("([^"]*)"\)/g, // navigate("...")
    /\bnavigate\('([^']*)'\)/g, // navigate('...')
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const literal = m[1] ?? "";
      // For a template literal, only the static prefix before the first
      // interpolation is a real literal; that's still enough to catch a
      // "/admin"-prefixed target.
      const staticPrefix = literal.split("${")[0]!;
      if (staticPrefix.startsWith("/admin")) {
        hits.push({ line: findLine(text, m.index), text: m[0] });
      }
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

const TAB_SURFACES: TabSurface[] = [
  {
    pathPrefixes: ["/admin/comms", "/comms"],
    param: "tab",
    labels: ["Compose", "Templates", "History", "Comms history"],
  },
  {
    pathPrefixes: ["/admin/contacts", "/contacts"],
    param: "tab",
    labels: ["Directory", "Duplicates", "Segments", "Pipeline", "Duplicates tab"],
  },
  {
    pathPrefixes: ["/admin/settings", "/settings"],
    param: "section",
    labels: [
      "Event",
      "Call for papers",
      "Tracks and rooms",
      "Public pages",
      "Speaker portal",
      "People and roles",
      "Your data",
    ],
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

describe("in-app link targets land where they say (DEC-837)", () => {
  it("scans at least a floor count of app source files", () => {
    expect(sourceFiles.length).toBeGreaterThan(50);
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
  }
});
