// Docs screenshot shoot (v12 intake §B; DESIGN-RULINGS "Screenshot rules").
// Re-shoot every release — this IS the script the ruling asks for.
//
// Rules encoded here, verbatim from the ruling:
//   1. From the real app at 1600×900 — never a mock. Run against a freshly
//      seeded build (local wrangler dev of the frozen sha, or prod).
//   2. Seeded data only (DevFlow Conf 2027).
//   3. Full frames, not crops — the chrome is how a reader locates themselves.
//   4. The caption carries the point (captions live in src/routes/docs-content).
//   5. No annotation drawn on top.
//   6. Re-shoot every release.
//
// Usage: node scripts/docs-shots.mjs [baseUrl] [outDir]
//   baseUrl default http://localhost:8878
//   outDir  default public/docs-shots
//
// Shots write as <shotId>.png at 1600×900@2x. The recusal shot MUTATES
// (recusal is permanent) — only run against a re-seedable target, never a
// database whose state you need to keep.
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.argv[2] ?? "http://localhost:8878";
const OUT = process.argv[3] ?? join(ROOT, "public", "docs-shots");
mkdirSync(OUT, { recursive: true });

const fx = JSON.parse(readFileSync(join(ROOT, "docs", "fixtures", "sample-data.json"), "utf-8"));

async function login(page, who) {
  const { email, password } = fx.identities[who];
  await page.goto(`${BASE}/login`);
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", password);
  await page.click("button[type=submit]");
  await page.waitForLoadState("networkidle");
}

async function shot(page, id) {
  await page.waitForTimeout(900); // fonts + data settle; skeletons resolve
  await page.screenshot({ path: join(OUT, `${id}.png`) });
  console.log(`shot ${id}`);
}

const browser = await chromium.launch();

// --- organizer shots -------------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  await login(page, "organizer");

  await page.goto(`${BASE}/admin/overview`);
  await shot(page, "getting-started-start-here-01");

  // Form builder with a field's settings open (caption: field list left,
  // settings incl. visibility rule right).
  await page.goto(`${BASE}/admin/submissions/forms`);
  await page.waitForTimeout(1200);
  const edit = page.locator("text=Edit").first();
  if (await edit.count()) await edit.click();
  await shot(page, "running-an-event-call-for-papers-and-submissions-01");

  // Shot 02 BLOCKED until the article's caption is fixed (it describes a
  // nonexistent submissions board — see eval-findings, docs pre-shoot check).
  // Once re-targeted, add its navigation here.
  console.log("SKIP running-an-event-call-for-papers-and-submissions-02 (caption fix pending)");
  await page.close();
}

// --- speaker shots ---------------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  await login(page, "speaker");
  await page.goto(`${BASE}/portal`);
  await shot(page, "for-speakers-your-speaker-portal-01");
  await page.goto(`${BASE}/portal/profile`);
  await shot(page, "for-speakers-your-speaker-portal-02");
  await page.close();
}

// --- reviewer shots (the recusal shot MUTATES — see header) ---------------
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  await login(page, "reviewer");
  await page.goto(`${BASE}/admin/review`);
  await page.waitForTimeout(1000);
  const queueLink = page.locator("a[href*='/review/plans/']").first();
  if (await queueLink.count()) await queueLink.click();
  await shot(page, "for-reviewers-reviewing-start-to-finish-01");

  // Recusal: open the top queue item's scorecard, show the recuse step.
  const row = page.locator("a[href*='/submissions/']").first();
  if (await row.count()) {
    await row.click();
    await page.waitForTimeout(900);
    const recuse = page.locator("text=Recuse").first();
    if (await recuse.count()) await recuse.click();
    await shot(page, "for-reviewers-reviewing-start-to-finish-02");
  } else {
    console.log("WARN: no scorecard reachable for the recusal shot");
  }
  await page.close();
}

await browser.close();
console.log(`DONE — shots in ${OUT}`);
