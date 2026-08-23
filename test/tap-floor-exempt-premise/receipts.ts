// Contention decomposition (custodian, wave 44): receipt types + extraction,
// extracted verbatim from test/tap-floor-exempt-premise.scan.test.ts, no
// behavior change.
import type { ProductFile } from "./population";

export type ReasonFamily = "composition" | "inline" | "modifier" | "scoped" | "render-gate" | "other";
export type Verdict = "VERIFIED" | "UNVERIFIABLE-PREMISE" | "FALSE-PREMISE";

export interface Receipt {
  file: string;
  line: number;
  reason: string;
  receiptedClasses: string[];
  family: ReasonFamily;
}

export interface RosterRow extends Receipt {
  verdict: Verdict;
  detail: string;
}

/** Every real `/* tap-floor-exempt: ... *\/` comment in `text`, matched
 * against the real (non-nested block-comment) grammar -- never a raw
 * substring search, so prose ABOUT the token (a `//` comment, a JS string,
 * a regex literal) is never misread as a receipt. */
export function extractReceipts(rel: string, text: string): Receipt[] {
  const commentRe = /\/\*[\s\S]*?\*\//g;
  const out: Receipt[] = [];
  let m: RegExpExecArray | null;
  while ((m = commentRe.exec(text)) !== null) {
    const stripped = m[0].replace(/^\/\*+\s*/, "");
    if (!/^tap-floor-exempt:/.test(stripped)) continue;
    const line = text.slice(0, m.index).split("\n").length;
    const reason = stripped.replace(/^tap-floor-exempt:\s*/, "").replace(/\*\/$/, "").trim();
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 300);
    const selMatch = after.match(/^[\s}]*([^{}\n][^{]*)\{/);
    const receiptedClasses =
      selMatch && selMatch[1] ? [...selMatch[1].matchAll(/\.(chq-[\w-]+)/g)].map((c) => c[1] as string) : [];
    const firstWord = reason.trim().split(/\s+/)[0]?.replace(/[,.:;]+$/, "") ?? "";
    // DEC-393 wave-36 (task w36-f): three more named reason families beyond
    // `composition`/`inline-*` are checkable today -- `modifier` and
    // `scoped` both state the SAME premise shape as `composition` (a
    // companion class carries the real floor) and are routed through the
    // unchanged companion floor-grammar tiers below; `render-gate` states a
    // different premise (the component never mounts at phone width) and
    // gets its own two-tier predicate in judgeRenderGate. Everything else
    // still falls to `other` (no predicate this wave, DEC-393 wave-30
    // clause (c)) exactly as before.
    const family: ReasonFamily = /^composition$/i.test(firstWord)
      ? "composition"
      : /^inline/i.test(firstWord)
        ? "inline"
        : /^modifier$/i.test(firstWord)
          ? "modifier"
          : /^scoped$/i.test(firstWord)
            ? "scoped"
            : /^render-gate$/i.test(firstWord)
              ? "render-gate"
              : "other";
    out.push({ file: rel, line, reason, receiptedClasses, family });
  }
  return out;
}

export function allReceipts(files: ProductFile[]): Receipt[] {
  return files.flatMap((f) => extractReceipts(f.path, f.text));
}
