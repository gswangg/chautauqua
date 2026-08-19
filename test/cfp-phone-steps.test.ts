// w14-f (DEC-986): phone CFP two-step wizard. Mirrors the fakeDb/appWithDb
// pattern in test/submit-cfp-frame-copy.test.ts to render GET
// /submit/:eventSlug through the real route, plus source-level assertions
// on the css module and the inline script string.

import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { Hono } from "hono";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import { CFP_CSS } from "../src/routes/public/cfp.css";
import type { AppEnv } from "../src/server/env";

const EVENT_ROW = {
  id: "event-1",
  orgId: "org-1",
  name: "Test Conf",
  slug: "test-conf",
  recordPrefix: "SES",
  timezone: "UTC",
  brandingJson: null,
};

const FORM_ROW = {
  id: "form-1",
  eventId: "event-1",
  title: "Speak at Test Conf",
  description: null,
  isDefault: true,
  openDate: null,
  closeDate: null,
  tracksJson: null,
};

const TRACK_ROWS = [{ id: "track-1", name: "Main Track" }];

const FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "description", section: "session", kind: "long_text", label: "Description", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 2, optionsJson: null, ruleJson: null },
  { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 3, optionsJson: null, ruleJson: null },
  { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 4, optionsJson: null, ruleJson: null },
];

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) => Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: () => ({ values: () => ({ then: (resolve: (v: undefined) => void) => resolve(undefined) }) }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
    delete: () => ({ where: async () => {} }),
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

function fakeKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

function appWithDb(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/", publicSubmitRoutes);
  return app;
}

async function getSubmitPage() {
  const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, TRACK_ROWS]);
  const app = appWithDb(db);
  const res = await app.request("/submit/test-conf", { headers: {} }, { KV: fakeKv() } as unknown as AppEnv["Bindings"]);
  expect(res.status).toBe(200);
  return res.text();
}

describe("GET /submit/:eventSlug — phone two-step wizard markup (w14-f, DEC-986)", () => {
  it("defaults the form's step attribute to 'all'", async () => {
    const body = await getSubmitPage();
    expect(body).toContain('data-chq-cfp-step="all"');
  });

  it("marks both sections with the step classes", async () => {
    const body = await getSubmitPage();
    expect(body).toMatch(/<section class="chq-cfp-step chq-cfp-step-talk">/);
    expect(body).toMatch(/<section class="chq-cfp-step chq-cfp-step-you">/);
  });

  it("renders the phone progress chrome (label + two-segment bar)", async () => {
    const body = await getSubmitPage();
    expect(body).toContain('class="chq-cfp-steps"');
    expect(body).toContain('class="chq-cfp-steps-label"');
    expect(body).toContain("Step 1 of 2");
    expect(body).toContain('class="chq-cfp-steps-bar"');
    expect(body).toContain('class="chq-cfp-steps-bar-fill"');
  });

  it("renders the Next/Back step controls as non-submitting buttons inside .chq-cfp-actions", async () => {
    const body = await getSubmitPage();
    expect(body).toMatch(/<button type="button" class="[^"]*chq-cfp-step-next[^"]*">\s*Next: about you\s*<\/button>/);
    expect(body).toMatch(/<button type="button" class="[^"]*chq-cfp-step-back[^"]*">\s*Back\s*<\/button>/);
  });

  it("renders the CfpStepsScript inline script alongside FieldRulesScript", async () => {
    const body = await getSubmitPage();
    expect(body).toContain("chq-cfp-submit-form");
    expect(body).toContain("chq-cfp-steps-label");
    // both inline scripts are present in the response
    const scriptCount = (body.match(/<script>/g) ?? []).length;
    expect(scriptCount).toBeGreaterThanOrEqual(2);
  });
});

describe("cfp.css.ts — phone wizard chrome (w14-f)", () => {
  const NEW_CLASSES = [
    ".chq-cfp-steps",
    ".chq-cfp-steps-label",
    ".chq-cfp-steps-bar",
    ".chq-cfp-steps-bar-fill",
    ".chq-cfp-step-next",
    ".chq-cfp-step-back",
  ];

  function stripMedia(css: string): string {
    return css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, "");
  }

  const withoutMedia = stripMedia(CFP_CSS);

  for (const selector of NEW_CLASSES) {
    it(`${selector} is display:none at top level (outside any @media)`, () => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
      const match = withoutMedia.match(re);
      expect(match, `${selector} has no top-level rule`).not.toBeNull();
      expect(match![1]).toMatch(/display:\s*none\s*;?\s*$/);
    });

    it(`${selector} is switched back on inside the existing 700px media query`, () => {
      const mediaIdx = CFP_CSS.indexOf("@media (max-width: 700px)");
      expect(mediaIdx).toBeGreaterThan(-1);
      const mediaBody = CFP_CSS.slice(mediaIdx);
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`${escaped}[,\\s]*[^{]*\\{([^}]*display:\\s*[^;]+;[^}]*)\\}`);
      const match = mediaBody.match(re);
      expect(match, `${selector} has no rule inside the 700px media query`).not.toBeNull();
      expect(match![1]).not.toMatch(/display:\s*none/);
    });
  }

  it("hides the YOU section on step 1 and the talk section on step 2, inside the 700px query", () => {
    expect(CFP_CSS).toMatch(/\[data-chq-cfp-step="1"\] \.chq-cfp-step-you \{\s*display:\s*none;\s*\}/);
    expect(CFP_CSS).toMatch(/\[data-chq-cfp-step="2"\] \.chq-cfp-step-talk \{\s*display:\s*none;\s*\}/);
  });

  it("hides submit-type action buttons on step 1 except .chq-cfp-save-draft, and the Next control on step 2", () => {
    expect(CFP_CSS).toMatch(/\[data-chq-cfp-step="1"\] \.chq-cfp-actions button\[type="submit"\]:not\(\.chq-cfp-save-draft\) \{\s*display:\s*none;\s*\}/);
    expect(CFP_CSS).toMatch(/\[data-chq-cfp-step="2"\] \.chq-cfp-step-next \{\s*display:\s*none;\s*\}/);
  });

  it("does not hide .chq-cfp-save-draft on step 1 (an anonymous phone submitter can save a draft before advancing)", () => {
    const mediaBody = CFP_CSS.slice(CFP_CSS.indexOf("@media (max-width: 700px)"));
    // No rule scoped under [data-chq-cfp-step="1"] whose selector matches
    // .chq-cfp-save-draft (i.e. not excluded via :not()) may declare
    // display:none.
    const stepOneRules = mediaBody.match(/\[data-chq-cfp-step="1"\][^{]*\{[^}]*\}/g) ?? [];
    for (const rule of stepOneRules) {
      const selector = rule.slice(0, rule.indexOf("{"));
      const excludesSaveDraft = /:not\(\.chq-cfp-save-draft\)/.test(selector);
      const targetsSaveDraft = /\.chq-cfp-save-draft/.test(selector) && !excludesSaveDraft;
      if (targetsSaveDraft) {
        expect(rule).not.toMatch(/display:\s*none/);
      }
    }
    expect(mediaBody).not.toMatch(/\.chq-cfp-save-draft\s*\{[^}]*display:\s*none/);
  });

  it("gives .chq-cfp-save-draft the frame's :1063 dock geometry (docs/design/Chautauqua Public and Portal.dc.html:1063 `border:1px solid #BAB6A6; border-radius:6px; min-height:48px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600`)", () => {
    const mediaBody = CFP_CSS.slice(CFP_CSS.indexOf("@media (max-width: 700px)"));
    const match = mediaBody.match(/\.chq-cfp-save-draft\s*\{([^}]*)\}/);
    expect(match, ".chq-cfp-save-draft has no rule inside the 700px media query").not.toBeNull();
    const body = match![1];
    expect(body).toMatch(/min-height:\s*48px/);
    expect(body).toMatch(/display:\s*inline-flex/);
    expect(body).toMatch(/align-items:\s*center/);
    expect(body).toMatch(/padding:\s*0 16px/);
    expect(body).toMatch(/border:\s*1px solid var\(--chq-border\)/);
    expect(body).toMatch(/border-radius:\s*6px/);
    expect(body).toMatch(/font-size:\s*13px/);
    expect(body).toMatch(/font-weight:\s*600/);
  });

  it("gives the step controls a >=44px minimum touch target inside the media query", () => {
    const mediaBody = CFP_CSS.slice(CFP_CSS.indexOf("@media (max-width: 700px)"));
    expect(mediaBody).toMatch(/\.chq-cfp-step-next,\s*\n\s*\.chq-cfp-step-back \{[^}]*min-height:\s*44px[^}]*min-width:\s*44px/);
  });

  it("uses only --chq- custom-property colours (DEC-383), no literal colour value", () => {
    const mediaBody = CFP_CSS.slice(CFP_CSS.indexOf("@media (max-width: 700px)"));
    const wizardBody = mediaBody.slice(mediaBody.indexOf(".chq-cfp-steps {"));
    // Any color/background/border-color declaration must reference a
    // var(--chq-*) token, never a hex/rgb/named literal.
    const colourDecls = wizardBody.match(/(?:^|\s)(color|background|background-color|border-color)\s*:\s*[^;]+;/g) ?? [];
    for (const decl of colourDecls) {
      expect(decl).toMatch(/var\(--chq-/);
    }
  });
});

describe("cfp-steps-script — refuses to engage when the form already carries an error", () => {
  it("checks for .chq-field-error and [role=\"alert\"] before setting a step, and bails out early when either is present", async () => {
    const mod = await import("../src/routes/public/cfp-steps-script");
    const el = mod.CfpStepsScript() as unknown as { props: { dangerouslySetInnerHTML: { __html: string } } };
    const js = el.props.dangerouslySetInnerHTML.__html;
    expect(js).toContain("chq-field-error");
    expect(js).toContain('[role="alert"]');
    expect(js).toContain("if (hasError) return;");
    // No fetch, no change to the POST target.
    expect(js).not.toContain("fetch(");
  });
});

// ---------------------------------------------------------------------------
// DEC-986 clause (2): "Next" must run constraint validation over the OUTGOING
// step and refuse to advance while it fails. Without this, advancing hid step
// 1 (display:none) with its controls still `required`, and the real Submit on
// step 2 -- which deliberately carries no formnovalidate, clause (3) -- was
// aborted by the browser on a control it could neither focus nor annotate:
// no message, no server hit, no recovery. jsdom does implement the constraint
// validation API, so the behaviour is executable here even though the layout
// that makes it reachable is phone-only.
// ---------------------------------------------------------------------------
describe("cfp-steps-script — Next validates step 1 before advancing (DEC-986)", () => {
  async function stepScriptJs(): Promise<string> {
    const mod = await import("../src/routes/public/cfp-steps-script");
    const el = mod.CfpStepsScript() as unknown as { props: { dangerouslySetInnerHTML: { __html: string } } };
    return el.props.dangerouslySetInnerHTML.__html;
  }

  it("calls checkValidity over the outgoing section and reportValidity on the first invalid control", async () => {
    const js = await stepScriptJs();
    expect(js).toContain("checkValidity()");
    expect(js).toContain("reportValidity()");
    expect(js).toContain(".chq-cfp-step-talk");
    // Still no fetch, still no change to the POST target (DEC-986's shape).
    expect(js).not.toContain("fetch(");
    expect(js).not.toContain("formnovalidate");
  });

  it("never advances unconditionally: setStep('2') is not the whole Next handler", async () => {
    const js = await stepScriptJs();
    expect(js).not.toMatch(/next\.addEventListener\('click',\s*function\(\)\{\s*setStep\('2'\);\s*\}\)/);
  });

  async function runWizard(fill: boolean) {
    const js = await stepScriptJs();
    const dom = new JSDOM(
      `<!doctype html><html><body>
        <form id="chq-cfp-submit-form" data-chq-cfp-step="all">
          <div class="chq-cfp-steps">
            <span class="chq-cfp-steps-label">Step 1 of 2</span>
            <div class="chq-cfp-steps-bar"><div class="chq-cfp-steps-bar-fill"></div></div>
          </div>
          <section class="chq-cfp-step chq-cfp-step-talk">
            <input class="chq-input" name="f_title" required value="${fill ? "A talk" : ""}">
            <label><input type="radio" name="trackIds" value="t1" required ${fill ? "checked" : ""}>Main</label>
            <label><input type="radio" name="trackIds" value="t2" required>Side</label>
          </section>
          <section class="chq-cfp-step chq-cfp-step-you">
            <input class="chq-input" name="f_email" required>
          </section>
          <div class="chq-cfp-actions">
            <button type="submit" class="chq-btn">Submit this talk</button>
            <button type="button" class="chq-btn chq-cfp-step-next">Next: about you</button>
            <button type="button" class="chq-btn chq-cfp-step-back">Back</button>
          </div>
        </form>
        <script>${js}</script>
      </body></html>`,
      { url: "https://example.test/submit/test-conf", runScripts: "dangerously" },
    );
    // jsdom implements constraint validation but not scrollIntoView; stub it
    // so setStep's final line does not throw inside the click handler.
    dom.window.HTMLElement.prototype.scrollIntoView = function () {};
    const document = dom.window.document;
    // The script arms itself on DOMContentLoaded, which jsdom dispatches
    // asynchronously once it finishes parsing -- wait for it before asserting.
    if (document.readyState === "loading") {
      await new Promise<void>((resolve) => document.addEventListener("DOMContentLoaded", () => resolve()));
    }
    const form = document.getElementById("chq-cfp-submit-form")!;
    expect(form.getAttribute("data-chq-cfp-step")).toBe("1");
    const invalidEvents: string[] = [];
    form.addEventListener("invalid", (e: Event) => invalidEvents.push((e.target as HTMLInputElement).name), true);
    (document.querySelector(".chq-cfp-step-next") as HTMLElement).click();
    return { form, document, invalidEvents };
  }

  it("an empty step 1 stays on step 1 and raises the browser's own validity report", async () => {
    const { form, invalidEvents } = await runWizard(false);
    expect(form.getAttribute("data-chq-cfp-step")).toBe("1");
    // reportValidity() on the first invalid control fires `invalid` at it --
    // that is the browser bubble the speaker sees, on a still-visible field.
    expect(invalidEvents.length).toBeGreaterThan(0);
    expect(invalidEvents[0]).toBe("f_title");
  });

  it("a complete step 1 advances to step 2 and re-labels the progress chrome", async () => {
    const { form, document } = await runWizard(true);
    expect(form.getAttribute("data-chq-cfp-step")).toBe("2");
    expect(document.querySelector(".chq-cfp-steps-label")!.textContent).toContain("Step 2 of 2");
    expect((document.querySelector(".chq-cfp-steps-bar-fill") as HTMLElement).style.width).toBe("100%");
  });

  it("does not validate step 2 on the way back (Back is always available)", async () => {
    const { form, document } = await runWizard(true);
    expect(form.getAttribute("data-chq-cfp-step")).toBe("2");
    (document.querySelector(".chq-cfp-step-back") as HTMLElement).click();
    expect(form.getAttribute("data-chq-cfp-step")).toBe("1");
  });
});
