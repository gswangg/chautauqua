// Shared, string-aware TS/JS-source comment stripper (DEC-374 amendment,
// wave v12m-w38 task w38-c). test/helpers/strip-css-comments.ts is CSS-shaped
// -- it only recognises `/* */` block comments and single/double-quoted
// string literals, which is correct for CSS but wrong for TS/JS source: it
// has no notion of `//` line comments (TS/JS's dominant comment form) and no
// notion of template-literal backtick strings (where a `//` or `/*` sequence
// is real content, not a comment). Reusing it here would silently fail to
// strip `//` comments and would misparse backtick strings, so this is a
// second, deliberately TS-shaped instrument rather than a bent reuse of the
// CSS one (DEC-613: a second copy of a VOCABULARY is the trap; a second
// instrument for a genuinely different grammar is not).
//
// Walks the text character-by-character tracking quote state (', ", `) so a
// `//` or `/*` inside a string or template literal is never mistaken for a
// comment opener -- the exact failure mode that let
// test/render-sweep-public-gate.test.ts's own header comment (`this file
// must never import "playwright"`) get matched by test-tiers.test.ts's
// un-stripped IMPORT_SPECIFIER_RE and misclassify the file SLOW.
//
// Both comment forms are replaced with a same-count run of newline
// characters (never with '') so line numbers in the stripped text still line
// up with the original -- matching strip-css-comments.ts's convention, even
// though this call site (test-tiers.test.ts) does not currently report line
// numbers, so a future caller that does can rely on it too.
//
// Template-literal `${...}` interpolation is NOT walked as nested TS -- a
// `//` or `/*` appearing inside an interpolated expression inside a template
// literal is (rare, and) still treated as string content because the whole
// backtick-to-backtick span is tracked as one quoted region. Good enough for
// this file's purpose (scanning import specifiers, which are never written
// inside a template-literal interpolation), not a general TS parser.
export function stripTsComments(text: string): string {
  let out = "";
  let i = 0;
  const n = text.length;
  let quote: '"' | "'" | "`" | null = null;

  while (i < n) {
    const ch = text[i] as string;

    if (quote !== null) {
      out += ch;
      if (ch === "\\" && i + 1 < n) {
        out += text[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      i++;
      continue;
    }

    if (ch === "/" && text[i + 1] === "/") {
      const newlineAt = text.indexOf("\n", i + 2);
      const commentEnd = newlineAt === -1 ? n : newlineAt;
      i = commentEnd;
      continue;
    }

    if (ch === "/" && text[i + 1] === "*") {
      const closeAt = text.indexOf("*/", i + 2);
      const commentEnd = closeAt === -1 ? n : closeAt + 2;
      const comment = text.slice(i, commentEnd);
      const newlines = comment.match(/\n/g);
      out += newlines ? "\n".repeat(newlines.length) : "";
      i = commentEnd;
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}
