// USER DIRECTIVE (2026-08-16): docs prose follows the mechanically-checkable
// subset of the ASD-STE100 writing rules. This scan enforces that subset over
// every docs article's prose, list items, standfirsts and figure captions
// (src/routes/docs-content/*.ts). The parts a regex cannot judge — one term
// per concept, no metaphors, consequence-first warnings, facts exact — are
// enforced by the docs lane's rewrite discipline and gate review, not here.
//
// History: full Issue-9 dictionary conformance was applied once (2026-08-16)
// and then deliberately relaxed the same day, by user directive, to
// writing-rules-only — the licensed-dictionary vocabulary made the prose
// stiff. A follow-up rhythm directive (same day) relaxed structure as well:
// the sentence cap rose from 25 to 30 words for descriptive articles, the
// semicolon ban narrowed to procedural list items, and descriptive paragraphs
// were freed from one-instruction-per-sentence so related facts can share a
// sentence. src/routes/docs-content/technical-names.ts is kept as the project
// glossary; it is no longer consumed by this scan.
//
// Rules encoded (STE issue numbers paraphrased, as relaxed above):
//   R1  Sentence length: max 30 words (STE 6.2/9.2 says 25 for descriptive
//       text; raised to 30 by the user's rhythm directive so combined
//       descriptive sentences with subordination and asides are legal).
//   R2  No contractions (approved forms are full words).
//   R3  Ambiguity words banned: "should", "might", "in order to",
//       "as appropriate", "etc." — "must"/"can"/"if" phrasing instead.
//   R4  Paragraph length: max 6 sentences per prose block.
//   R5  No Latinisms: "e.g.", "i.e.", "via", "et al." — write the words.
//   R6  No semicolons in items[] entries only (a procedural step stays one
//       statement; descriptive prose may use semicolons per the rhythm
//       directive).
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "routes", "docs-content");

// Prose-bearing field literals: text: "...", standfirst: "...", caption: "...",
// title: "...".
function fieldStrings(src: string): string[] {
  const out: string[] = [];
  const fieldRe = /(?:text|standfirst|caption|title)\s*:\s*(["'])((?:\\.|(?!\1).)*)\1/g;
  let m: RegExpExecArray | null;
  while ((m = fieldRe.exec(src))) out.push(m[2]!.replace(/\\(["'])/g, "$1"));
  return out;
}

// items: ["...", ...] entries, kept separate because R6 applies only here.
function itemStrings(src: string): string[] {
  const out: string[] = [];
  const itemsRe = /items\s*:\s*\[([\s\S]*?)\]/g;
  let m: RegExpExecArray | null;
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

describe("docs prose conforms to the relaxed writing-rules subset", () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".ts") && !["types.ts", "index.ts", "shots-available.ts", "technical-names.ts"].includes(f));

  it("finds the article population (vacuous-scan tripwire)", () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
  });

  it("every prose string passes R1-R6", () => {
    const violations: string[] = [];
    for (const f of files) {
      const src = readFileSync(join(DIR, f), "utf8");
      const fields = fieldStrings(src);
      const items = itemStrings(src);
      for (const [texts, itemsOnly] of [[fields, false], [items, true]] as const) {
        for (const text of texts) {
          const sents = sentences(text);
          for (const s of sents) {
            const n = words(s);
            if (n > 30) violations.push(`${f}: R1 sentence ${n} words: "${s.slice(0, 60)}…"`);
            if (itemsOnly && /;/.test(s)) violations.push(`${f}: R6 semicolon in list item: "${s.slice(0, 60)}…"`);
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
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
