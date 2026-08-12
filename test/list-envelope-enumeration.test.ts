import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * DEC-480: turns DEC-473's "population = re-runnable artifact" rule into an
 * executable conformance test for the list-envelope shape, and closes the
 * last three per-route copies of the DEFAULT_PER_PAGE=50/MAX_PER_PAGE=200
 * clamp rule (src/routes/tasks.ts's parseOnboardingGridQuery,
 * src/server/repo/contacts/query.ts, src/server/repo/submissions/query.ts --
 * all three now delegate to clampPage/clampPerPage in
 * src/lib/pagination.ts).
 *
 * (a) Every `return c.json({ items ...` site under src/routes/**\/*.{ts,tsx}
 *     must carry `total`, `page`, and `perPage` in the same returned object
 *     literal -- the DEC-461(a) list-envelope contract. Two sites are
 *     deliberately not list-GET envelopes and are named exceptions, each
 *     read at file:line before being allowlisted:
 *       - src/routes/comms.ts:385 (POST .../compose/preview) returns a
 *         compose-preview render, one row per selected submission, bounded
 *         by the 100-recipient send cap (DEC checked elsewhere in comms.ts)
 *         -- a preview payload, not a list GET.
 *       - src/routes/api/contacts/bulk-email.ts:203 (POST
 *         /contacts/bulk-email/preview) is the CRM-11/DEC-150 bulk-email
 *         preview: it slices to `previewContacts = contacts.slice(0,
 *         BULK_EMAIL_PREVIEW_LIMIT)` (5) before rendering, so it is bounded
 *         by that constant, not by a page/perPage query param -- a preview
 *         payload, not a list GET.
 *
 * (b) src/lib/pagination.ts must be the ONLY file under src/routes/** or
 *     src/server/repo/** that declares a constant named like
 *     DEFAULT*PER_PAGE or MAX*PER_PAGE (the DEC-465/480 clamp-rule pair,
 *     matched case-insensitively). This deliberately does NOT flag a bare
 *     `PER_PAGE` constant with no DEFAULT/MAX prefix -- e.g.
 *     src/routes/public/shell.tsx:20's `export const PER_PAGE = 12` is a
 *     fixed, non-clamped page size for the public embed shell (no
 *     ?perPage= query param feeds it, so there is no clamp rule to
 *     duplicate); it was read at that file:line and is deliberately out of
 *     scope, not allowlisted, because the (b) check's own name pattern
 *     already excludes it.
 *
 * OPEN ITEMS (none found in this run -- recorded here per the task's "leave
 * it and name it" instruction in case a future scan surfaces one):
 *   (none)
 */

const REPO_ROOT = join(__dirname, "..");
const ROUTES_ROOT = join(REPO_ROOT, "src", "routes");
const REPO_LIB_ROOTS = [join(REPO_ROOT, "src", "routes"), join(REPO_ROOT, "src", "server", "repo")];

function listSourceFiles(dir: string, extRe: RegExp): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full, extRe));
    } else if (extRe.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

function relativePath(file: string): string {
  return file.slice(REPO_ROOT.length + 1);
}

function lineNumberAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

/** Finds the matching close-paren for a `c.json(` call starting at
 * `openParenIndex` (the index of the '(' itself), returning the index just
 * past it. Parens are balanced independently of string/template contents
 * the same way test/query-scoping-invariant.test.ts's walker does -- good
 * enough here because no c.json(...) call in this codebase embeds a raw
 * unbalanced paren inside a string literal. */
function findCallEnd(source: string, openParenIndex: number): number {
  let depth = 1;
  let j = openParenIndex + 1;
  while (j < source.length && depth > 0) {
    if (source[j] === "(") depth++;
    else if (source[j] === ")") depth--;
    j++;
  }
  return j;
}

interface EnvelopeSite {
  file: string;
  line: number;
  body: string;
}

function findItemsEnvelopeSites(source: string, file: string): EnvelopeSite[] {
  const sites: EnvelopeSite[] = [];
  const re = /c\.json\(\s*\{\s*items\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const openParenIndex = match.index + "c.json".length;
    const callEnd = findCallEnd(source, openParenIndex);
    const body = source.slice(openParenIndex + 1, callEnd - 1);
    sites.push({ file, line: lineNumberAt(source, match.index), body });
  }
  return sites;
}

// DEC-480: named, individually-read exceptions to the (a) envelope-shape
// check. Format `${relativePath}:${line}`. Adding an entry here is a
// deliberate reviewed act -- see the file-header comment above for why each
// one is exempt.
const ENVELOPE_ALLOWLIST = new Set<string>([
  "src/routes/comms.ts:385",
  "src/routes/api/contacts/bulk-email.ts:203",
]);

describe("DEC-480: list-envelope enumeration (executable, not prose)", () => {
  const routeFiles = listSourceFiles(ROUTES_ROOT, /\.(ts|tsx)$/);

  it("finds at least 15 c.json({ items ... sites (scanner sanity check)", () => {
    let count = 0;
    for (const file of routeFiles) {
      count += findItemsEnvelopeSites(readFileSync(file, "utf8"), file).length;
    }
    expect(count).toBeGreaterThanOrEqual(15);
  });

  it("(a) every c.json({ items ... site carries total, page, and perPage, or is named-allowlisted", () => {
    const offenders: string[] = [];
    for (const file of routeFiles) {
      const source = readFileSync(file, "utf8");
      for (const site of findItemsEnvelopeSites(source, file)) {
        const key = `${relativePath(site.file)}:${site.line}`;
        if (ENVELOPE_ALLOWLIST.has(key)) continue;
        const hasAll = /\btotal\b/.test(site.body) && /\bpage\b/.test(site.body) && /\bperPage\b/.test(site.body);
        if (!hasAll) {
          offenders.push(
            `  ${key}: c.json({ items ... }) is missing total/page/perPage -- body: ${site.body.slice(0, 160)}`,
          );
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `Found ${offenders.length} list-shaped response(s) missing the DEC-461(a) envelope:\n${offenders.join("\n")}`,
      );
    }
    expect(offenders).toEqual([]);
  });

  it("(a) every allowlist entry is still a real, still-non-conforming site (no stale entries)", () => {
    const seen = new Set<string>();
    for (const file of routeFiles) {
      const source = readFileSync(file, "utf8");
      for (const site of findItemsEnvelopeSites(source, file)) {
        seen.add(`${relativePath(site.file)}:${site.line}`);
      }
    }
    for (const entry of ENVELOPE_ALLOWLIST) {
      expect(seen.has(entry), `allowlisted site ${entry} no longer exists at that file:line -- remove the stale entry`).toBe(
        true,
      );
    }
  });

  it("(b) src/lib/pagination.ts is the only file declaring the per-page clamp constant pair", () => {
    const PAGINATION_FILE = join(REPO_ROOT, "src", "lib", "pagination.ts");
    const declRe = /\b(?:const|let|var|export\s+const)\s+((?:DEFAULT|MAX)\w*PER_PAGE\w*)\s*[:=]/gi;
    const offenders: string[] = [];
    const scanned = new Set<string>();
    for (const root of REPO_LIB_ROOTS) {
      for (const file of listSourceFiles(root, /\.(ts|tsx)$/)) {
        if (scanned.has(file)) continue;
        scanned.add(file);
        if (file === PAGINATION_FILE) continue;
        const source = readFileSync(file, "utf8");
        let match: RegExpExecArray | null;
        while ((match = declRe.exec(source)) !== null) {
          offenders.push(`  ${relativePath(file)}:${lineNumberAt(source, match.index)}: declares ${match[1]}`);
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `Found ${offenders.length} per-page clamp constant declaration(s) outside src/lib/pagination.ts:\n${offenders.join(
          "\n",
        )}\nDelegate to clampPage/clampPerPage/listPerPage in src/lib/pagination.ts instead.`,
      );
    }
    expect(offenders).toEqual([]);
  });
});
