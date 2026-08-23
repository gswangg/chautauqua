// Shared HTML/Markdown comment stripper (DEC-374 wave-44, task w44-i).
// test/helpers/strip-css-comments.ts is CSS-shaped and
// test/helpers/strip-ts-comments.ts is TS/JS-shaped -- neither recognises
// the `<!-- ... -->` comment form that `.dc.html` v12 frame files use and
// that GitHub-flavoured Markdown (this repo's `docs/design/audit/*.md`
// ledgers, `DEVIATIONS.md`, etc.) also accepts inline. A genuinely
// different comment grammar gets its own shared instrument rather than a
// bent reuse of either existing one (DEC-613: a second COPY of a
// vocabulary is the trap; a second instrument for a genuinely different
// grammar is not).
//
// Unlike the TS stripper, HTML/Markdown has no quote-delimited string
// literal whose content this stripper must protect from being mistaken for
// a comment (a `.dc.html` frame's `<!--` never appears escaped inside an
// attribute value in this codebase's design pack, and Markdown prose has no
// string-literal concept at all) -- so this is a plain, non-quote-aware
// `<!--...-->` sweep. Comments are replaced with a same-count run of
// newline characters (never with '') so line numbers in the stripped text
// still line up with the original, matching strip-css-comments.ts's and
// strip-ts-comments.ts's own convention.
export function stripHtmlComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, (comment) => {
    const newlines = comment.match(/\n/g);
    return newlines ? "\n".repeat(newlines.length) : "";
  });
}
