// DEC-617: hardened <chq-embed> custom element, served as a plain static
// asset at /embed.js from our own origin. This is the one piece of our code
// that runs on somebody else's page, so every axis below is validated
// rather than trusted:
//   - `src` must be same-origin as THIS SCRIPT's own origin (never the host
//     page's origin) -- a foreign src is refused and rendered as a visible
//     link, never a blank box.
//   - the iframe is sandboxed (allow-scripts only, no allow-same-origin) and
//     sent with referrerpolicy="strict-origin"; per DEC-617 the sandbox is
//     kept, which means the child document runs in an OPAQUE origin and
//     every message it posts arrives with event.origin === "null" -- that
//     is expected, not a spoof.
//   - because event.origin can never be trusted to prove identity for a
//     sandboxed child (it is always either our real origin or the literal
//     string "null"), identity instead rests on the axes an attacker in a
//     different window CANNOT forge: event.source must be exactly this
//     instance's own iframe.contentWindow, AND the message payload's `id`
//     must match this instance's per-instance random `embed_id`. Only once
//     both of those match do we additionally require that event.origin be
//     either SCRIPT_ORIGIN or "null" -- any other origin string is refused.
//   - the applied height is always clamped to [MIN_HEIGHT, MAX_HEIGHT].
//
// test/embed-element.test.ts loads and executes THIS file (not a TS
// reimplementation of these rules) in jsdom.
(function () {
  "use strict";

  var MIN_HEIGHT = 160;
  var MAX_HEIGHT = 4000;

  function clampHeight(value) {
    var n = Number(value);
    if (!isFinite(n)) return MIN_HEIGHT;
    if (n < MIN_HEIGHT) return MIN_HEIGHT;
    if (n > MAX_HEIGHT) return MAX_HEIGHT;
    return n;
  }

  function randomId() {
    var rand =
      typeof window.crypto !== "undefined" && window.crypto.getRandomValues
        ? window.crypto.getRandomValues(new Uint32Array(2)).join("")
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    return "chq-embed-" + rand;
  }

  // The script's OWN origin -- read from document.currentScript. Thrown
  // loudly rather than silently trusting the host page's origin if this
  // script was somehow loaded without a discoverable src.
  function scriptOrigin() {
    var script = document.currentScript;
    var src = script && script.src;
    if (!src) {
      throw new Error("chq-embed: /embed.js loaded without a discoverable src; refusing to run");
    }
    return new URL(src).origin;
  }

  var SCRIPT_ORIGIN = scriptOrigin();

  function renderRefused(el, rawSrc) {
    el.textContent = "";
    var a = document.createElement("a");
    a.href = rawSrc || "#";
    a.textContent = rawSrc || "(missing embed src)";
    a.className = "chq-embed-refused";
    a.rel = "noopener noreferrer";
    el.appendChild(a);
  }

  function ChqEmbedElement() {
    return Reflect.construct(HTMLElement, [], ChqEmbedElement);
  }
  ChqEmbedElement.prototype = Object.create(HTMLElement.prototype);
  ChqEmbedElement.prototype.constructor = ChqEmbedElement;

  ChqEmbedElement.prototype.connectedCallback = function () {
    var self = this;
    var rawSrc = this.getAttribute("src") || "";

    var srcOrigin = null;
    try {
      srcOrigin = new URL(rawSrc, window.location.href).origin;
    } catch (e) {
      srcOrigin = null;
    }

    // Refuse any src whose origin differs from THIS SCRIPT's own origin --
    // never a blank box, always a visible link to the (refused) target.
    if (!rawSrc || srcOrigin !== SCRIPT_ORIGIN) {
      renderRefused(this, rawSrc);
      return;
    }

    var id = randomId();
    this._chqId = id;
    this._chqExpectedOrigin = SCRIPT_ORIGIN;

    var url = new URL(rawSrc, window.location.href);
    url.searchParams.set("embed_id", id);

    var explicitHeight = this.getAttribute("height");
    var minHeight = this.getAttribute("min-height");
    var initialHeight = clampHeight(explicitHeight || minHeight || MIN_HEIGHT);

    var iframe = document.createElement("iframe");
    iframe.src = url.toString();
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.setAttribute("referrerpolicy", "strict-origin");
    iframe.setAttribute("loading", "lazy");
    iframe.style.display = "block";
    iframe.style.width = "100%";
    iframe.style.border = "0";
    iframe.style.height = initialHeight + "px";
    iframe.title = this.getAttribute("title") || "Embedded content";

    this.textContent = "";
    this.appendChild(iframe);
    this._chqIframe = iframe;

    this._chqOnMessage = function (event) {
      // Identity rests on the unforgeable axes: the message must come from
      // exactly this instance's own iframe window, carrying exactly this
      // instance's id. Only then do we check origin, and a sandboxed child
      // (no allow-same-origin, DEC-617) posts from an opaque origin --
      // event.origin === "null" -- so that literal string is accepted
      // alongside our real SCRIPT_ORIGIN; any other origin is refused.
      if (!self._chqIframe || event.source !== self._chqIframe.contentWindow) return;
      var data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "chq-embed-height") return;
      if (data.id !== self._chqId) return;
      if (event.origin !== self._chqExpectedOrigin && event.origin !== "null") return;
      self._chqIframe.style.height = clampHeight(data.height) + "px";
    };
    window.addEventListener("message", this._chqOnMessage);
  };

  ChqEmbedElement.prototype.disconnectedCallback = function () {
    if (this._chqOnMessage) {
      window.removeEventListener("message", this._chqOnMessage);
      this._chqOnMessage = null;
    }
  };

  if (!window.customElements.get("chq-embed")) {
    window.customElements.define("chq-embed", ChqEmbedElement);
  }

  // Exposed for the test harness only -- no product code should read this.
  window.__chqEmbedInternals = { clampHeight: clampHeight, MIN_HEIGHT: MIN_HEIGHT, MAX_HEIGHT: MAX_HEIGHT };
})();
