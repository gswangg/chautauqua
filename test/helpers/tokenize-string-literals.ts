// String-literal tokenizer for TS/JS source (DEC-374 wave-45, fifth domain).
//
// stripTsComments (test/helpers/strip-ts-comments.ts) removes comments while
// leaving string and template literal CONTENT untouched -- correct for its
// job, but that leaves a second non-code region unstripped: a regex that
// scans comment-stripped source for `import ... ["']spec["']` still reads
// straight through the CONTENTS of any string/template literal. A fixture
// literal in a *.scan.test.ts file whose text happens to contain the words
// `import 'playwright'` -- because the fixture represents another file's
// source, as DATA, not as an import statement of this file -- then parses as
// a real import. That is the DEC-374 wave-38 comment-blind bug's twin, one
// syntactic region over.
//
// The fix mirrors strip-ts-comments.ts's own string-aware character walk
// (DEC-613: reuse the technique, not a second regex dialect) but instead of
// discarding string literals it replaces each one, ATOMICALLY, with an
// indexed placeholder token -- `"S0"`, `"S1"`, ... -- and records the
// literal's own inner text (the bytes between the delimiters) in a side
// table. A regex run over the resulting SKELETON can then match the *shape*
// `import ... from "<placeholder>"` for a REAL import -- the placeholder
// occupies exactly the specifier's position -- while text sitting INSIDE a
// fixture literal is never visited at all, because the whole literal
// (multi-line fixture blocks included) has already been collapsed to one
// opaque token before the regex ever runs. Resolving the captured
// placeholder back through the side table recovers the real specifier text
// for a genuine import; a placeholder that maps to non-specifier fixture
// prose is simply never captured in the first place, because the fixture
// prose containing it was never split into a `from "..."` shape to begin
// with -- it is one token, and the import keyword the fixture also contains
// (as data) sits inside that same opaque token.
//
// Same quoting rules as strip-ts-comments.ts: single, double, and backtick
// delimiters, backslash escapes tracked so an escaped quote never closes a
// literal early. Template-literal `${...}` interpolation is NOT walked as
// nested code (matching strip-ts-comments.ts's documented limitation) --
// the whole backtick-to-backtick span, escapes aside, is one literal. Call
// this AFTER stripTsComments, exactly like the existing importedModules
// pipeline: strip comments first (a `//` or `/*` inside a string must not
// be read as a comment opener either way), then tokenize what remains.
export interface TokenizedLiterals {
  skeleton: string;
  literals: string[];
}

const PLACEHOLDER_RE = /^S(\d+)$/;

export function tokenizeStringLiterals(text: string): TokenizedLiterals {
  const literals: string[] = [];
  let skeleton = "";
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i] as string;

    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      let inner = "";
      let j = i + 1;
      while (j < n) {
        const c = text[j] as string;
        if (c === "\\" && j + 1 < n) {
          inner += c + text[j + 1];
          j += 2;
          continue;
        }
        if (c === quote) {
          j++;
          break;
        }
        inner += c;
        j++;
      }
      const index = literals.length;
      literals.push(inner);
      skeleton += `"S${index}"`;
      i = j;
      continue;
    }

    skeleton += ch;
    i++;
  }

  return { skeleton, literals };
}

// Resolves a regex-captured specifier group back through the side table when
// it is a placeholder this tokenizer minted; returns the raw captured text
// unchanged for any group that is not one of our placeholders (defensive --
// in practice every quoted group in a tokenized skeleton IS a placeholder,
// since tokenizeStringLiterals replaces every string/template literal).
export function resolvePlaceholder(captured: string, literals: string[]): string {
  const match = PLACEHOLDER_RE.exec(captured);
  if (!match) return captured;
  const index = Number(match[1]);
  assertValidIndex(index, literals);
  return literals[index] as string;
}

function assertValidIndex(index: number, literals: string[]): void {
  if (!(index >= 0 && index < literals.length)) {
    throw new Error(
      `tokenizeStringLiterals placeholder index ${index} out of range for ${literals.length} literals`,
    );
  }
}
