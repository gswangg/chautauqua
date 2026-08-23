// DEC-069 wave-116+ campaign exit predicate: OUT_OF_CAMPAIGN_SCOPE partial
// registry (custodian decomposition of
// scripts/exit-predicate/campaign-scope/out-of-campaign-scope.ts -- NO
// behavior change; see that file's header for why it split, and
// scripts/exit-predicate/campaign-scope.ts's header for the top-level
// barrel this nests under).
//
// Entries whose reason is a server-side REQUEST/RESPONSE ROBUSTNESS or
// SECURITY fact, not a v12 frame or 390-geometry conformance fact.
//
// Merged into the full OUT_OF_CAMPAIGN_SCOPE map by
// out-of-campaign-scope.ts alongside its siblings below; nothing outside
// this directory imports SECURITY_REQUEST_HYGIENE_OUT_OF_SCOPE directly.
export const SECURITY_REQUEST_HYGIENE_OUT_OF_SCOPE: Record<string, string> = {
  RAW_JSON_BODY_DOOR_CEILING:
    "measures how many src/routes/** handlers still read a request body through the raw Hono "
    + "`c.req.json(` API instead of src/server/http.ts's readJsonBody/readOptionalJsonBody, which "
    + "refuse a literal `null` body with the house 400 `invalid` envelope rather than crashing the "
    + "next dereference into an unhandled 500 -- a server-side request-parsing robustness fact "
    + "about a route's error envelope, not itself a v12 frame or 390-geometry conformance fact "
    + "(test/json-body-door.scan.test.ts, DEC-613 wave-23 amendment).",
  MINT_DOOR_UNCAPPED_CEILING:
    "measures how many mint doors (route handlers that insert a new domain row) reference no "
    + "batch/count MAX_* bound in their own handler body or named repo/** insert function, and "
    + "carry no `mint-cap-exempt:` comment -- a server-side write-door robustness fact about "
    + "whether a mint can be flooded with unbounded rows, not itself a v12 frame or 390-geometry "
    + "conformance fact (test/mint-door-cap-census.scan.test.ts, DEC-180 wave-23 amendment).",

  DECLARED_CONTENT_TYPE_NOSNIFF_GAP_CEILING:
    "measures whether every stored-user-content response (GET /files/:fileId, the bulk ZIP archive "
    + "route, GET /headshots/:fileId, and any future handler streaming a makeFileStore(...).get(...) "
    + "body) also sets the X-Content-Type-Options: nosniff header -- a SECURITY fact about whether a "
    + "browser can sniff an uploaded file's bytes into a different content type than the server "
    + "declared, not a v12 frame or 390-geometry conformance fact about any drawn screen "
    + "(test/user-content-nosniff.test.ts, DEC-551 wave-51 amendment).",

};
