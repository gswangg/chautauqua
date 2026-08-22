// DEC-374 wave-14m amendment ("a scan that grades its own fixture"): a
// regex-only tautology/comment scan that flattens a whole file to one
// string is blind to WHERE a match sits -- including inside a backtick
// template literal that holds a large chunk of SYNTHETIC SOURCE TEXT (a
// positive-control fixture for some other scan, e.g.
// `app/src/phone-verdict-cascade-read.scan.test.ts`'s `neverReadsStylesheet`
// control). Real code embedded as a string is not real code; a scan that
// flags text living inside a template literal is grading its own fixture,
// not the file's actual assertions.
//
// This is the ONE shared stripper (DEC-613: never a second derivation) for
// "remove `//`/`/* */` comments and blank out backtick template-literal
// CONTENTS before running a flat-text regex scan over a JS/TS source file".
// Single- and double-quoted string literals are left completely untouched
// -- callers whose grammar treats a quoted string as a meaningful literal
// value (e.g. `expect('x').toBe('x')`) must keep seeing it; only backtick
// literals are blanked, and nothing in this codebase's tautology/citation
// grammars ever treats a template literal itself as a literal value.
//
// Character-aware, single pass: comments and template literals are only
// ever recognised OUTSIDE a single/double-quoted string, and a backslash
// escape (inside a string, comment-lookalike, or template literal) is
// always consumed as a pair so an escaped quote/backtick never mis-toggles
// state. Blanked template-literal content keeps its newlines (comments do
// not) so a caller reporting line numbers off the ORIGINAL source stays
// correct for the (more common) comment-only case; template-literal-heavy
// callers do not currently need that guarantee but it costs nothing to keep.
export function stripCommentsAndTemplateLiterals(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i]!;

    if (ch === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }

    if (ch === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i = Math.min(i + 2, n);
      continue;
    }

    if (ch === "'" || ch === '"') {
      const quote = ch;
      out += ch;
      i++;
      while (i < n) {
        if (src[i] === '\\' && i + 1 < n) {
          out += src[i]! + src[i + 1]!;
          i += 2;
          continue;
        }
        out += src[i];
        if (src[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    if (ch === '`') {
      i++;
      while (i < n) {
        if (src[i] === '\\' && i + 1 < n) {
          i += 2;
          continue;
        }
        if (src[i] === '`') {
          i++;
          break;
        }
        if (src[i] === '\n') out += '\n';
        i++;
      }
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}
