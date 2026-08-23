// Shared, character-length-preserving TS/JS-source comment stripper
// (DEC-613 wave-46 task w46-c). Lifted VERBATIM from the private
// `stripComments` that test/file-delete-ordering.scan.test.ts and
// test/served-content-type-single-source.scan.test.ts each carried as their
// own copy (the latter's own header comment already said "copied verbatim
// from test/file-delete-ordering.scan.test.ts so both scans share one proven
// implementation" -- this module is that sharing, made real instead of
// aspirational). test/user-content-nosniff.test.ts's new DEC-551 structural
// scan imports it too, so there are three callers and ONE implementation
// (DEC-613: "a second copy of a vocabulary is a trap with a delay fuse").
//
// Deliberately NOT the same helper as test/helpers/strip-ts-comments.ts: that
// one replaces a whole comment with a run of newlines (line numbers survive,
// character OFFSETS do not), which is wrong for these three scans -- they
// brace-match and slice by character offset into the STRIPPED text and rely
// on offsets lining up 1:1 with the original source. This helper instead
// replaces every stripped character with a single space (newlines preserved
// verbatim), so the output has EXACTLY the same length -- and therefore the
// same character offsets AND the same line numbers -- as the input.
// String/template literals are tracked (with backslash-escape awareness) so
// a `//` or `/*` inside a string (e.g. a URL) is never mistaken for the
// start of a comment.
export function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = i + 1 < n ? src[i + 1] : "";
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (c === "/" && c2 === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < n) {
        out += "  ";
        i += 2;
      }
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
        out += src[i];
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
