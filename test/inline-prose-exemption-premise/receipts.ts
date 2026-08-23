// Contention decomposition (task w56-e, DEC-613): InlineReceipt extraction,
// extracted verbatim from test/inline-prose-exemption-premise.scan.test.ts,
// no behavior change -- the same decomposition idiom
// test/tap-floor-exempt-premise/ already uses.
import type { ProductFile } from "../tap-floor-exempt-premise/population";

export interface InlineReceipt {
  file: string;
  line: number;
  reason: string;
  receiptedClasses: string[];
}

/** Every real `/* tap-floor-exempt: ... *\/` (or `{/* ... *\/}`) comment
 * whose reason's first word starts with `inline` -- matched against the
 * real (non-nested block-comment) grammar, never a raw substring search
 * (same discipline as the wave-30 sibling instrument). */
export function extractInlineReceipts(rel: string, text: string): InlineReceipt[] {
  const commentRe = /\/\*[\s\S]*?\*\//g;
  const out: InlineReceipt[] = [];
  let m: RegExpExecArray | null;
  while ((m = commentRe.exec(text)) !== null) {
    const stripped = m[0].replace(/^\/\*+\s*/, "");
    if (!/^tap-floor-exempt:/.test(stripped)) continue;
    const reason = stripped.replace(/^tap-floor-exempt:\s*/, "").replace(/\*\/$/, "").trim();
    const firstWord = reason.trim().split(/\s+/)[0]?.replace(/[,.:;]+$/, "") ?? "";
    if (!/^inline/i.test(firstWord)) continue;
    const line = text.slice(0, m.index).split("\n").length;
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 300);
    const selMatch = after.match(/^[\s}]*([^{}\n][^{]*)\{/);
    const receiptedClasses =
      selMatch && selMatch[1] ? [...selMatch[1].matchAll(/\.(chq-[\w-]+)/g)].map((c) => c[1] as string) : [];
    out.push({ file: rel, line, reason, receiptedClasses });
  }
  return out;
}

export function allInlineReceipts(files: ProductFile[]): InlineReceipt[] {
  return files.flatMap((f) => extractInlineReceipts(f.path, f.text));
}
