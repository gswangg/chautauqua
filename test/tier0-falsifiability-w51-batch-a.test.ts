// DEC-358/DEC-069 wave-51: discharges the two non-JSX items of batch-A's
// remainder (UNOWNED since wave 47) with real exercised checks. Each block
// was verified against the cited source at this worker's own runtime before
// writing the assertion -- both checks pin to the real parsed/imported
// value, not a comment grep or a `toContain('DEC-...')`.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Item 1: "npm run deploy is migrations + deploy" -- package.json. CONFIRMED
// TRUE at this worker's own runtime: the mandate's cited line number (21) is
// stale, the script actually sits at line 26, so this asserts the script's
// VALUE by parsing package.json rather than trusting a line number.
// ---------------------------------------------------------------------------
describe("item 1: npm run deploy runs migrations then deploy (package.json)", () => {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };

  it("deploy script applies remote migrations before deploying, in that order", () => {
    const deployScript = pkg.scripts.deploy!;
    expect(deployScript).toBe("wrangler d1 migrations apply chautauqua --remote && wrangler deploy");

    // Order matters: migrations must run before deploy, not merely be
    // present somewhere in the script.
    const migrationsIdx = deployScript.indexOf("wrangler d1 migrations apply chautauqua --remote");
    const deployIdx = deployScript.indexOf("wrangler deploy");
    expect(migrationsIdx).toBeGreaterThanOrEqual(0);
    expect(deployIdx).toBeGreaterThan(migrationsIdx);
  });
});

// ---------------------------------------------------------------------------
// Item 4: "phone password fixed footer + Cancel" --
// src/routes/auth.css.ts:318-336. CONFIRMED TRUE at this worker's own
// runtime: inside the @media (max-width: 700px) block, .chq-auth-fields
// becomes a flex column with .chq-auth-fieldstack set to flex:1 +
// overflow-y:auto (the scrollable field list) while the sibling
// .chq-auth-actions footer (submit + Cancel, in src/routes/account.tsx) is
// NOT given flex:1, so it stays pinned at the bottom of the flex column
// while the fieldstack scrolls underneath it -- a "fixed footer" achieved
// through flex layout, not literal position:fixed. The base rule hides
// Cancel (display:none); the phone media query flips it to visible.
// ---------------------------------------------------------------------------
import { AUTH_CSS } from "../src/routes/auth.css";

describe("item 4: phone password page gets a pinned footer + visible Cancel (auth.css.ts)", () => {
  const mediaBlockMatch = AUTH_CSS.match(/@media \(max-width: 700px\) \{([\s\S]*?)\n {2}\}/);

  it("base rule (outside the phone media query) hides the Cancel action", () => {
    const beforeMedia = AUTH_CSS.slice(0, AUTH_CSS.indexOf("@media (max-width: 700px)"));
    expect(beforeMedia).toMatch(/\.chq-auth-cancel\s*\{\s*display:\s*none;\s*\}/);
  });

  it("phone media query flips Cancel to visible -- a rule that DIFFERS from the base rule", () => {
    expect(mediaBlockMatch).not.toBeNull();
    const mediaBlock = mediaBlockMatch![1]!;
    expect(mediaBlock).toMatch(/\.chq-auth-cancel\s*\{\s*display:\s*inline-flex;\s*\}/);
  });

  it("phone media query pins the footer by making the fieldstack the ONLY scrollable/growing region, not the footer", () => {
    expect(mediaBlockMatch).not.toBeNull();
    const mediaBlock = mediaBlockMatch![1]!;

    // .chq-auth-fields is the flex column ancestor.
    const fieldsRule = mediaBlock.match(/\.chq-auth-fields\s*\{([^}]*)\}/);
    expect(fieldsRule).not.toBeNull();
    expect(fieldsRule![1]).toMatch(/flex:\s*1/);
    expect(fieldsRule![1]).toMatch(/display:\s*flex/);
    expect(fieldsRule![1]).toMatch(/flex-direction:\s*column/);

    // .chq-auth-fieldstack is the scrollable child that grows and clips.
    const fieldstackRule = mediaBlock.match(/\.chq-auth-fieldstack\s*\{([^}]*)\}/);
    expect(fieldstackRule).not.toBeNull();
    expect(fieldstackRule![1]).toMatch(/flex:\s*1/);
    expect(fieldstackRule![1]).toMatch(/overflow-y:\s*auto/);

    // The footer (.chq-auth-actions, rendered in account.tsx as a sibling of
    // .chq-auth-fieldstack inside .chq-auth-fields) has NO rule in the phone
    // media query giving it flex-grow or overflow -- it is a plain
    // non-growing flex-column child, so it stays pinned below the
    // scrollable fieldstack instead of scrolling away with it.
    expect(mediaBlock).not.toMatch(/\.chq-auth-actions\s*\{[^}]*flex:\s*1/);
    expect(mediaBlock).not.toMatch(/\.chq-auth-actions\s*\{[^}]*overflow/);
  });
});
