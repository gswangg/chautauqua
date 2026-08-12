// DEC-518: locks the invariant that the admin Exports panel's kind list and
// the server's EXPORT_KINDS manifest (src/server/repo/exports.ts, DEC-027)
// agree in BOTH directions. The panel restates the kind list locally (it's
// not exported from ExportsPanel.tsx, so it can't be imported) — so this
// test source-scans the panel's own file text rather than hand-copying the
// kinds into the test, and imports EXPORT_KINDS from its real source rather
// than restating it. Both manifests currently agree; this test is meant to
// fail loudly the moment either one drifts from the other.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EXPORT_KINDS } from "../src/server/repo/exports";

const PANEL_PATH = resolve(
  fileURLToPath(import.meta.url),
  "../../app/src/pages/settings/ExportsPanel.tsx",
);

/** Source-scans the panel's `const EXPORT_KINDS: { kind: string; ... }[] = [...]`
 * literal for every `kind: 'xxx'` entry, in order, without restating the
 * expected list in this test file. */
function parsePanelKinds(source: string): string[] {
  const arrayMatch = source.match(/const EXPORT_KINDS[^=]*=\s*\[([\s\S]*?)\n\];/);
  const arrayBody = arrayMatch?.[1];
  if (arrayBody === undefined) {
    throw new Error(
      "Could not locate ExportsPanel.tsx's EXPORT_KINDS array literal — " +
        "the source-scan regex needs updating to match the file's current shape.",
    );
  }
  const kindRegex = /kind:\s*['"]([^'"]+)['"]/g;
  const kinds: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = kindRegex.exec(arrayBody))) {
    const kind = m[1];
    if (kind === undefined) continue;
    kinds.push(kind);
  }
  if (kinds.length === 0) {
    throw new Error("ExportsPanel.tsx's EXPORT_KINDS array parsed with zero entries.");
  }
  return kinds;
}

describe("ExportsPanel.tsx kind list vs src/server/repo/exports.ts EXPORT_KINDS", () => {
  const panelKinds = parsePanelKinds(readFileSync(PANEL_PATH, "utf-8"));
  const serverKinds = [...EXPORT_KINDS];

  it("has no server kind missing from the panel (no undocumented kind)", () => {
    const missingFromPanel = serverKinds.filter((k) => !panelKinds.includes(k));
    expect(missingFromPanel).toEqual([]);
  });

  it("has no panel kind absent from the server manifest (no panel-only ghost)", () => {
    const ghosts = panelKinds.filter((k) => !(serverKinds as string[]).includes(k));
    expect(ghosts).toEqual([]);
  });

  it("agrees on the exact set of kinds (both directions, no duplicates hiding a mismatch)", () => {
    expect(new Set(panelKinds)).toEqual(new Set(serverKinds));
    expect(panelKinds.length).toBe(new Set(panelKinds).size);
  });
});
