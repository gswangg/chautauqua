// DEC-358 wave-49: discharges three of the five items unowned batch-A
// falsifiability remainder (task-w47-h re-homed the batch-A remainder from
// a stale "wave-47+ lane, branch to be named" pointer to UNOWNED; this
// branch is the owner per DEC-358 -- "an adjudication without an owner
// decays in one wave"). The remaining two items (Phone agenda N-aware clash
// caption + "Place here anyway") are component checks, filed in the sibling
// app/src/pages/agenda/PhoneAgenda.w49.render.test.tsx per the task's
// instructions. Every block below was CONFIRMED TRUE at this worker's own
// runtime by opening the cited file:line before writing the assertion.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Item i: "npm run deploy exists" -- package.json:21 (now line 26; the file
// has grown since the batch was first filed, but the script itself is
// unchanged). CONFIRMED TRUE: package.json declares a "deploy" script that
// runs the real remote migration + wrangler deploy pipeline, and `npm run
// deploy --help` (a dry no-op invocation `npm` itself resolves without ever
// invoking wrangler) confirms npm actually resolves the script by that name.
// ---------------------------------------------------------------------------
describe("item i: npm run deploy exists (package.json, DEC-358 batch-A)", () => {
  it("package.json declares a real deploy script running remote migrations then wrangler deploy", () => {
    const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.deploy).toBeDefined();
    expect(pkg.scripts.deploy).toContain("wrangler d1 migrations apply");
    expect(pkg.scripts.deploy).toContain("--remote");
    expect(pkg.scripts.deploy).toContain("wrangler deploy");
  });

  it("npm actually resolves a runnable command by the name \"deploy\" (not just a package.json string)", () => {
    // `npm run` with no script name lists every script npm itself resolves
    // from package.json, WITHOUT executing any of them -- this is the
    // network-free way to prove npm's own script resolution (not just a
    // JSON.parse of the file) finds "deploy" and shows its real command
    // line. Actually invoking the script would shell out to wrangler
    // against a real Cloudflare account, which STAGE 1 forbids (no secrets/
    // external accounts required to run this repo's code or tests).
    // The script list is written at npm's `notice` loglevel, so an ambient
    // `npm_config_loglevel=silent` -- which `npm test --silent` exports into
    // this process and every child it spawns -- makes `npm run` print
    // NOTHING and the assertions below vacuously fail. Pin the loglevel for
    // the child so the probe measures npm's script resolution rather than
    // how the outer test runner happened to be invoked. Still falsifiable:
    // delete the deploy script and the list stops containing it.
    const out = execFileSync("npm", ["run"], {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      env: { ...process.env, npm_config_loglevel: "notice" },
    });
    expect(out).toContain("deploy");
    expect(out).toContain("wrangler d1 migrations apply");
    expect(out).toContain("wrangler deploy");
  });
});

// ---------------------------------------------------------------------------
// Item ii: "Settings edit-view field widths are tokens, not literals" --
// app/src/pages/settings/settings.css:17-22 (now 17-21), DEC-896. CONFIRMED
// TRUE: the file declares four `--chq-field-w-*` custom properties on
// :root, and the four per-kind field classes (`.chq-settings-field-date`
// etc.) set `width` via `var(--chq-field-w-*)`, never a literal px value.
// ---------------------------------------------------------------------------
describe("item ii: settings edit-view field widths are CSS custom-property tokens (DEC-896)", () => {
  const css = readFileSync(path.join(REPO_ROOT, "app/src/pages/settings/settings.css"), "utf-8");

  it("declares the four field-width tokens on :root", () => {
    const rootRule = css.split("}").find((r) => r.includes(":root {"));
    expect(rootRule).toBeDefined();
    for (const token of ["--chq-field-w-date", "--chq-field-w-seats", "--chq-field-w-name", "--chq-field-w-slug"]) {
      expect(rootRule).toContain(`${token}:`);
    }
  });

  it("every per-kind field rule sets width via var(), never a literal px value", () => {
    const cases: Array<[string, string]> = [
      [".chq-settings-field-date", "--chq-field-w-date"],
      [".chq-settings-field-seats", "--chq-field-w-seats"],
      [".chq-settings-field-name", "--chq-field-w-name"],
      [".chq-settings-field-slug", "--chq-field-w-slug"],
    ];
    for (const [selector, token] of cases) {
      const rule = css.split("}").find((r) => r.includes(`${selector} {`));
      expect(rule, `expected a rule for ${selector}`).toBeDefined();
      expect(rule).toContain(`width: var(${token})`);
      // A revert to a hardcoded literal would still satisfy a naive
      // substring check for the class name alone -- assert there is no bare
      // px width sitting in the same rule instead of the var().
      expect(rule).not.toMatch(/width:\s*\d+px/);
    }
  });
});

// ---------------------------------------------------------------------------
// Item v: "Phone password fixed footer + Cancel" -- src/routes/auth.css.ts
// (originally cited :318-336; the phone media block now spans roughly
// 298-329 after wave-48's re-scoping amendment, same behaviour). CONFIRMED
// TRUE: inside the max-width:700px media block, `.chq-bare-page:has(.chq-
// auth-fields)` becomes a full-height flex column whose `.chq-auth-
// fieldstack` (the scrollable field list) is the ONLY flexed/scrolling
// child (flex:1; overflow-y:auto) while `.chq-auth-titlerow` is pinned via
// flex-shrink:0 -- the actions row (holding Cancel) sits after the
// fieldstack, outside the scroll region, so it stays fixed at the bottom of
// the viewport. `.chq-auth-cancel`, hidden by default (`display: none`),
// flips to `display: inline-flex` only inside this same phone media block.
// The real PasswordPage renders a Cancel control inside `.chq-auth-actions`
// (the fixed footer), never inside `.chq-auth-fieldstack` (the scrolling
// region) -- so the token IS the real footer's Cancel, not an unrelated one.
// ---------------------------------------------------------------------------
import { PasswordPage } from "../src/routes/account";
import { AUTH_CSS } from "../src/routes/auth.css";

describe('item v: phone /account/password fixed footer + Cancel (src/routes/auth.css.ts)', () => {
  const mediaStart = AUTH_CSS.indexOf("@media (max-width: 700px)");
  const mediaBlock = AUTH_CSS.slice(mediaStart);
  const baseBlock = AUTH_CSS.slice(0, mediaStart);

  it("has a max-width:700px media block", () => {
    expect(mediaStart).toBeGreaterThan(-1);
  });

  it("makes .chq-auth-cancel visible only inside the phone media block (hidden by default)", () => {
    const baseRule = baseBlock.split("}").find((r) => r.includes(".chq-auth-cancel {"));
    expect(baseRule).toBeDefined();
    expect(baseRule).toContain("display: none");

    const phoneRule = mediaBlock.split("}").find((r) => r.includes(".chq-auth-cancel {"));
    expect(phoneRule).toBeDefined();
    expect(phoneRule).toContain("display: inline-flex");
  });

  it("pins the fieldstack as the sole scrolling region, leaving the actions row (Cancel's real footer) fixed below it", () => {
    const bareRule = mediaBlock.split("}").find((r) => r.includes(".chq-bare-page:has(.chq-auth-fields) {"));
    expect(bareRule).toBeDefined();
    expect(bareRule).toContain("display: flex");
    expect(bareRule).toContain("flex-direction: column");
    expect(bareRule).toContain("min-height: 100dvh");

    const titlerowRule = mediaBlock.split("}").find((r) => r.includes(".chq-auth-titlerow {"));
    expect(titlerowRule).toBeDefined();
    expect(titlerowRule).toContain("flex-shrink: 0");

    const fieldstackRule = mediaBlock.split("}").find((r) => r.includes(".chq-auth-fieldstack {"));
    expect(fieldstackRule).toBeDefined();
    expect(fieldstackRule).toContain("flex: 1");
    expect(fieldstackRule).toContain("overflow-y: auto");
  });

  it("the real PasswordPage renders Cancel inside .chq-auth-actions (the fixed footer), never inside .chq-auth-fieldstack", () => {
    const html = PasswordPage({ csrfToken: "tok", backHref: "/portal" }).toString();

    const fieldstackMatch = html.match(/<div class="chq-auth-fieldstack">[\s\S]*?<\/div>\s*<div class="chq-auth-actions">/);
    expect(fieldstackMatch).toBeDefined();
    const fieldstackHtml = fieldstackMatch![0];
    expect(fieldstackHtml).not.toContain("chq-auth-cancel");

    const actionsMatch = html.match(/<div class="chq-auth-actions">[\s\S]*?<\/div>/);
    expect(actionsMatch).toBeDefined();
    expect(actionsMatch![0]).toContain("chq-auth-cancel");
    expect(actionsMatch![0]).toMatch(/class="chq-btn chq-btn-secondary chq-auth-cancel"/);
  });
});
