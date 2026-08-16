// EMB-10/11 (DEC-687): mergeItinerarySelection's own body references
// MAX_ITINERARY_IDS as a free identifier. ItineraryScript embeds the
// function via `.toString()`, which carries only the function's SOURCE TEXT
// -- never a closed-over module-level const -- so unless MAX_ITINERARY_IDS
// is *also* emitted into the same IIFE, every real browser throws
// ReferenceError inside the change handler before localStorage.setItem ever
// runs, and no itinerary pick ever persists (ScheduleContent's own copy
// claims "Your picks are saved in this browser and survive a reload").
//
// This is provable ONLY by EXECUTING the emitted script text in a DOM, never
// by testing the TS in isolation -- a TS-level unit test of
// mergeItinerarySelection alone (see itinerary-merge.test.ts) is green even
// when the emitted <script> is broken, because the TS module scope still
// has MAX_ITINERARY_IDS in closure. Only the .toString()-extracted, then
// actually-run copy exposes the gap.

import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { ItineraryScript } from "../src/routes/public/agenda";
import { MAX_ITINERARY_IDS } from "../src/lib/itinerary";

const EVENT_SLUG = "devflow-conf-2027";

function extractScriptBody(): string {
  const html = String(ItineraryScript({ eventSlug: EVENT_SLUG }));
  const match = html.match(/<script[^>]*>([\s\S]*)<\/script>/);
  expect(match).not.toBeNull();
  return match![1] as string;
}

function makeDom(): JSDOM {
  return new JSDOM(
    `<!doctype html><html><body>
      <input type="checkbox" class="chq-itinerary-toggle" value="sub-a" />
      <input type="checkbox" class="chq-itinerary-toggle" value="sub-b" />
      <a id="chq-ics-link" href="#"></a>
      <span id="chq-ics-count"></span>
    </body></html>`,
    { url: "https://example.test/e/devflow-conf-2027/schedule", runScripts: "dangerously" },
  );
}

function runScript(dom: JSDOM, body: string): void {
  const script = dom.window.document.createElement("script");
  script.textContent = body;
  dom.window.document.body.appendChild(script);
}

describe("ItineraryScript emitted body: helper identifiers are all defined (EMB-10/11)", () => {
  it("defines __chqMerge, __chqMirror, and MAX_ITINERARY_IDS in the same IIFE that references them", () => {
    const body = extractScriptBody();
    expect(body).toContain("var MAX_ITINERARY_IDS = " + MAX_ITINERARY_IDS + ";");
    expect(body).toContain("var __chqMerge");
    expect(body).toContain("var __chqMirror");
    // every helper identifier the body REFERENCES must also be DEFINED in it
    for (const identifier of ["__chqMerge", "__chqMirror", "MAX_ITINERARY_IDS"]) {
      const usages = body.split(identifier).length - 1;
      expect(usages).toBeGreaterThan(1); // referenced beyond its own `var` definition
      expect(body).toMatch(new RegExp(`var ${identifier}\\b`));
    }
  });
});

describe("ItineraryScript emitted body: EXECUTED in jsdom (EMB-10/11)", () => {
  it("toggling a checkbox persists to localStorage without throwing, and survives across a re-run", () => {
    const body = extractScriptBody();
    const dom = makeDom();
    const errors: unknown[] = [];
    dom.window.addEventListener("error", (e: unknown) => errors.push(e));

    // First run: hydrates from empty storage, wires the change listener.
    runScript(dom, body);
    expect(errors).toEqual([]);

    const boxA = dom.window.document.querySelectorAll(".chq-itinerary-toggle")[0] as HTMLInputElement;
    expect(boxA.checked).toBe(false);

    boxA.checked = true;
    boxA.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

    expect(errors).toEqual([]);

    const key = `chq_itinerary_${EVENT_SLUG}`;
    const stored = JSON.parse(dom.window.localStorage.getItem(key) ?? "[]");
    expect(stored).toContain("sub-a");

    const link = dom.window.document.getElementById("chq-ics-link") as HTMLAnchorElement;
    const count = dom.window.document.getElementById("chq-ics-count") as HTMLElement;
    expect(link.getAttribute("href")).toContain("sub-a");
    expect(count.textContent).toBe("1"); // G13: the span carries the count alone (caption text lives in the SSR markup)

    // Re-running the emitted script (as a fresh page load would) must
    // rehydrate the checkbox as checked from the SAME localStorage key and
    // update the .ics href to match, with no exception.
    const dom2 = makeDom();
    dom2.window.localStorage.setItem(key, dom.window.localStorage.getItem(key)!);
    const errors2: unknown[] = [];
    dom2.window.addEventListener("error", (e: unknown) => errors2.push(e));
    runScript(dom2, body);
    expect(errors2).toEqual([]);

    const boxA2 = dom2.window.document.querySelectorAll(".chq-itinerary-toggle")[0] as HTMLInputElement;
    expect(boxA2.checked).toBe(true);
    const link2 = dom2.window.document.getElementById("chq-ics-link") as HTMLAnchorElement;
    expect(link2.getAttribute("href")).toContain("sub-a");
  });
});
