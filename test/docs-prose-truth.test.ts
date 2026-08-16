// task-w8-c: DEC-518 (docs prose must describe the app that exists). Two
// falsehoods were found and corrected this wave: the reviewer-queue
// "recuse yourself... directly in the queue" claim (the control actually
// lives on the scorecard) and the "permanent step-aside, not a snooze"
// caption (an undo route exists and DELETEs the recusal). This guard
// derives the article set from DOCS_ARTICLES (index.ts's exported
// collection) rather than hand-listing files -- a hand-listed population is
// not a population (DEC-180) -- so a future article carrying either phrase,
// or a recusal article that stops naming the scorecard, fails loudly.

import { describe, expect, it } from "vitest";
import { DOCS_ARTICLES } from "../src/routes/docs-content";

function allBlockText(article: (typeof DOCS_ARTICLES)[number]): string[] {
  const texts: string[] = [];
  for (const block of article.blocks) {
    if (block.kind === "heading" || block.kind === "prose") texts.push(block.text);
    if (block.kind === "list") texts.push(...block.items);
    if (block.kind === "figure") texts.push(block.caption);
    if (block.kind === "aside") texts.push(block.label, block.text);
    if (block.kind === "deflist") for (const row of block.rows) texts.push(row.term, row.definition);
    if (block.kind === "code") texts.push(...block.lines);
  }
  return texts;
}

describe("docs prose truth (DEC-518): no article describes a screen or rule that does not exist", () => {
  it("no article contains the verified-false phrase 'permanent step-aside'", () => {
    for (const article of DOCS_ARTICLES) {
      const text = allBlockText(article).join("\n");
      expect(text, `${article.slug} should not call recusal a permanent step-aside`).not.toContain(
        "permanent step-aside",
      );
    }
  });

  it("no article contains the verified-false phrase 'on the right' (the CFP form builder is not a two-pane layout)", () => {
    for (const article of DOCS_ARTICLES) {
      const text = allBlockText(article).join("\n");
      expect(text, `${article.slug} should not describe a right rail that does not exist`).not.toContain(
        "on the right",
      );
    }
  });

  it("the recusal prose names the scorecard as where recusal is declared", () => {
    const article = DOCS_ARTICLES.find((a) => a.slug === "reviewing-start-to-finish");
    expect(article, "reviewing-start-to-finish article").toBeDefined();
    const text = allBlockText(article!).join("\n").toLowerCase();
    expect(text).toContain("scorecard");
    expect(text).toContain("recus");
  });
});
