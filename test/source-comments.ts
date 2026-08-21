// Shared string-aware TS/TSX comment stripper (DEC-374 wave-147 amendment,
// implemented in the wave-152 megabatch repair pass).
//
// THE RULING THIS IMPLEMENTS: "A comment is NOT product: when a ratchet's
// subject is a CSS RULE (selector/body geometry) or USER-FACING COPY, the
// source is comment-stripped before matching, through ONE shared
// string-aware helper (DEC-613 -- there are already >=4 private copies of a
// stripper in this tree)." This is that one helper for the COPY half.
// app/src/cancelled-padding-gap.scan.test.ts's exported `stripComments` stays
// the canonical helper for the CSS half: it strips only block comments and
// deliberately neutralises braces inside them so brace-matching cannot
// desync, which is a CSS-parser concern this function has no business
// reproducing. Two helpers because there are genuinely two grammars, not
// because a copy was made.
//
// WHY STRING-AWARE, and not the two-regex idiom several scans use privately
// (`src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")`): that
// shape is a FALSE-NEGATIVE generator for a copy scan. A string literal
// holding a URL ("https://example.com/x (s) y") or a regex literal is cut at
// the first `//`, silently deleting the rest of the line -- including any
// genuine offending copy that follows it. A gate that can be blinded by a
// URL is worse than no gate, so the comment boundaries are found by an
// actual scanner that knows it is inside a quote.
//
// LINE NUMBERS ARE PRESERVED. Every newline inside a stripped comment is
// kept, so `stripSourceComments(src).split("\n")[i]` still refers to source
// line i+1 and a scan may report a real, clickable coordinate.
//
// TEMPLATE LITERALS ARE CONTENT, NOT CODE. A backtick span is kept whole
// (interpolations included) because user-facing copy is routinely composed
// in one -- app/src/phone-overflow-scan/checks.ts's diagnostic template is
// exactly the offender DEC-374's own ruling says must be reworded rather
// than exempted, and a helper that treated template bodies as code would
// hide it.

type Mode = "code" | "line" | "block" | "'" | '"' | "`";

/** `src` with `//` and block comments removed and everything else -- string
 * literals, template literals, regex bodies -- left byte-for-byte intact.
 * Newlines inside removed comments are preserved so line numbering survives. */
export function stripSourceComments(src: string): string {
  let out = "";
  let mode: Mode = "code";
  let i = 0;

  while (i < src.length) {
    const c = src[i] as string;
    const next = src[i + 1];

    if (mode === "code") {
      if (c === "/" && next === "/") {
        mode = "line";
        i += 2;
        continue;
      }
      if (c === "/" && next === "*") {
        mode = "block";
        i += 2;
        continue;
      }
      if (c === "'" || c === '"' || c === "`") mode = c;
      out += c;
      i += 1;
      continue;
    }

    if (mode === "line") {
      // A line comment ends at the newline, which is kept so the following
      // line keeps its original number.
      if (c === "\n") {
        mode = "code";
        out += c;
      }
      i += 1;
      continue;
    }

    if (mode === "block") {
      if (c === "*" && next === "/") {
        mode = "code";
        i += 2;
        continue;
      }
      if (c === "\n") out += c;
      i += 1;
      continue;
    }

    // Inside a quote or template literal: copy through, honouring escapes so
    // an escaped delimiter (\" or \`) never looks like the closing one.
    if (c === "\\") {
      out += c + (next ?? "");
      i += 2;
      continue;
    }
    if (c === mode) mode = "code";
    out += c;
    i += 1;
  }

  return out;
}
