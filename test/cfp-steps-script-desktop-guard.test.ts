// w14-ff (DEC-385 wave-139, DEC-986): the phone CFP wizard script gates on
// window.matchMedia('(max-width: 700px)') -- the SAME query cfp.css.ts
// declares -- so it never touches a desktop visitor's form. Before this
// fix, setStep('1') ran unconditionally at DOMContentLoaded regardless of
// viewport, stripping `required` off the visible desktop "you" section and
// jump-scrolling the page on load.
//
// Evaluated the same way this repo's other inline-script pins do: pull the
// literal source out of CfpStepsScript()'s dangerouslySetInnerHTML and run
// it inside a real jsdom document via <script>, mirroring
// test/cfp-phone-steps.test.ts's own runWizard/mountWizard shape (which in
// turn mirrors agenda-itinerary-script.tsx's inline-script pin pattern).

import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";

async function stepScriptJs(): Promise<string> {
  const mod = await import("../src/routes/public/cfp-steps-script");
  const el = mod.CfpStepsScript() as unknown as { props: { dangerouslySetInnerHTML: { __html: string } } };
  return el.props.dangerouslySetInnerHTML.__html;
}

function markup(js: string): string {
  return `<!doctype html><html><body>
    <form id="chq-cfp-submit-form" data-chq-cfp-step="all">
      <div class="chq-cfp-steps">
        <span class="chq-cfp-steps-label">Step 1 of 2</span>
        <div class="chq-cfp-steps-bar"><div class="chq-cfp-steps-bar-fill"></div></div>
      </div>
      <section class="chq-cfp-step chq-cfp-step-talk">
        <input class="chq-input" name="f_title" required value="A talk">
        <label><input type="radio" name="trackIds" value="t1" required checked>Main</label>
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
  </body></html>`;
}

/** A fake MediaQueryList whose `matches` and change-listener are both
 * controllable by the test, so a wave-139 clause-(a) narrow<->widen cycle
 * can be driven deterministically. */
function makeMql(initialMatches: boolean) {
  const listeners: Array<(ev: { matches: boolean }) => void> = [];
  const mql = {
    matches: initialMatches,
    media: "(max-width: 700px)",
    addEventListener: (type: string, fn: (ev: { matches: boolean }) => void) => {
      if (type === "change") listeners.push(fn);
    },
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  };
  function fire(matches: boolean) {
    mql.matches = matches;
    for (const fn of listeners) fn({ matches });
  }
  return { mql, fire };
}

async function mount(initialMatches: boolean) {
  const js = await stepScriptJs();
  const dom = new JSDOM(markup(js), {
    url: "https://example.test/submit/test-conf",
    runScripts: "dangerously",
  });
  const scrollSpy = vi.fn();
  dom.window.HTMLElement.prototype.scrollIntoView = scrollSpy;
  const { mql, fire } = makeMql(initialMatches);
  dom.window.matchMedia = (() => mql) as unknown as typeof dom.window.matchMedia;
  const document = dom.window.document;
  if (document.readyState === "loading") {
    await new Promise<void>((resolve) => document.addEventListener("DOMContentLoaded", () => resolve()));
  }
  const form = document.getElementById("chq-cfp-submit-form")!;
  const email = document.querySelector('[name="f_email"]') as HTMLInputElement;
  const title = document.querySelector('[name="f_title"]') as HTMLInputElement;
  return { document, form, email, title, scrollSpy, fire };
}

describe("cfp-steps-script — desktop guard (DEC-385 wave-139)", () => {
  it("matches:false — never engages: required speaker input stays required, no step value is set, and scrollIntoView is never called", async () => {
    const { form, email, scrollSpy } = await mount(false);
    expect(email.required).toBe(true);
    expect(form.getAttribute("data-chq-cfp-step")).toBe("all");
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("matches:true — step 1 engages: the you-section's required control is un-required with its original stashed, and scrollIntoView was NOT called at init", async () => {
    const { form, email, scrollSpy } = await mount(true);
    expect(form.getAttribute("data-chq-cfp-step")).toBe("1");
    expect(email.required).toBe(false);
    expect(email.getAttribute("data-chq-cfp-required-orig")).toBe("1");
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("matches:true — clicking Next over a valid step 1 advances to step 2 and DOES scroll", async () => {
    const { document, form, scrollSpy } = await mount(true);
    (document.querySelector(".chq-cfp-step-next") as HTMLElement).click();
    expect(form.getAttribute("data-chq-cfp-step")).toBe("2");
    expect(scrollSpy).toHaveBeenCalled();
  });

  it("matches:true then a mql change to matches:false restores `required` on every stashed control and clears the step attribute", async () => {
    const { form, email, title, fire } = await mount(true);
    expect(form.getAttribute("data-chq-cfp-step")).toBe("1");
    expect(email.required).toBe(false);
    fire(false);
    expect(email.required).toBe(true);
    expect(title.required).toBe(true);
    expect(form.getAttribute("data-chq-cfp-step")).toBe("all");
  });

  it("a document without window.matchMedia disengages entirely (house convention: missing matchMedia -> not phone)", async () => {
    const js = await stepScriptJs();
    const dom = new JSDOM(markup(js), {
      url: "https://example.test/submit/test-conf",
      runScripts: "dangerously",
    });
    const scrollSpy = vi.fn();
    dom.window.HTMLElement.prototype.scrollIntoView = scrollSpy;
    // jsdom does not implement matchMedia by default -- leave it absent.
    expect((dom.window as unknown as { matchMedia?: unknown }).matchMedia).toBeUndefined();
    const document = dom.window.document;
    if (document.readyState === "loading") {
      await new Promise<void>((resolve) => document.addEventListener("DOMContentLoaded", () => resolve()));
    }
    const form = document.getElementById("chq-cfp-submit-form")!;
    const email = document.querySelector('[name="f_email"]') as HTMLInputElement;
    expect(form.getAttribute("data-chq-cfp-step")).toBe("all");
    expect(email.required).toBe(true);
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("source contains no second matchMedia constant -- the same '(max-width: 700px)' string the stylesheet declares", async () => {
    const js = await stepScriptJs();
    expect(js).toContain("matchMedia('(max-width: 700px)')");
    expect(js).toContain("mql.addEventListener('change'");
  });
});
