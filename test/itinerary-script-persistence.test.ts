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
  it("defines mergeItinerarySelection, mirrorItineraryCheckboxes, applyItineraryToggle, assertValidMinute, and MAX_ITINERARY_IDS in the same IIFE that references them", () => {
    const body = extractScriptBody();
    expect(body).toContain("var MAX_ITINERARY_IDS = " + MAX_ITINERARY_IDS + ";");
    expect(body).toContain("var mergeItinerarySelection");
    expect(body).toContain("var mirrorItineraryCheckboxes");
    expect(body).toContain("var applyItineraryToggle");
    expect(body).toContain("var assertValidMinute");
    // every helper identifier the body REFERENCES must also be DEFINED in it
    for (const identifier of [
      "mergeItinerarySelection",
      "mirrorItineraryCheckboxes",
      "applyItineraryToggle",
      "assertValidMinute",
      "MAX_ITINERARY_IDS",
    ]) {
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

// w29-c: public /schedule Remove-control persistence race (Cut-4 eval
// triage, docs/mobile-campaign.md, DEC-555 wave-29 amendment).
//
// ROOT CAUSE (verified below, not paraphrased from the mandate): the
// overlaps feature's `applyScheduleView()` calls `__chqClock` (the embedded
// copy of `clockHMM`) on every SAVED row that clashes with another saved
// row. `clockHMM`'s own SOURCE TEXT calls `assertValidMinute` as a free
// identifier (src/domain/clock.ts) -- exactly the EMB-10/11 hazard this
// file's own comment already documents for `mergeItinerarySelection` and
// `MAX_ITINERARY_IDS`, just missed for `clockHMM`'s transitive dependency.
// `assertValidMinute` is never embedded into the IIFE, so the FIRST time a
// visitor has two time-overlapping saved sessions (an ordinary, common
// state -- it's the whole reason the overlaps panel exists), the initial
// `applyScheduleView()` call at page load throws `ReferenceError:
// assertValidMinute is not defined` SYNCHRONOUSLY, before
// `document.addEventListener('change', ...)` -- the last line of the IIFE
// -- ever executes. The checkbox still flips visually on click (that's
// native browser behavior, no JS required), but no listener exists to ever
// call `localStorage.setItem`, so NOTHING persists. Reproduced directly
// below; this is fixed by embedding `assertValidMinute` the same way as
// every other helper.
describe("ItineraryScript: overlapping saved sessions crash init and silently disable Remove entirely (w29-c root cause)", () => {
  it("two saved, time-overlapping /schedule rows throw ReferenceError: assertValidMinute during the FIRST applyScheduleView() call", () => {
    const body = extractScriptBody();
    const key = `chq_itinerary_${EVENT_SLUG}`;
    const dom = new JSDOM(
      `<!doctype html><html><body>
      <div class="chq-pub-schedule-row" data-submission-id="sub-a" data-day="2027-05-01" data-start-min="60" data-end-min="120">
        <div class="chq-pub-schedule-row-body">
          <a class="chq-pub-schedule-row-title">Talk A</a>
          <span class="chq-pub-schedule-row-clash" hidden></span>
        </div>
        <label class="chq-pub-schedule-remove">
          <input type="checkbox" class="chq-itinerary-toggle" value="sub-a" />
          <span>Remove</span>
        </label>
      </div>
      <div class="chq-pub-schedule-row" data-submission-id="sub-b" data-day="2027-05-01" data-start-min="90" data-end-min="150">
        <div class="chq-pub-schedule-row-body">
          <a class="chq-pub-schedule-row-title">Talk B</a>
          <span class="chq-pub-schedule-row-clash" hidden></span>
        </div>
        <label class="chq-pub-schedule-remove">
          <input type="checkbox" class="chq-itinerary-toggle" value="sub-b" />
          <span>Remove</span>
        </label>
      </div>
      <span id="chq-schedule-subtitle"></span>
      <div id="chq-schedule-empty" hidden></div>
      <section id="chq-schedule-overlaps-section" hidden>
        <h2 id="chq-schedule-overlaps-heading"></h2>
        <div id="chq-schedule-overlaps-body"></div>
      </section>
      <a id="chq-ics-link" href="#"></a>
      <span id="chq-ics-count"></span>
      </body></html>`,
      { url: "https://example.test/e/devflow-conf-2027/schedule", runScripts: "dangerously" },
    );
    dom.window.localStorage.setItem(key, JSON.stringify(["sub-a", "sub-b"]));

    const errors: unknown[] = [];
    dom.window.addEventListener("error", (e: unknown) => errors.push(e));
    runScript(dom, body);

    // With the bug present, init throws and the change listener is never
    // attached -- clicking Remove flips the checkbox (native browser
    // behavior) but writes nothing. With the fix, init completes cleanly
    // AND the removal actually persists.
    expect(errors).toEqual([]); // fails pre-fix: ReferenceError: assertValidMinute is not defined

    const boxA = dom.window.document.querySelector('.chq-itinerary-toggle[value="sub-a"]') as HTMLInputElement;
    boxA.checked = false;
    boxA.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

    const storedAfter = JSON.parse(dom.window.localStorage.getItem(key) ?? "[]");
    expect(storedAfter).not.toContain("sub-a"); // fails pre-fix: listener was never registered, storage never changes
    expect(storedAfter).toContain("sub-b");
  });
});
function makeScheduleDom(key: string, stored: string[]): JSDOM {
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <div class="chq-pub-schedule-row" data-submission-id="sub-a" data-day="2027-05-01" data-start-min="60" data-end-min="120">
        <div class="chq-pub-schedule-row-body">
          <a class="chq-pub-schedule-row-title">Talk A</a>
          <span class="chq-pub-schedule-row-clash" hidden></span>
        </div>
        <label class="chq-pub-schedule-remove">
          <input type="checkbox" class="chq-itinerary-toggle" value="sub-a" />
          <span>Remove</span>
        </label>
      </div>
      <div class="chq-pub-schedule-row" data-submission-id="sub-b" data-day="2027-05-01" data-start-min="180" data-end-min="240">
        <div class="chq-pub-schedule-row-body">
          <a class="chq-pub-schedule-row-title">Talk B</a>
          <span class="chq-pub-schedule-row-clash" hidden></span>
        </div>
        <label class="chq-pub-schedule-remove">
          <input type="checkbox" class="chq-itinerary-toggle" value="sub-b" />
          <span>Remove</span>
        </label>
      </div>
      <span id="chq-schedule-subtitle"></span>
      <div id="chq-schedule-empty" hidden></div>
      <section id="chq-schedule-overlaps-section" hidden>
        <h2 id="chq-schedule-overlaps-heading"></h2>
        <div id="chq-schedule-overlaps-body"></div>
      </section>
      <a id="chq-ics-link" href="#"></a>
      <span id="chq-ics-count"></span>
    </body></html>`,
    { url: "https://example.test/e/devflow-conf-2027/schedule", runScripts: "dangerously" },
  );
  dom.window.localStorage.setItem(key, JSON.stringify(stored));
  return dom;
}

describe("ItineraryScript: public /schedule Remove control persistence (w29-c)", () => {
  it("remove-then-reload: unchecking Remove on one saved row persists across a fresh page load", () => {
    const body = extractScriptBody();
    const key = `chq_itinerary_${EVENT_SLUG}`;
    const dom = makeScheduleDom(key, ["sub-a", "sub-b"]);
    const errors: unknown[] = [];
    dom.window.addEventListener("error", (e: unknown) => errors.push(e));

    runScript(dom, body);
    expect(errors).toEqual([]);

    const boxA = dom.window.document.querySelector('.chq-itinerary-toggle[value="sub-a"]') as HTMLInputElement;
    expect(boxA.checked).toBe(true);

    // Click "Remove" on sub-a: browser flips checked to false, THEN fires change.
    boxA.checked = false;
    boxA.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    expect(errors).toEqual([]);

    const storedAfterRemove = JSON.parse(dom.window.localStorage.getItem(key) ?? "[]");
    expect(storedAfterRemove).not.toContain("sub-a");
    expect(storedAfterRemove).toContain("sub-b");

    // Fresh page load (new script execution against the SAME storage) must
    // reflect the removal: sub-a's box comes back unchecked.
    const dom2 = makeScheduleDom(key, []);
    dom2.window.localStorage.setItem(key, dom.window.localStorage.getItem(key)!);
    const errors2: unknown[] = [];
    dom2.window.addEventListener("error", (e: unknown) => errors2.push(e));
    runScript(dom2, body);
    expect(errors2).toEqual([]);

    const boxA2 = dom2.window.document.querySelector('.chq-itinerary-toggle[value="sub-a"]') as HTMLInputElement;
    const boxB2 = dom2.window.document.querySelector('.chq-itinerary-toggle[value="sub-b"]') as HTMLInputElement;
    expect(boxA2.checked).toBe(false);
    expect(boxB2.checked).toBe(true);

    // The row itself must also be hidden post-reload (applyScheduleView ran
    // off the same snapshot the persisted list reflects).
    const rowA2 = dom2.window.document.querySelector('.chq-pub-schedule-row[data-submission-id="sub-a"]') as HTMLElement;
    expect(rowA2.style.display).toBe("none");
  });

  it("rapid toggle-toggle-reload: two change events fired back-to-back on different rows both persist", () => {
    const body = extractScriptBody();
    const key = `chq_itinerary_${EVENT_SLUG}`;
    const dom = makeScheduleDom(key, ["sub-a", "sub-b"]);
    const errors: unknown[] = [];
    dom.window.addEventListener("error", (e: unknown) => errors.push(e));

    runScript(dom, body);

    const boxA = dom.window.document.querySelector('.chq-itinerary-toggle[value="sub-a"]') as HTMLInputElement;
    const boxB = dom.window.document.querySelector('.chq-itinerary-toggle[value="sub-b"]') as HTMLInputElement;

    // Fire both change events back-to-back, no yield to the event loop
    // between them (this is the "concurrent write" shape the mandate names).
    boxA.checked = false;
    boxA.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    boxB.checked = false;
    boxB.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    expect(errors).toEqual([]);

    const storedAfter = JSON.parse(dom.window.localStorage.getItem(key) ?? "[]");
    expect(storedAfter).not.toContain("sub-a");
    expect(storedAfter).not.toContain("sub-b");

    const dom2 = makeScheduleDom(key, []);
    dom2.window.localStorage.setItem(key, dom.window.localStorage.getItem(key)!);
    runScript(dom2, body);
    const boxA2 = dom2.window.document.querySelector('.chq-itinerary-toggle[value="sub-a"]') as HTMLInputElement;
    const boxB2 = dom2.window.document.querySelector('.chq-itinerary-toggle[value="sub-b"]') as HTMLInputElement;
    expect(boxA2.checked).toBe(false);
    expect(boxB2.checked).toBe(false);
  });

  // ROOT CAUSE (DEC-903: verified, not paraphrased from the mandate): a plain
  // single-tab remove does NOT reproduce a failure -- the merge/mirror math
  // is correct for that case. The real divergence is the write path reading
  // DOM state at THREE different moments (docs/mobile-campaign.md Cut-4
  // triage / task description): the change handler's `currentIds()` feeds
  // `mergeItinerarySelection`, whose own cap (`slice(0, MAX_ITINERARY_IDS)`)
  // can silently drop ids from the END of the merged list on ANY write once
  // stored+rendered exceeds the cap -- but `applyScheduleView()` immediately
  // re-reads `currentIds()` from the SAME raw DOM a second time, so it never
  // learns which ids the cap actually dropped. A row whose id got dropped by
  // the cap keeps showing checked/saved (still ticked in the DOM) even
  // though it no longer persists -- exactly the filed shape ("toggles
  // visually but the removal does not persist") except the item silently
  // un-persisted is a NEIGHBOR of whatever the user actually touched, not
  // the touched row itself. This is provable without 300 real rows: 10
  // off-page "kept" ids (stored, not rendered on this page -- the normal
  // day-filtered-page shape mergeItinerarySelection's own docstring
  // describes) plus 295 rendered+checked rows pushes the post-remove total
  // to 304, over the 300 cap.
  it("cap divergence: a write that trims mergeItinerarySelection's cap leaves an untouched row checked in the DOM after it was silently dropped from storage", () => {
    const body = extractScriptBody();
    const key = `chq_itinerary_${EVENT_SLUG}`;
    const renderedCount = 295;
    const keptCount = 10; // off-page picks from another day/page, not rendered here
    const renderedIds = Array.from({ length: renderedCount }, (_, i) => `rendered-${i}`);
    const keptIds = Array.from({ length: keptCount }, (_, i) => `kept-${i}`);
    const stored = [...keptIds, ...renderedIds]; // everything currently saved

    const rowsHtml = renderedIds
      .map(
        (id) => `
      <div class="chq-pub-schedule-row" data-submission-id="${id}" data-day="2027-05-01" data-start-min="60" data-end-min="120">
        <div class="chq-pub-schedule-row-body">
          <a class="chq-pub-schedule-row-title">Talk ${id}</a>
          <span class="chq-pub-schedule-row-clash" hidden></span>
        </div>
        <label class="chq-pub-schedule-remove">
          <input type="checkbox" class="chq-itinerary-toggle" value="${id}" />
          <span>Remove</span>
        </label>
      </div>`,
      )
      .join("");
    const dom = new JSDOM(
      `<!doctype html><html><body>${rowsHtml}
      <span id="chq-schedule-subtitle"></span>
      <div id="chq-schedule-empty" hidden></div>
      <section id="chq-schedule-overlaps-section" hidden>
        <h2 id="chq-schedule-overlaps-heading"></h2>
        <div id="chq-schedule-overlaps-body"></div>
      </section>
      <a id="chq-ics-link" href="#"></a>
      <span id="chq-ics-count"></span>
      </body></html>`,
      { url: "https://example.test/e/devflow-conf-2027/schedule", runScripts: "dangerously" },
    );
    dom.window.localStorage.setItem(key, JSON.stringify(stored));

    const errors: unknown[] = [];
    dom.window.addEventListener("error", (e: unknown) => errors.push(e));
    runScript(dom, body);
    expect(errors).toEqual([]);

    // Remove ONE rendered row (a plain, ordinary Remove click) -- this is
    // the ONLY row the user interacts with.
    const removed = renderedIds[0]!;
    const untouchedTail = renderedIds[renderedIds.length - 1]!; // last in DOM order, first to be cap-dropped
    const boxRemoved = dom.window.document.querySelector(`.chq-itinerary-toggle[value="${removed}"]`) as HTMLInputElement;
    boxRemoved.checked = false;
    boxRemoved.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    expect(errors).toEqual([]);

    const storedAfter: string[] = JSON.parse(dom.window.localStorage.getItem(key) ?? "[]");
    expect(storedAfter.length).toBeLessThanOrEqual(MAX_ITINERARY_IDS);
    expect(storedAfter).not.toContain(removed); // the id the user actually removed

    const boxUntouched = dom.window.document.querySelector(`.chq-itinerary-toggle[value="${untouchedTail}"]`) as HTMLInputElement;
    const untouchedPersisted = storedAfter.includes(untouchedTail);
    // THE BUG: the untouched row's checkbox and the actual persisted set
    // disagree -- the DOM still shows it checked/saved even on rows the cap
    // silently dropped, because applyScheduleView() re-derives its view from
    // a second raw DOM read instead of the write's own returned list.
    expect(boxUntouched.checked).toBe(untouchedPersisted);
  });
});
