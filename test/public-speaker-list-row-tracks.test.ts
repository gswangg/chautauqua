// DEC-885 Amendment (wave 21): the public speakers LIST row must take the
// frame's 76px / 1fr / 280px column tracks with a square (card-radius)
// headshot, not the stale 80px / 1fr / 1fr grid with a circular photo.

import { describe, expect, it } from "vitest";
import { CARDS_CSS } from "../src/routes/public/css/cards.css";

describe("DEC-885 Amendment (wave 21): speaker list row tracks + headshot", () => {
  it(".chq-pub-speaker-list-row uses the frame's 76px 1fr 280px tracks", () => {
    const rule = CARDS_CSS.match(/\.chq-pub-speaker-list-row\s*\{([^}]*)\}/);
    expect(rule).toBeTruthy();
    expect(rule![1]).toMatch(/grid-template-columns:\s*76px 1fr 280px;/);
  });

  it(".chq-pub-speaker-list-photo is pinned to a 76px square box", () => {
    const rule = CARDS_CSS.match(/\.chq-pub-speaker-list-photo\s*\{([^}]*)\}/);
    expect(rule).toBeTruthy();
    expect(rule![1]).toMatch(/width:\s*76px;/);
  });

  it(".chq-pub-speaker-list-photo img / fallback are 76x76 with the card-radius token, not a circle", () => {
    const rule = CARDS_CSS.match(
      /\.chq-pub-speaker-list-photo img,\s*\n\s*\.chq-pub-speaker-list-photo \.chq-pub-headshot-fallback\s*\{([^}]*)\}/,
    );
    expect(rule).toBeTruthy();
    const body = rule![1]!;
    expect(body).toMatch(/width:\s*76px;/);
    expect(body).toMatch(/height:\s*76px;/);
    expect(body).toMatch(/aspect-ratio:\s*1\/1;/);
    expect(body).toMatch(/object-fit:\s*cover;/);
    expect(body).toMatch(/border-radius:\s*var\(--chq-r-card\);/);
    expect(body).not.toMatch(/border-radius:\s*50%/);
  });

  it("no border-radius: 50% remains anywhere on the list photo rules", () => {
    const listSection = CARDS_CSS.slice(
      CARDS_CSS.indexOf(".chq-pub-speaker-list {"),
      CARDS_CSS.indexOf(".chq-pub-speaker-list-info"),
    );
    expect(listSection).not.toMatch(/border-radius:\s*50%/);
  });
});
