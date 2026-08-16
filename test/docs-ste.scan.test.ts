// USER DIRECTIVE (2026-08-16): docs prose conforms to ASD-STE100 Simplified
// Technical English. This scan enforces the mechanically-checkable subset of
// the STE writing rules over every docs article's prose, list items,
// standfirsts and figure captions (src/routes/docs-content/*.ts). The parts
// of STE a regex cannot judge — approved-word MEANINGS and parts of speech,
// one-topic-per-paragraph — are enforced by the docs lane's rewrite
// discipline and gate review, not here.
//
// Second stage (Issue-9 dictionary conformance): when the extracted licensed
// dictionary is present locally, a second test asserts every prose word is
// dictionary-approved, an inflection of an approved word, a declared
// technical name (rule 1.5/1.6, src/routes/docs-content/technical-names.ts),
// or a Part-1 grammar word. The dictionary JSON is licensed material and must
// NOT be committed to this public repository, so that test self-skips when
// the file is absent.
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
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DOCS_TECHNICAL_NAMES } from "../src/routes/docs-content/technical-names";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "routes", "docs-content");

// The licensed ASD-STE100 dictionary, extracted to JSON:
// { approved: { word: [pos...] }, unapproved: { word: "ALTERNATIVE" } }.
// Licensed material — lives outside this public repo and is never committed.
const DICTIONARY_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..", "..", "chautauqua-research", "ste100-dictionary.json",
);

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
  const files = readdirSync(DIR).filter((f) => f.endsWith(".ts") && !["types.ts", "index.ts", "shots-available.ts", "technical-names.ts"].includes(f));

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

// ---------------------------------------------------------------------------
// Issue-9 dictionary conformance (runs only where the licensed dictionary is
// extracted locally — never committed here).
// ---------------------------------------------------------------------------

// Part-1 grammar words. These are closed-class words the STE writing rules
// govern directly, not dictionary headwords, so the extracted dictionary does
// not carry them all:
//   - articles, be/have/do forms, the approved modals (CAN, COULD, MUST,
//     WILL), pronouns and possessives (Part 1, sections 2-3);
//   - question/relative words and core conjunctions/prepositions from the
//     grammar rules (most prepositions ARE dictionary headwords; this list
//     only backstops the closed-class ones the extractor missed).
//     Deliberately NOT here because STE unapproves them: over, under, per,
//     within, beside, both, few, once, may, would, shall, should, so.
//   - number words and time units: rule 8.6 and section 9 (numbers, units of
//     measurement and time) treat these as regulated forms, not dictionary
//     entries — the spec's own STE examples use "three times", "each day".
const GRAMMAR_WORDS = new Set((
  "a an the " +
  "be am is are was were been being have has had having do does did done doing " +
  "can could must will " +
  "i me my we us our ours you your yours he him his she her hers it its they them their theirs " +
  "myself yourself itself ourselves themselves " +
  "this that these those who whom whose which what why " +
  "not no none nor and or but if because than then as " +
  "of to in into onto on at by for with from out up down through during between before after against along across about above below behind near off without " +
  "here there " +
  "zero one two three four five six seven eight nine ten eleven twelve twenty hundred thousand " +
  "second third fourth fifth sixth seventh eighth ninth tenth " +
  "minute hour day week month year"
).split(/\s+/));

// Irregular forms of approved verbs (the dictionary lists base forms; STE
// approves the inflected forms of approved verbs, and past participles of
// technical verbs as adjectives).
const IRREGULAR: Record<string, string> = {
  went: "go", gone: "go", sent: "send", held: "hold", got: "get",
  gave: "give", given: "give", made: "make", kept: "keep", shown: "show",
  seen: "see", saw: "see", ran: "run", came: "come", found: "find",
  written: "write", wrote: "write", taken: "take", took: "take",
  left: "leave", hidden: "hide", hid: "hide", chosen: "choose",
  chose: "choose", built: "build", spoken: "speak", spoke: "speak",
  known: "know", knew: "know", told: "tell", said: "say", sat: "sit",
  meant: "mean", drawn: "draw", drew: "draw", broke: "break", broken: "break",
};

const TN_LOWER = DOCS_TECHNICAL_NAMES.map((t) => t.toLowerCase());
const TN_WORDS = new Set(TN_LOWER.filter((t) => !/[ -]/.test(t)));
// Multiword/hyphenated technical names are removed as phrases (hyphens
// normalized to spaces, optional plural on the last word) before word checks.
const TN_PHRASES = TN_LOWER
  .filter((t) => /[ -]/.test(t))
  .map((t) => t.replace(/-/g, " "))
  .sort((a, b) => b.length - a.length);

function candidateBases(w: string): string[] {
  const c = new Set([w]);
  const irr = IRREGULAR[w];
  if (irr) c.add(irr);
  if (w.endsWith("ies")) c.add(w.slice(0, -3) + "y");
  if (w.endsWith("ied")) c.add(w.slice(0, -3) + "y");
  if (w.endsWith("es")) c.add(w.slice(0, -2));
  if (w.endsWith("s")) c.add(w.slice(0, -1));
  if (w.endsWith("ed")) {
    c.add(w.slice(0, -2));
    c.add(w.slice(0, -1));
    if (w.length > 4 && w[w.length - 3] === w[w.length - 4]) c.add(w.slice(0, -3));
  }
  if (w.endsWith("ing")) {
    c.add(w.slice(0, -3));
    c.add(w.slice(0, -3) + "e");
    if (w.length > 5 && w[w.length - 4] === w[w.length - 5]) c.add(w.slice(0, -4));
  }
  return [...c];
}

describe("docs prose conforms to the ASD-STE100 Issue-9 dictionary", () => {
  const hasDictionary = existsSync(DICTIONARY_PATH);

  it.skipIf(!hasDictionary)(
    `every prose word is approved, an approved inflection, a declared technical name, or a grammar word (licensed dictionary expected at ${DICTIONARY_PATH}; skipped when absent — do not commit it here)`,
    () => {
      const dict = JSON.parse(readFileSync(DICTIONARY_PATH, "utf8")) as {
        approved: Record<string, string[]>;
        unapproved: Record<string, string>;
      };
      const approved = dict.approved;
      expect(Object.keys(approved).length).toBeGreaterThan(500); // extraction sanity

      const wordOk = (w: string): boolean => {
        if (GRAMMAR_WORDS.has(w)) return true;
        for (const b of candidateBases(w)) {
          if (GRAMMAR_WORDS.has(b) || approved[b] || TN_WORDS.has(b)) return true;
        }
        // Comparative/superlative only off approved adjectives.
        for (const [suffix, cuts] of [["er", [2, 1]], ["est", [3, 2]]] as const) {
          if (!w.endsWith(suffix)) continue;
          for (const cut of cuts) {
            const b = w.slice(0, -cut);
            if (approved[b]?.includes("adj")) return true;
          }
        }
        return false;
      };

      // Dictionary conformance applies to the article modules; the shared
      // registry/search modules carry no article prose.
      const articleFiles = readdirSync(DIR).filter(
        (f) =>
          f.endsWith(".ts") &&
          !["types.ts", "index.ts", "shots-available.ts", "groups.ts", "nav.ts", "search.ts", "where-next.ts", "technical-names.ts"].includes(f),
      );
      expect(articleFiles.length).toBeGreaterThanOrEqual(7);

      const violations: string[] = [];
      for (const f of articleFiles) {
        const src = readFileSync(join(DIR, f), "utf8");
        for (const text of proseStrings(src)) {
          // Rule 8.6: quoted text (UI literals, commands, labels) counts as
          // one word and is outside the dictionary.
          const unquoted = text.replace(/'[^']*'/g, " ");
          for (const sentence of sentences(unquoted)) {
            let s = sentence.replace(/[-‑–—]/g, " ");
            for (const p of TN_PHRASES) {
              s = s.replace(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:s|es)?", "gi"), " ");
            }
            const tokens = s.match(/[A-Za-z][A-Za-z'’]*/g) ?? [];
            tokens.forEach((raw, idx) => {
              let tok = raw.replace(/['’]s?$/, "");
              if (!tok) return;
              // Rule 8.6: abbreviations and alphanumeric identifiers count as
              // one word (CFP, URL, PUBLIC_BASE_URL fragments).
              if (/^[A-Z]{2,}$/.test(tok)) return;
              if (/^[A-Z]/.test(tok)) {
                // Mid-sentence capitals are proper nouns and UI labels
                // (rule 8.6). Sentence-initial words are lowercased and
                // checked — never skipped.
                if (idx > 0) return;
                tok = tok.toLowerCase();
              }
              if (!wordOk(tok)) {
                violations.push(`${f}: "${tok}" in "${sentence.slice(0, 70)}…"`);
              }
            });
          }
        }
      }
      expect(violations, violations.join("\n")).toEqual([]);
    },
  );
});
