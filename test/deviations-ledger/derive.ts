// Population derivation, split out of test/deviations-ledger.scan.test.ts
// (contention decomposition, no behavior change). Every function here is
// pure -- it takes the live docs/design/DEVIATIONS.md text as a parameter
// instead of reading the file itself, so the derivation logic can be
// changed without touching the (large, high-churn) ledger data file or the
// test file's own I/O.

import type { DerivedBullet } from "./types";

/** DEC-967 wave-31 amendment: every `## ` heading the file actually
 * contains, in document order -- never a hand-listed array. Replaces the
 * wave-100 build's `INCLUDED_HEADINGS`/`EXCLUDED_HEADINGS` literal arrays. */
export function deriveLedgerSections(deviationsText: string): string[] {
  return deviationsText
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => l.trim());
}

/** Slugifies a lead-in phrase into a stable, deterministic key: lowercase,
 * curly/straight quotes and backticks stripped, every run of
 * non-alphanumeric characters collapsed to one hyphen, no leading/trailing
 * hyphen. Pure function of the lead-in text -- never hand-assigned. Matches
 * test/clarifications-ledger.scan.test.ts's slugify() exactly. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/["“”'’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Extracts the lines belonging to a `## <heading>` section, stopping at the
 * next `## ` heading or end of file. Throws if the heading is absent, so a
 * broken match can never silently zero a section out. */
export function extractSection(markdown: string, heading: string): string {
  const lines = markdown.split("\n");
  const startIdx = lines.findIndex((l) => l.trim() === heading);
  if (startIdx === -1) {
    throw new Error(`docs/design/DEVIATIONS.md has no "${heading}" section`);
  }
  const rest = lines.slice(startIdx + 1);
  const endIdx = rest.findIndex((l) => l.startsWith("## "));
  return (endIdx === -1 ? rest : rest.slice(0, endIdx)).join("\n");
}

const BOLD_OPEN_RE = /^\*\*(.+?)\*\*/;

/** Given a bullet's full joined text, extracts its lead-in per the
 * three-step priority order documented in the test file's header. */
export function extractLeadIn(fullText: string): string {
  const boldMatch = BOLD_OPEN_RE.exec(fullText);
  if (boldMatch) return boldMatch[1]!.trim();

  const emDashIdx = fullText.indexOf(" — ");
  const colonIdx = fullText.indexOf(": ");
  const candidates = [emDashIdx, colonIdx].filter((i) => i !== -1);
  if (candidates.length > 0) {
    const cut = Math.min(...candidates);
    return fullText.slice(0, cut).trim();
  }

  return fullText.replace(/\.$/, "").trim();
}

/** Derives every top-level bullet ("- " at column 0) within one section's
 * text, joining each bullet's continuation lines (indented text, including
 * any nested sub-bullets) until the next top-level bullet, heading, or bold
 * paragraph-header line. */
export function deriveSectionBullets(sectionText: string, heading: string): DerivedBullet[] {
  const lines = sectionText.split("\n");
  const out: DerivedBullet[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (/^- /.test(line)) {
      const parts: string[] = [line.slice(2)];
      let j = i + 1;
      while (j < lines.length && !/^- /.test(lines[j]!) && !/^#/.test(lines[j]!) && !/^\*\*/.test(lines[j]!)) {
        const trimmed = lines[j]!.trim();
        if (trimmed.length > 0) parts.push(trimmed);
        j++;
      }
      const full = parts.join(" ").trim();
      const leadIn = extractLeadIn(full);
      out.push({ key: slugify(leadIn), leadIn, heading });
      i = j;
    } else {
      i++;
    }
  }
  return out;
}

/** Strips the "## " marker off a heading line, leaving the bare title
 * ("5. Pending adjudication (not yet blessed — sweep should verdict)"). */
export function headingTitle(heading: string): string {
  return heading.replace(/^## /, "");
}

/** Derives the full bullet population for `deviationsText`, given the
 * headings already derived from it via `deriveLedgerSections`. A heading
 * with zero top-level bullets of its own is a divider row (see the test
 * file's header, "Divider rows"): one derived entry keyed off the
 * heading's own title, not off any bullet. */
export function deriveBullets(deviationsText: string, sections: string[]): DerivedBullet[] {
  const out: DerivedBullet[] = [];
  for (const heading of sections) {
    const bullets = deriveSectionBullets(extractSection(deviationsText, heading), heading);
    if (bullets.length > 0) {
      out.push(...bullets);
    } else {
      const title = headingTitle(heading);
      out.push({ key: slugify(title), leadIn: title, heading });
    }
  }
  return out;
}
