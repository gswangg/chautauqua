// USER DIRECTIVE (2026-08-16): docs prose conforms to ASD-STE100 Simplified
// Technical English. This scan enforces the mechanically-checkable subset of
// the STE writing rules over every docs article's prose, list items,
// standfirsts and figure captions (src/routes/docs-content/*.ts). The parts
// of STE a regex cannot judge — approved-word meanings from the controlled
// dictionary, one-topic-per-paragraph — are enforced by the docs lane's
// rewrite discipline and gate review, not here.
//
// Rules encoded (STE issue numbers paraphrased):
//   R1  Sentence length: max 25 words (STE 6.2/9.2 allows 20 for procedures,
//       25 for descriptive text — docs articles are descriptive; the tighter
//       procedural bound is a review concern).
//   R2  No contractions (STE approved forms are full words).
//   R3  Ambiguity words banned: "should", "might", "in order to",
//       "as appropriate", "etc." — STE requires "must"/"can"/"if" phrasing.
//   R4  Paragraph length: max 6 sentences per prose block.
//   R5  No Latinisms: "e.g.", "i.e.", "via", "et al." — write the words.
//   R6  No semicolons in prose (STE: one statement per sentence; split it).
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "routes", "docs-content");

// Pull every prose-bearing string literal out of the article modules:
// text: "...", standfirst: "...", caption: "...", items: ["...", ...].
function proseStrings(src: string): string[] {
  const out: string[] = [];
  const fieldRe = /(?:text|standfirst|caption|title)\s*:\s*(["'])((?:\\.|(?!\1).)*)\1/g;
  let m: RegExpExecArray | null;
  while ((m = fieldRe.exec(src))) out.push(m[2]!.replace(/\\(["'])/g, "$1"));
  const itemsRe = /items\s*:\s*\[([\s\S]*?)\]/g;
  while ((m = itemsRe.exec(src))) {
    const inner = m[1]!;
    const strRe = /(["'])((?:\\.|(?!\1).)*)\1/g;
    let s: RegExpExecArray | null;
    while ((s = strRe.exec(inner))) out.push(s[2]!.replace(/\\(["'])/g, "$1"));
  }
  return out;
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function words(sentence: string): number {
  return sentence.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

const CONTRACTIONS = /\b(?:don't|doesn't|didn't|isn't|aren't|wasn't|weren't|can't|cannot's|won't|wouldn't|couldn't|shouldn't|it's|that's|there's|here's|what's|who's|you're|you've|you'll|we're|we've|we'll|they're|they've|let's|haven't|hasn't|hadn't|I'm|I've|I'll)\b/i;
const AMBIGUITY = /\b(?:should|might|in order to|as appropriate|and so on)\b|etc\./i;
const LATINISMS = /\b(?:e\.g\.|i\.e\.|via|et al\.)/i;

describe("docs prose conforms to the checkable ASD-STE100 subset", () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".ts") && !["types.ts", "index.ts", "shots-available.ts"].includes(f));

  it("finds the article population (vacuous-scan tripwire)", () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
  });

  it("every prose string passes R1-R6", () => {
    const violations: string[] = [];
    for (const f of files) {
      const src = readFileSync(join(DIR, f), "utf8");
      for (const text of proseStrings(src)) {
        const sents = sentences(text);
        for (const s of sents) {
          const n = words(s);
          if (n > 25) violations.push(`${f}: R1 sentence ${n} words: "${s.slice(0, 60)}…"`);
          if (/;/.test(s)) violations.push(`${f}: R6 semicolon: "${s.slice(0, 60)}…"`);
        }
        if (sents.length > 6) violations.push(`${f}: R4 paragraph has ${sents.length} sentences: "${text.slice(0, 50)}…"`);
        const c = CONTRACTIONS.exec(text);
        if (c) violations.push(`${f}: R2 contraction "${c[0]}": "${text.slice(0, 50)}…"`);
        const a = AMBIGUITY.exec(text);
        if (a) violations.push(`${f}: R3 ambiguity word "${a[0]}": "${text.slice(0, 50)}…"`);
        const l = LATINISMS.exec(text);
        if (l) violations.push(`${f}: R5 latinism "${l[0]}": "${text.slice(0, 50)}…"`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
