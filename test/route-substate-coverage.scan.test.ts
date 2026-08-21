// ROSTER THE QUERY SUB-STATES NO LIVE GATE HAS EVER VISITED (DEC-144
// amendment, wave 27).
//
// routeManifest.ts IS the population every live gate (render sweep,
// overflow probe, tap-floor pass, contrast pass) walks, and DEC-144
// (wave-154 amendment)'s own routeManifest.test.ts already parity-checks
// four closed-set query keys against it: Comms.tsx's `tab`, ContactsApp
// .tsx's `tab` (Panel), Settings.tsx's `section` (SECTIONS), ContentApp
// .tsx's `tab` (WorklistTab) and `view` (ContentView). Nothing checks the
// REST of what app/src/pages/** reads off `searchParams.get(...)` --
// `edit=1` appears ZERO times in ROUTE_MANIFEST while ten SPA sites read
// it, and Settings.tsx's own comment rules that "a settings section URL
// carrying `edit=1` (SummarySection's openEdit) is a SCREEN, not a scroll
// target -- only that one panel mounts" (docs/design/DESIGN-RULINGS.md's
// B10 names the same family). This file builds that population -- never
// hand-listed (DEC-180/DEC-808) -- and files the unvisited rows in
// docs/design/audit/route-substate-coverage-v12.md.
//
// SCOPE NOTE: this file only ROSTERS the gap. It does not widen
// app/src/routeManifest.ts (that is next wave's act, once the roster below
// is filed) and it does not re-derive the four keys routeManifest.test.ts
// already parity-checks -- doing so here would be DEC-613's "second copy
// of a vocabulary" trap.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ROUTE_MANIFEST } from "../app/src/routeManifest";
import { DEC_144 } from "../src/decisions";

void DEC_144;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const APP_PAGES = join(REPO_ROOT, "app", "src", "pages");

function read(...parts: string[]): string {
  return readFileSync(join(APP_PAGES, ...parts), "utf-8");
}

function walkPageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkPageFiles(full));
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/** Every `key: '...'` entry inside Settings.tsx's `SECTIONS` array whose own
 * object block also declares an `editTitle:` -- the closed set of section
 * keys the edit-drill screen exists for (DEC-144: source-scanned, never
 * hand-listed; SECTIONS is the file's only `key: '...'`-shaped array, the
 * same assumption app/src/routeManifest.test.ts's section-key extraction
 * already relies on). */
export function extractEditableSectionKeys(source: string): string[] {
  const keyRe = /key: '([a-zA-Z0-9_-]+)'/g;
  const indices: { key: string; idx: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(source)) !== null) indices.push({ key: m[1]!, idx: m.index });
  if (indices.length === 0) throw new Error("no `key: '...'` entries found (Settings.tsx SECTIONS shape moved?)");
  const out: string[] = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i]!.idx;
    const end = i + 1 < indices.length ? indices[i + 1]!.idx : source.length;
    const block = source.slice(start, end);
    // Anchored to a line that starts (after leading whitespace) with the
    // field itself, so `public-pages`'s own "// No editTitle: the pack
    // drops an edit view for this section" comment -- which contains the
    // literal substring "editTitle:" -- is never mistaken for the field.
    if (/^ *editTitle:/m.test(block)) out.push(indices[i]!.key);
  }
  return out;
}

/** The literal a `searchParams.get('<key>')` call is compared `===` against
 * in `source` -- the single admissible non-default value for a boolean-flag
 * query key. Throws (never silently defaults) if the shape moved. */
export function extractEqualsLiteral(source: string, key: string, label: string): string {
  const re = new RegExp(`searchParams\\.get\\('${key}'\\)\\s*===\\s*'([a-zA-Z0-9_.-]+)'`);
  const m = re.exec(source);
  if (!m) throw new Error(`${label}: no \`searchParams.get('${key}') === '<literal>'\` comparison found`);
  return m[1]!;
}

/** The literal a `searchParams.get('<key>')` call is compared `!==` against
 * in `source` -- for a key whose ABSENCE is the default/open state, the one
 * admissible literal that reaches the alternate (collapsed) state. */
export function extractNotEqualsLiteral(source: string, key: string, label: string): string {
  const re = new RegExp(`searchParams\\.get\\('${key}'\\)\\s*!==\\s*'([a-zA-Z0-9_.-]+)'`);
  const m = re.exec(source);
  if (!m) throw new Error(`${label}: no \`searchParams.get('${key}') !== '<literal>'\` comparison found`);
  return m[1]!;
}

interface SubstateRow {
  path: string;
  reader: string;
  rulingNote: string;
}

/** Every derived (route, key, value) row this file's closed-set keys mint,
 * regardless of whether ROUTE_MANIFEST already carries it -- filtering to
 * the unvisited subset is the caller's job (keeps this function's own
 * correctness independently checkable). */
export function deriveClosedSubstateRows(): SubstateRow[] {
  const settingsSource = read("Settings.tsx");
  const apiTokensSource = read("settings", "ApiTokensPanel.tsx");
  const contactsSource = read("contacts", "ContactsApp.tsx");
  const submissionDetailSource = read("submissions", "SubmissionDetailPage.tsx");

  const rows: SubstateRow[] = [];

  // --- Settings.tsx: `?section=<key>&edit=1`, one row per SECTIONS key
  // whose own object block declares an editTitle (Settings.tsx's own
  // comment: "a settings section URL carrying `edit=1` ... is a SCREEN, not
  // a scroll target -- only that one panel mounts"; DESIGN-RULINGS.md B10).
  const editValue = extractEqualsLiteral(settingsSource, "edit", "Settings.tsx edit");
  const editableSections = extractEditableSectionKeys(settingsSource);
  for (const key of editableSections) {
    rows.push({
      path: `/admin/settings?section=${key}&edit=${editValue}`,
      reader: "app/src/pages/Settings.tsx (`editing = urlSection !== null && searchParams.get('edit') === '1'`)",
      rulingNote:
        "Settings.tsx's own comment: \"a settings section URL carrying `edit=1` ... is a SCREEN, not a " +
        "scroll target -- only that one panel mounts\"; docs/design/DESIGN-RULINGS.md B10 (\"Settings edit " +
        'views on desktop").',
    });
  }

  // --- settings/ApiTokensPanel.tsx: `?section=your-data&edit=1&intent=new`
  // -- ApiTokensPanel only mounts non-readOnly inside YourDataPanel.tsx's
  // edit view, so this is a THIRD level nested under the your-data edit
  // row above (DEC-919 wave-155 amendment, cited in ApiTokensPanel.tsx: the
  // read drill's "New token" render site opens the edit drill with
  // `intent=new` already set).
  const intentValue = extractNotEqualsLiteral(apiTokensSource, "intent", "ApiTokensPanel.tsx intent");
  if (editableSections.includes("your-data")) {
    rows.push({
      path: `/admin/settings?section=your-data&edit=${editValue}&intent=${intentValue}`,
      reader:
        "app/src/pages/settings/ApiTokensPanel.tsx (`searchParams.get('intent') !== 'new'`), " +
        "mounted non-readOnly only inside YourDataPanel.tsx's edit view",
      rulingNote:
        "DEC-919 wave-155 amendment (ApiTokensPanel.tsx): \"the read drill gets its own 'New token' render " +
        'site ... which opens the edit drill with intent=new already set."',
    });
  }

  // --- contacts/ContactsApp.tsx: `?import=1` (DEC-827).
  const importValue = extractEqualsLiteral(contactsSource, "import", "ContactsApp.tsx import");
  rows.push({
    path: `/admin/contacts?import=${importValue}`,
    reader: "app/src/pages/contacts/ContactsApp.tsx (`showImport = searchParams.get('import') === '1'`)",
    rulingNote:
      "DEC-827: \"Speakers links into the importer with ?import=1 (the toolbar's 'Import CSV' button shares " +
      'this same opener/URL-state path, so there is one way in, not two)."',
  });

  // --- submissions/SubmissionDetailPage.tsx: `?edit=1` and `?history=0`,
  // one pair per `/admin/submissions/<id>` base row ROUTE_MANIFEST already
  // carries (the id itself is read off the manifest, never re-typed here --
  // DEC-180).
  const submissionEditValue = extractEqualsLiteral(submissionDetailSource, "edit", "SubmissionDetailPage.tsx edit");
  const historyValue = extractNotEqualsLiteral(submissionDetailSource, "history", "SubmissionDetailPage.tsx history");
  // Filtered on the manifest row's own `params.id` (not a path-shape regex,
  // which would also match the sibling literal sub-paths
  // `/admin/submissions/forms` and `/admin/submissions/delete` -- those are
  // fixed routes, not `:id` detail rows, so they carry no `params.id`).
  const submissionDetailBases = ROUTE_MANIFEST.filter(
    (e) => /^\/admin\/submissions\/[^/?]+$/.test(e.path) && e.params?.id !== undefined,
  ).map((e) => e.path);
  if (submissionDetailBases.length === 0) {
    throw new Error("no /admin/submissions/<id> base row found in ROUTE_MANIFEST (nothing to nest edit/history under)");
  }
  for (const base of submissionDetailBases) {
    rows.push({
      path: `${base}?edit=${submissionEditValue}`,
      reader: "app/src/pages/submissions/SubmissionDetailPage.tsx (`editing = searchParams.get('edit') === '1'`)",
      rulingNote: "DEC-998 (SubmissionDetailPage.tsx): editing/historyOpen are derived from the URL, not their own state.",
    });
    rows.push({
      path: `${base}?history=${historyValue}`,
      reader:
        "app/src/pages/submissions/SubmissionDetailPage.tsx " +
        "(`historyOpen = searchParams.get('history') !== '0'`)",
      rulingNote:
        "DEC-908 wave-42 amendment: \"History renders EXPANDED by default ... `?history=0` is the one way to " +
        'reach the collapsed state, so a bookmarked/shared link still round-trips through the toggle."',
    });
  }

  return rows;
}

const CLOSED_KEYS = new Set(["tab", "section", "view", "edit", "intent", "import", "history"]);

interface OpenValuedKey {
  key: string;
  reader: string;
}

/** Every `searchParams.get('<key>')` read site across app/src/pages/** whose
 * key is NOT one of CLOSED_KEYS -- i.e. every key this file (or
 * routeManifest.test.ts) resolves to a closed set is excluded, and what
 * remains is recorded (per file) as OPEN-VALUED, never expanded into rows
 * (task instruction: "A key whose values are open ... is recorded as
 * OPEN-VALUED with its reader, not expanded."). */
export function deriveOpenValuedKeys(): OpenValuedKey[] {
  const files = walkPageFiles(APP_PAGES);
  const getRe = /searchParams\.get\('([a-zA-Z0-9_-]+)'\)/g;
  const seen = new Set<string>();
  const out: OpenValuedKey[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf-8");
    getRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = getRe.exec(source)) !== null) {
      const key = m[1]!;
      if (CLOSED_KEYS.has(key)) continue;
      const dedupeKey = `${key}::${file}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push({ key, reader: file.slice(REPO_ROOT.length + 1) });
    }
  }
  return out;
}

/** `deriveClosedSubstateRows()` filtered to rows ROUTE_MANIFEST does not
 * already carry. */
export function deriveUnvisitedRows(): SubstateRow[] {
  const manifestPaths = new Set(ROUTE_MANIFEST.map((e) => e.path));
  return deriveClosedSubstateRows().filter((row) => !manifestPaths.has(row.path));
}

describe("route sub-state coverage (DEC-144 amendment, wave 27)", () => {
  it("derives a non-empty reader population, including at least one Settings `edit` section value (vacuity tripwire)", () => {
    const rows = deriveClosedSubstateRows();
    expect(rows.length).toBeGreaterThan(0);
    const settingsEditRows = rows.filter((r) => /^\/admin\/settings\?section=[a-z-]+&edit=1$/.test(r.path));
    expect(settingsEditRows.length, "expected at least one Settings ?section=<key>&edit=1 row").toBeGreaterThan(0);

    const openKeys = deriveOpenValuedKeys();
    expect(openKeys.length, "expected at least one OPEN-VALUED key").toBeGreaterThan(0);
  });

  // DEC-808/DEC-180: measured, never invented. Force this to -1, read the
  // printed offender list, and write the real count back -- this is the
  // roster's own two-sided ratchet (DEC-808 wave-85 amendment), so a rise
  // (a new closed-set sub-state landing with no manifest row) and an
  // unaccounted drop (this test's own population narrowing without the
  // roster doc being updated) both fail loudly.
  const ROUTE_SUBSTATE_UNVISITED_CEILING = 10;

  it(`no more than ${ROUTE_SUBSTATE_UNVISITED_CEILING} derived closed-set query sub-states are unvisited by ROUTE_MANIFEST`, () => {
    const unvisited = deriveUnvisitedRows();
    const offenders = unvisited.map((r) => r.path);
    expect(
      offenders.length,
      `ROUTE_SUBSTATE_UNVISITED_CEILING may only be LOWERED. Unvisited rows:\n${offenders.join("\n")}`,
    ).toBeLessThanOrEqual(ROUTE_SUBSTATE_UNVISITED_CEILING);
  });

  it(`does not fall stale below ${ROUTE_SUBSTATE_UNVISITED_CEILING} (two-sided companion, DEC-808 wave-85 amendment)`, () => {
    const unvisited = deriveUnvisitedRows();
    expect(
      unvisited.length,
      `ROUTE_SUBSTATE_UNVISITED_CEILING = ${ROUTE_SUBSTATE_UNVISITED_CEILING} is stale -- the measured count ` +
        `dropped to ${unvisited.length}. Lower the constant in the same commit that closed the gap.`,
    ).toBeGreaterThanOrEqual(ROUTE_SUBSTATE_UNVISITED_CEILING);
  });

  it("the roster audit doc names every currently-unvisited row", () => {
    const docPath = join(REPO_ROOT, "docs", "design", "audit", "route-substate-coverage-v12.md");
    const doc = readFileSync(docPath, "utf-8");
    const unvisited = deriveUnvisitedRows();
    const missing = unvisited.filter((row) => !doc.includes(row.path));
    expect(
      missing.map((r) => r.path),
      `docs/design/audit/route-substate-coverage-v12.md is missing rows for:\n${missing.map((r) => r.path).join("\n")}`,
    ).toEqual([]);
  });
});
