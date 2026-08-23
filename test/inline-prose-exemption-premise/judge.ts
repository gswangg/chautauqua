// Contention decomposition (task w56-e, DEC-613): judgeInlineReceipt and its
// grounding-rung helpers, extracted verbatim from
// test/inline-prose-exemption-premise.scan.test.ts, no behavior change --
// the same decomposition idiom test/tap-floor-exempt-premise/ already uses.
// The shared 44px floor-grammar primitives (escapeRe/hasFlexCenter/
// hasMinHeightFloor/horizontalPaddingNonZero) are imported from the
// tap-floor-exempt-premise sibling's css-grammar module, never a second
// copy (DEC-613).
import { escapeRe, hasFlexCenter, hasMinHeightFloor, horizontalPaddingNonZero } from "../tap-floor-exempt-premise/css-grammar";
import type { InlineReceipt } from "./receipts";

export type Verdict = "GROUNDED" | "UNGROUNDED" | "UNVERIFIABLE" | "GROUNDED-BY-DEVIATION";

export interface InlineRosterRow extends InlineReceipt {
  verdict: Verdict;
  detail: string;
}

// ---------------------------------------------------------------------------
// Rung 3 (DEC-393 wave-42 amendment): a receipt with no companion class can
// still be GROUNDED-BY-DEVIATION when its reason cites a real DEVIATIONS.md
// section whose own body text names one of the receipt's own `chq-` class
// tokens verbatim. Parsed from the real file on disk (never a fixture copy)
// -- `## N.` headings, extent running to the next heading or EOF.
// ---------------------------------------------------------------------------

export interface DeviationSection {
  number: number;
  body: string;
}

const HEADING_RE = /^## (\d+)\./gm;

export function parseDeviationsSections(text: string): DeviationSection[] {
  const headings: Array<{ number: number; headingStart: number; bodyStart: number }> = [];
  let m: RegExpExecArray | null;
  HEADING_RE.lastIndex = 0;
  while ((m = HEADING_RE.exec(text)) !== null) {
    headings.push({ number: Number(m[1]), headingStart: m.index, bodyStart: m.index + m[0].length });
  }
  return headings.map((h, i) => ({
    number: h.number,
    body: text.slice(h.bodyStart, i + 1 < headings.length ? headings[i + 1]!.headingStart : text.length),
  }));
}

/** Every `chq-` class token this receipt can claim as "its own": whatever
 * selector it directly decorates, plus any BARE (not `.`- or `#`-prefixed)
 * `chq-` token in its own reason text. A `.`/`#`-prefixed token is always a
 * REFERENCE to some other selector or anchor id (a companion candidate
 * rung 2 already tried, or a destination id like `#chq-cfp-submit-form`
 * mentioned in passing) -- never this receipt's own token. This mirrors the
 * DEC-996 wave-35 authoring convention itself: the receipt's own class is
 * deliberately written bare in these reasons ("chq-cfp-intro-cta-link, no
 * leading dot here -- a dotted literal reads as a grounding claim to this
 * file's own scan, which this receipt deliberately is not") specifically so
 * it is never misread as a companion. */
function ownTokensOf(receipt: InlineReceipt): string[] {
  const out = new Set<string>(receipt.receiptedClasses);
  for (const m of receipt.reason.matchAll(/(?<![.#])\bchq-[\w-]+\b/g)) out.add(m[0]);
  return [...out];
}

const DEVIATIONS_CITATION_RE = /DEVIATIONS\.md['’]?s?\s*(?:§|section\s+)(\d+)/i;

export function judgeByDeviation(receipt: InlineReceipt, sections: DeviationSection[]): InlineRosterRow {
  const cite = receipt.reason.match(DEVIATIONS_CITATION_RE);
  if (!cite) {
    return {
      ...receipt,
      verdict: "UNVERIFIABLE",
      detail: "reason names no companion .chq-* class and cites no DEVIATIONS.md section number (rung 1/2/3 all fail)",
    };
  }
  const num = Number(cite[1]);
  const section = sections.find((s) => s.number === num);
  if (!section) {
    return {
      ...receipt,
      verdict: "UNVERIFIABLE",
      detail: `cites DEVIATIONS.md §${num}, but no such "## ${num}." heading exists in docs/design/DEVIATIONS.md (rung 3 fails: dead section citation)`,
    };
  }
  const tokens = ownTokensOf(receipt);
  const namedToken = tokens.find((t) => section.body.includes(t));
  if (!namedToken) {
    return {
      ...receipt,
      verdict: "UNVERIFIABLE",
      detail: `cites DEVIATIONS.md §${num} (a real section), but that section's body names none of this receipt's own chq- class token(s) [${tokens.join(", ") || "none"}] (rung 3 fails: unnamed receipt)`,
    };
  }
  return {
    ...receipt,
    verdict: "GROUNDED-BY-DEVIATION",
    detail: `cites DEVIATIONS.md §${num}, which names this receipt's own .${namedToken} verbatim (rung 3: recorded deviation, DEC-393 wave-35/42 amendments)`,
  };
}

/** Rung 0 (DEC-393 wave-52 amendment): a receipt can ground itself, with no
 * companion at all, when its OWN receipted class(es) -- merged across EVERY
 * rule in the swept corpus whose selector mentions any of those tokens
 * (this codebase's cascade-merge idiom: a base/desktop rule declares
 * flex/centring, a later grouped phone-media rule adds min-height/padding
 * for the SAME selector, and the floor lives in the cascade, not any one
 * rule) -- already satisfy the full 44px-floor grammar (min-height>=44px +
 * centred flex + non-zero horizontal padding). This runs BEFORE the
 * companion-class search (rung 2) and before the UNVERIFIABLE/rung-3
 * fallthrough, because a receipt that floors itself needs no other class's
 * testimony at all. */
export function selfFloored(receipt: InlineReceipt, allChunks: Array<{ selector: string; body: string }>): boolean {
  if (receipt.receiptedClasses.length === 0) return false;
  const bodies: string[] = [];
  for (const token of receipt.receiptedClasses) {
    const tokenRe = new RegExp(`\\.${escapeRe(token)}(?![\\w-])`);
    for (const c of allChunks) {
      if (tokenRe.test(c.selector)) bodies.push(c.body);
    }
  }
  if (bodies.length === 0) return false;
  const merged = bodies.join("\n");
  return hasMinHeightFloor(merged) && hasFlexCenter(merged) && horizontalPaddingNonZero(merged);
}

export function judgeInlineReceipt(
  receipt: InlineReceipt,
  allChunks: Array<{ selector: string; body: string }>,
  allText: string,
  deviationSections: DeviationSection[] = [],
): InlineRosterRow {
  if (selfFloored(receipt, allChunks)) {
    return {
      ...receipt,
      verdict: "GROUNDED",
      detail: `own receipted class(es) [${receipt.receiptedClasses.join(", ")}] satisfy min-height:44px + centred flex + non-zero horizontal padding, merged across every matching rule in the swept corpus (self-floored, no companion needed, DEC-393 wave-52 amendment)`,
    };
  }
  const mentioned = [...receipt.reason.matchAll(/\.(chq-[\w-]+)/g)].map((c) => c[1] as string);
  const companion = mentioned.find((c) => !receipt.receiptedClasses.includes(c));
  if (!companion) {
    return judgeByDeviation(receipt, deviationSections);
  }
  const tokenRe = new RegExp(`\\.${escapeRe(companion)}(?![\\w-])`);
  const bodies = allChunks.filter((c) => tokenRe.test(c.selector)).map((c) => c.body);
  if (bodies.length === 0) {
    return { ...receipt, verdict: "UNVERIFIABLE", detail: `named companion .${companion} has no discoverable CSS rule` };
  }
  const merged = bodies.join("\n");
  const floored = hasMinHeightFloor(merged) && hasFlexCenter(merged) && horizontalPaddingNonZero(merged);
  const present = new RegExp(`\\b${companion}\\b`).test(allText);
  if (floored && present) {
    return {
      ...receipt,
      verdict: "GROUNDED",
      detail: `named companion .${companion} declares min-height:44px + centred flex + non-zero horizontal padding (merged across ${bodies.length} rule(s)) and reaches the same destination on the same surface`,
    };
  }
  if (!floored) {
    return { ...receipt, verdict: "UNGROUNDED", detail: `named companion .${companion} found (${bodies.length} rule(s), merged) but does not satisfy the 44px-floor grammar` };
  }
  return { ...receipt, verdict: "UNVERIFIABLE", detail: `named companion .${companion} is floored but was not found in any product markup source` };
}
