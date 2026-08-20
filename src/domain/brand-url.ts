// Brand logo URL sanitization (DEC-322 wave-30 amendment). Pure module per
// DEC-002 — Web APIs only, no node:/cloudflare imports.
//
// Contract for safeImageSrc: trims whitespace; blank input -> null. An
// absolute URL parses via `new URL` and is returned (as url.href) only for
// http: or https: protocols. A ROOT-RELATIVE same-origin path is also
// allowed and returned as-is, but only when it starts with a single '/' and
// NOT '//' (a leading '//' is protocol-relative — it resolves against
// whatever origin the browser is on, which is exactly the ambiguity DEC-322
// exists to close — so it is refused) and contains no control characters.
// Everything else (javascript:, data:, mailto:, a bare non-URL string like
// 'notaurl', or a protocol-relative '//evil.example/x') -> null.
//
// This is a SIBLING of safeExternalUrl (src/domain/contacts-parts/types.ts
// `export function safeExternalUrl`), not a reuse of it, because the two
// call sites have opposite
// requirements for relative input: safeExternalUrl is an href allowlist for
// third-party social links, where a bare relative path is meaningless (a
// contact's "website" is never same-origin with the app) and MUST be
// rejected; safeImageSrc backs a self-hosted branding <img src>, where a
// root-relative path (e.g. a locally uploaded logo served from this app's
// own origin, `/files/logo.png`) is the common, legitimate case and must be
// ACCEPTED. Folding both cases into one function would force one of the two
// call sites to carry a footgun flag; two small functions with disjoint
// contracts are clearer and each stays independently testable.
export function safeImageSrc(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return null;

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f]/.test(trimmed)) return null;
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.href;
    }
    return null;
  } catch {
    return null;
  }
}
