// DEC-617: this test loads and EXECUTES public/embed.js itself (via jsdom,
// with a fake resource loader mapping /embed.js -> the real file bytes) --
// no TypeScript reimplementation of the <chq-embed> rules. It runs the file
// as if it were actually loaded by a page at a given origin, so
// document.currentScript.src is real, and asserts each of the hardening
// axes named in DEC-617: foreign-origin src refusal (visible link, never a
// blank box), and a resize message honored only when origin, source window
// AND instance id all match, with height always clamped to [160, 4000].
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { JSDOM, ResourceLoader, VirtualConsole } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EMBED_JS_PATH = path.resolve(__dirname, "../public/embed.js");
const EMBED_JS_SOURCE = readFileSync(EMBED_JS_PATH, "utf-8");

const HOST_ORIGIN = "https://host.example";
const EMBED_ORIGIN = "https://embed.example"; // the script's own origin
const FOREIGN_ORIGIN = "https://evil.example";

class FakeResourceLoader extends ResourceLoader {
  fetch(url: string, options?: Record<string, unknown>) {
    if (url === `${EMBED_ORIGIN}/embed.js`) {
      return Promise.resolve(Buffer.from(EMBED_JS_SOURCE, "utf-8"));
    }
    return super.fetch(url, options);
  }
}

/** Builds a jsdom document at HOST_ORIGIN that loads embed.js from
 * EMBED_ORIGIN via a real <script src>, so document.currentScript.src (and
 * thus the script's own computed origin) is EMBED_ORIGIN, distinct from the
 * page's own HOST_ORIGIN — exactly the real-world embedding shape. */
async function makeDom(): Promise<JSDOM> {
  // The iframes this test creates point at a fake origin that isn't actually
  // reachable -- jsdom logs (harmless) "could not load iframe" resource
  // errors for that, which a silent VirtualConsole here keeps out of the
  // test output without affecting contentWindow, which jsdom still creates.
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(
    `<!doctype html><html><body><script src="${EMBED_ORIGIN}/embed.js"></script></body></html>`,
    {
      url: `${HOST_ORIGIN}/page`,
      runScripts: "dangerously",
      resources: new FakeResourceLoader(),
      pretendToBeVisual: true,
      virtualConsole,
    },
  );
  await new Promise<void>((resolve, reject) => {
    dom.window.addEventListener("load", () => resolve());
    dom.window.addEventListener("error", (e: unknown) => reject(e));
    setTimeout(() => reject(new Error("timed out waiting for embed.js to load")), 5000);
  });
  return dom;
}

function appendEmbed(dom: JSDOM, attrs: Record<string, string>): Element {
  const doc = dom.window.document;
  const el = doc.createElement("chq-embed");
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  doc.body.appendChild(el);
  return el;
}

describe("chq-embed (public/embed.js, executed in jsdom)", () => {
  it("refuses a foreign-origin src and renders a visible link, never a blank box", async () => {
    const dom = await makeDom();
    const el = appendEmbed(dom, { src: `${FOREIGN_ORIGIN}/embed/some-event/sessions` });
    expect(el.querySelector("iframe")).toBeNull();
    const link = el.querySelector("a.chq-embed-refused");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe(`${FOREIGN_ORIGIN}/embed/some-event/sessions`);
    expect(link!.textContent).toContain(FOREIGN_ORIGIN);
  });

  it("accepts a same-origin src, builds a sandboxed iframe with an embed_id, and starts within [160,4000]", async () => {
    const dom = await makeDom();
    const el = appendEmbed(dom, { src: `${EMBED_ORIGIN}/embed/some-event/sessions` });
    const iframe = el.querySelector("iframe") as HTMLIFrameElement | null;
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute("sandbox")).toBe("allow-scripts");
    expect(iframe!.getAttribute("referrerpolicy")).toBe("strict-origin");
    const src = new URL(iframe!.src);
    expect(src.origin).toBe(EMBED_ORIGIN);
    expect(src.searchParams.get("embed_id")).toBeTruthy();
    const h = parseInt(iframe!.style.height, 10);
    expect(h).toBeGreaterThanOrEqual(160);
    expect(h).toBeLessThanOrEqual(4000);
  });

  it("ignores a resize message from the wrong origin", async () => {
    const dom = await makeDom();
    const el = appendEmbed(dom, { src: `${EMBED_ORIGIN}/embed/some-event/sessions`, height: "200" });
    const iframe = el.querySelector("iframe") as HTMLIFrameElement;
    const id = new URL(iframe.src).searchParams.get("embed_id")!;

    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: FOREIGN_ORIGIN,
        source: iframe.contentWindow,
        data: { type: "chq-embed-height", id, height: 900 },
      }),
    );
    expect(iframe.style.height).toBe("200px");
  });

  it("ignores a resize message from the wrong source window", async () => {
    const dom = await makeDom();
    const el = appendEmbed(dom, { src: `${EMBED_ORIGIN}/embed/some-event/sessions`, height: "200" });
    const iframe = el.querySelector("iframe") as HTMLIFrameElement;
    const id = new URL(iframe.src).searchParams.get("embed_id")!;

    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: EMBED_ORIGIN,
        source: dom.window, // wrong source: the top window, not the iframe's contentWindow
        data: { type: "chq-embed-height", id, height: 900 },
      }),
    );
    expect(iframe.style.height).toBe("200px");
  });

  it("ignores a resize message with the wrong instance id", async () => {
    const dom = await makeDom();
    const el = appendEmbed(dom, { src: `${EMBED_ORIGIN}/embed/some-event/sessions`, height: "200" });
    const iframe = el.querySelector("iframe") as HTMLIFrameElement;

    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: EMBED_ORIGIN,
        source: iframe.contentWindow,
        data: { type: "chq-embed-height", id: "some-other-instance-id", height: 900 },
      }),
    );
    expect(iframe.style.height).toBe("200px");
  });

  it("accepts a matching resize message and clamps an oversized height to 4000", async () => {
    const dom = await makeDom();
    const el = appendEmbed(dom, { src: `${EMBED_ORIGIN}/embed/some-event/sessions`, height: "200" });
    const iframe = el.querySelector("iframe") as HTMLIFrameElement;
    const id = new URL(iframe.src).searchParams.get("embed_id")!;

    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: EMBED_ORIGIN,
        source: iframe.contentWindow,
        data: { type: "chq-embed-height", id, height: 99999 },
      }),
    );
    expect(iframe.style.height).toBe("4000px");
  });

  // DEC-719: the iframe is sandboxed with allow-scripts only (no
  // allow-same-origin), so in a real browser the child document runs in an
  // OPAQUE origin and every message it posts arrives with
  // event.origin === "null". jsdom does not model sandbox opaque origins,
  // so these cases exercise that literal string directly rather than
  // relying on jsdom to produce it.
  it("accepts a matching resize message whose origin is the opaque-origin literal \"null\"", async () => {
    const dom = await makeDom();
    const el = appendEmbed(dom, { src: `${EMBED_ORIGIN}/embed/some-event/sessions`, height: "200" });
    const iframe = el.querySelector("iframe") as HTMLIFrameElement;
    const id = new URL(iframe.src).searchParams.get("embed_id")!;

    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: "null",
        source: iframe.contentWindow,
        data: { type: "chq-embed-height", id, height: 900 },
      }),
    );
    expect(iframe.style.height).toBe("900px");
  });

  it("clamps a matching \"null\"-origin resize message to the max height", async () => {
    const dom = await makeDom();
    const el = appendEmbed(dom, { src: `${EMBED_ORIGIN}/embed/some-event/sessions`, height: "200" });
    const iframe = el.querySelector("iframe") as HTMLIFrameElement;
    const id = new URL(iframe.src).searchParams.get("embed_id")!;

    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: "null",
        source: iframe.contentWindow,
        data: { type: "chq-embed-height", id, height: 99999 },
      }),
    );
    expect(iframe.style.height).toBe("4000px");
  });

  it("ignores a \"null\"-origin resize message from the wrong source window", async () => {
    const dom = await makeDom();
    const el = appendEmbed(dom, { src: `${EMBED_ORIGIN}/embed/some-event/sessions`, height: "200" });
    const iframe = el.querySelector("iframe") as HTMLIFrameElement;
    const id = new URL(iframe.src).searchParams.get("embed_id")!;

    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: "null",
        source: dom.window, // wrong source: the top window, not the iframe's contentWindow
        data: { type: "chq-embed-height", id, height: 900 },
      }),
    );
    expect(iframe.style.height).toBe("200px");
  });

  it("ignores a \"null\"-origin resize message with the wrong instance id", async () => {
    const dom = await makeDom();
    const el = appendEmbed(dom, { src: `${EMBED_ORIGIN}/embed/some-event/sessions`, height: "200" });
    const iframe = el.querySelector("iframe") as HTMLIFrameElement;

    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: "null",
        source: iframe.contentWindow,
        data: { type: "chq-embed-height", id: "some-other-instance-id", height: 900 },
      }),
    );
    expect(iframe.style.height).toBe("200px");
  });

  it("ignores a resize message from a foreign real origin even with matching source and id", async () => {
    const dom = await makeDom();
    const el = appendEmbed(dom, { src: `${EMBED_ORIGIN}/embed/some-event/sessions`, height: "200" });
    const iframe = el.querySelector("iframe") as HTMLIFrameElement;
    const id = new URL(iframe.src).searchParams.get("embed_id")!;

    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: FOREIGN_ORIGIN,
        source: iframe.contentWindow,
        data: { type: "chq-embed-height", id, height: 900 },
      }),
    );
    expect(iframe.style.height).toBe("200px");
  });
});
