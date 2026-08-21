// Shared string-aware comment stripper for the two scans converted under
// DEC-374's wave-152 amendment: test/count-grammar.test.ts (DEC-957) and
// test/plural-scan.test.ts (DEC-987). Per that ruling, a source-scanning
// ratchet whose SUBJECT is user-facing copy (not the comment itself) must
// strip comments before matching -- a `(s)` sitting inside a `//` or
// `/* */` comment is prose about the guard, never rendered copy.
//
// String/template-literal aware -- a `//` or `/*` token inside a string or
// template literal never opens a comment (code genuinely contains such
// tokens, e.g. URL literals, regex source) -- and preserves every physical
// newline exactly, including newlines swallowed inside a multi-line
// `/* */` block, so a violation reported after a large doc comment still
// points at its real line number.
//
// This exact state machine already exists as an UNEXPORTED private copy in
// both test/serial-write-scan.test.ts and
// test/vocabulary-duplication-ratchet.scan.test.ts (DEC-613 has already
// sprung on this shape, per DEC-374's wave-152 amendment note: ">=4
// private copies of a stripper in this tree"). Neither of those is
// reachable from a `.test.ts` file without re-registering its suite on
// import, and cancelled-padding-gap.scan.test.ts's exported `stripComments`
// only strips `/* */` (a CSS-only shape, no `//` support, not what a
// `.ts`/`.tsx` source scan needs) -- so rather than hand-roll a FOURTH
// divergent copy inline in each of my two files, this module is the ONE
// place my two scans share it. A later task may point the existing private
// copies at this export too; out of this task's stated scope.
//
// Not a `.test.ts` file -- vitest.config.ts's `include` is
// `test/**/*.test.ts`, so this bare `.ts` module is never collected as a
// suite of its own, and importing it from a `.test.ts` file never
// re-registers anything (same idiom as test/frame-source-corpus.ts).
export function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && c2 === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      i += 2; // skip closing */
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\" && i + 1 < n) {
          out += (src[i] ?? "") + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i] ?? "";
        i++;
      }
      if (i < n) {
        out += src[i];
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}
