// Shared, string-aware CSS-comment stripper (DEC-374 amendment, wave v12m-w8
// task w8-ef). Promoted from app/src/cancelled-padding-gap.scan.test.ts's
// `stripComments` (the canonical implementation named by this wave's task
// description) into ONE importable module so the >= 4 private re-derivations
// already living in the tree (test/vocabulary-duplication-ratchet.scan.test.ts,
// test/display-heading-line-height.scan.test.ts,
// test/served-content-type-single-source.scan.test.ts, and the app/src/
// original) stop being independent copies of the same regex (DEC-613: "a
// second copy of a vocabulary is a trap with a delay fuse"). This wave ships
// the helper and the ratchet that COUNTS the un-migrated copies; migrating
// those ~31 files to import this module is explicitly out of scope (a later,
// separately-ruled wave per this task's own description).
//
// Two hardening changes over the original two-line regex pass:
//
// 1. STRING-AWARE: a `/*` sequence inside a single- or double-quoted string
//    literal (e.g. a CSS `content: "/*";` declaration, or a JS/TS string in a
//    *.css.ts template) is real content, not a comment opener. The naive
//    `/\/\*[\s\S]*?\*\//g` regex the original used has no notion of quoting
//    and would treat that `"/*"` as the start of an (unterminated, greedy)
//    comment, silently eating everything after it. This walks the text
//    character-by-character tracking quote state so a comment is only ever
//    recognised outside a string.
//
// 2. LINE-NUMBER PRESERVING: a removed multi-line comment is replaced with
//    the SAME COUNT of newline characters it contained (never with '') so
//    every line after it keeps its original line number -- required by this
//    wave's ratchet, which reports offender lines out of the ORIGINAL file.
//    A same-line (`{n}` net-zero) comment is removed with no residue, so a
//    single-line comment doesn't inject a spurious blank line.
//
// CSS comments do not nest (the first `*/` after a `/*` always closes it,
// per the CSS spec) -- an unterminated `/*` with no following `*/` runs to
// end-of-file, matching real browser/postcss behaviour, never a thrown error
// (a malformed source is not this helper's concern to validate).
export function stripCssComments(text: string): string {
  let out = "";
  let i = 0;
  const n = text.length;
  let quote: '"' | "'" | null = null;

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

    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      i++;
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
