// PUBLIC SSR — the three "Submitted" 390 confirmation states (task w30-a,
// DEC-976 wave-30 amendment, DEC-385 wave-30 amendment).
//
// docs/design/audit/public-390-verdicts-v12.md already carries a §4-6
// "MATCHES" verdict for these three frames, but that verdict is a CLAIM,
// not a receipt (field-guide: "a scribe amendment/ledger row is a CLAIM
// not a receipt"). Re-measured fresh here against the real route: §5's
// "MATCHES ... the body sentence names the password-setup mechanism" does
// NOT hold -- submit-views.tsx renders one generic confirmation-body
// sentence for all three states (see the DIVERGES test below and
// docs/design/audit/public-submitted-390-v12.md for the full writeup).
//
// This file dispatches a REAL request through a Hono app with the actual
// route module mounted -- never a string scan -- reusing the exact
// buildApp/submitFakeDb/submitSelectQueue/postSubmit harness
// test/public-390-frame-verdicts.test.ts already established (itself
// copied from test/submit-name-collapse.test.ts), per DEC-613 (never a
// sixth reimplementation of the same mock stack).
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import { CFP_CSS } from "../src/routes/public/cfp.css";
import type { AppEnv } from "../src/server/env";
import type { R2Bucket } from "@cloudflare/workers-types";
import { DEC_976, DEC_385 } from "../src/decisions";

// DEC-976 wave-30 amendment (src/decisions-data/part4.ts): "a phone-frame
// verdict grades the frame's DRAWN COPY, enumerated from its own extent --
// a citation count is not a coverage measure". DEC-385 wave-30 amendment
// (src/decisions-data/part2.ts): "a verdict lane may land its own fix only
// inside files it exclusively owns this wave; on a stylesheet another
// in-flight lane owns it files a DIVERGES row instead" -- void-referenced
// so the dependency is compile-checked (src/decisions.ts).
void DEC_976;
void DEC_385;

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");
const DESIGN_FILE = join(REPO_ROOT, "docs", "design", "Chautauqua Public and Portal.dc.html");

/** DEC-967 shape: read the ACTUAL frame line and assert it byte-for-byte
 * matches the literal this file claims. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, "utf-8").split("\n");
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

// ---------------------------------------------------------------------------
// Harness (copied verbatim from test/public-390-frame-verdicts.test.ts's
// submit harness, itself copied from test/submit-name-collapse.test.ts).
// ---------------------------------------------------------------------------

const SUBMIT_EVENT_ROW = {
  id: "event-1",
  orgId: "org-1",
  name: "DevFlow Conf 2027",
  slug: "test-conf",
  recordPrefix: "SES",
  timezone: "UTC",
  brandingJson: null,
};

const SUBMIT_FORM_ROW = {
  id: "form-1",
  eventId: "event-1",
  title: "Speak at DevFlow Conf 2027",
  description: null,
  isDefault: true,
  openDate: null,
  closeDate: null,
  tracksJson: null,
};

const SUBMIT_TRACK_ROW = { id: "track-1", name: "Platform & Infra" };

const SUBMIT_FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "description", section: "session", kind: "long_text", label: "Description", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
  {
    id: "field_session_format",
    role: "session_format",
    section: "session",
    kind: "dropdown",
    label: "Session format",
    helpText: null,
    required: true,
    position: 2,
    optionsJson: JSON.stringify(["Talk (30 min)", "Talk (45 min)", "Workshop"]),
    ruleJson: null,
  },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 3, optionsJson: null, ruleJson: null },
  { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 4, optionsJson: null, ruleJson: null },
  { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 5, optionsJson: null, ruleJson: null },
];

function submitMakeChain(rows: unknown[]) {
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

function submitFakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const inserts: any[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return submitMakeChain(rows);
    },
    insert: () => ({
      values: (vals: unknown) => {
        inserts.push(vals);
        return {
          then: (resolve: (v: undefined) => void) => resolve(undefined),
          onConflictDoUpdate: () => ({
            returning: async () => [{ count: 1 }],
            then: (resolve: (v: undefined) => void) => resolve(undefined),
          }),
        };
      },
    }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
    delete: () => ({ where: async () => {} }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts };
}

function submitFakeKv() {
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

function fakeFilesBucket(): R2Bucket {
  return {
    async put() {},
    async get() {
      return null;
    },
    async delete() {},
  } as unknown as R2Bucket;
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

const CSRF_TOKEN = "test-csrf-token";
const SUBMIT_BINDINGS = {
  MAIL_FROM_EMAIL: "noreply@example.com",
  MAIL_FROM_NAME: "Chautauqua",
  DEV_MODE: "1",
} as unknown as AppEnv["Bindings"];

/** select-queue order per submit-post.tsx's own documenting comment:
 * getEventBySlug, getDefaultForm, getFormFields, getEventTracks,
 * findContactByEmail, nextSubmissionSeq (inside createSubmission),
 * findAccountUserId. */
function submitSelectQueue(opts: {
  existingContact?: { id: string; title: string | null; company: string | null; bio: string | null } | null;
  accountUser?: { id: string; contactId: string | null; email: string } | null;
}): unknown[][] {
  return [
    [SUBMIT_EVENT_ROW],
    [SUBMIT_FORM_ROW],
    SUBMIT_FIELD_ROWS,
    [SUBMIT_TRACK_ROW],
    opts.existingContact ? [opts.existingContact] : [],
    [{ seq: 48 }],
    opts.accountUser ? [opts.accountUser] : [],
  ];
}

function submitForm(email: string): FormData {
  const form = new FormData();
  form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
  form.set("field__title", "Taming 40-Minute CI: Incremental Builds at Monorepo Scale");
  form.set("field__description", "A talk about CI.");
  form.set("speaker_name", "Priya Raman");
  form.set("field__email", email);
  form.set("field__field_session_format", "Talk (30 min)");
  form.set("trackIds", "track-1");
  return form;
}

async function postSubmit(opts: Parameters<typeof submitSelectQueue>[0], email = "priya@example.com") {
  const { db } = submitFakeDb(submitSelectQueue(opts));
  const app = appWithDb(db);
  const req = new Request("http://local/submit/test-conf", {
    method: "POST",
    headers: { cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}` },
    body: submitForm(email),
  });
  const res = await app.request(req, undefined, {
    ...SUBMIT_BINDINGS,
    KV: submitFakeKv(),
    FILES: fakeFilesBucket(),
  } as unknown as AppEnv["Bindings"]);
  return res;
}

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

describe("PUBLIC SSR Submitted 390 trio -- per-frame verdicts (task w30-a, DEC-976 wave-30 amendment)", () => {
  it("frame :1074 Submitted (fresh) -- MATCHES: flag+title+card(title/meta/speaker)+spam note+password block+tail links", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1084 `<span style="font-size:13px; color:#565A4B; line-height:1.55">If it hasn't arrived, check spam.</span>`
    verbatimLine(1084, `        <span style="font-size:13px; color:#565A4B; line-height:1.55">If it hasn't arrived, check spam.</span>`);
    const res = await postSubmit({});
    expect(res.status).toBe(200);
    const html = await res.text();

    // :1076 "Submitted · DFC-048" eyebrow shape (SUBMITTED · <ref>).
    expect(html).toContain('class="chq-cfp-confirm-flag"');
    expect(html).toMatch(/SUBMITTED[^<]*SES-048/);
    // :1077 title.
    expect(html).toContain("That&#39;s in. Check your email.");
    // :1078-1081 card: title + one meta line + the speaker line (DEC-908
    // rules the third card line is fresh-ONLY) -- two
    // .chq-cfp-confirm-card-meta spans total.
    const card = html.split('class="chq-cfp-confirm-card"')[1]?.split("</div>")[0] ?? "";
    expect(card).toContain("Taming 40-Minute CI");
    const metaSpans = [...card.matchAll(/class="chq-cfp-confirm-card-meta"/g)];
    expect(metaSpans).toHaveLength(2);
    expect(card).toContain("Talk, 30 min");
    expect(card).toContain("Platform &amp; Infra");
    expect(card).toContain("Priya Raman");
    // :1084 "If it hasn't arrived, check spam." (emailDelivered branch).
    expect(html).toContain('class="chq-cfp-confirm-note"');
    expect(html).toContain("If it hasn&#39;t arrived, check spam.");
    // :1085-1088 the bordered claim block: heading + body + primary CTA.
    expect(html).toContain('class="chq-cfp-confirm-password"');
    const passwordBlock = html.split('class="chq-cfp-confirm-password"')[1]?.split("</div>")[0] ?? "";
    expect(passwordBlock).toContain("Set a password now");
    expect(passwordBlock).toContain("Then you can track this talk without waiting for the email.");
    expect(passwordBlock).toContain("Create a password");
    expect(passwordBlock).toMatch(/href="\/claim\//);
    // :1091-1092 the two tail links.
    expect(html).toContain('href="/submit/test-conf"');
    expect(html).toContain("Submit another talk");
    expect(html).toContain('href="/e/test-conf/sessions"');
    expect(html).toContain("Browse the sessions");
  });

  it("frame :1124 Submitted · email already known -- MATCHES: title + exactly ONE meta line (no speaker line), \"Already have a password?\" + \"Log in ›\"", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1134 `<span style="font-size:14px; line-height:1.6; color:#3F4237">Already have a password?</span>`
    verbatimLine(1134, `          <span style="font-size:14px; line-height:1.6; color:#3F4237">Already have a password?</span>`);
    const res = await postSubmit({ existingContact: { id: "contact-1", title: null, company: null, bio: null } }, "dana@example.com");
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain("That&#39;s in. Check your email.");
    // :1129-1130 card: title + exactly ONE meta line -- no speaker/company
    // line in this state (DEC-908: fresh-only).
    const card = html.split('class="chq-cfp-confirm-card"')[1]?.split("</div>")[0] ?? "";
    expect(card).toContain("Taming 40-Minute CI");
    const metaSpans = [...card.matchAll(/class="chq-cfp-confirm-card-meta"/g)];
    expect(metaSpans).toHaveLength(1);
    expect(card).not.toContain("Priya Raman");
    // DEC-098: no /claim/ token rendered on screen for a pre-existing,
    // not-yet-account-holding contact.
    expect(html).not.toContain("/claim/");
    // :1134-1135 "Already have a password?" + exactly one "Log in ›" anchor.
    expect(html).toContain("Already have a password?");
    const loginAnchors = [...html.matchAll(/<a[^>]*href="\/login"/g)];
    expect(loginAnchors).toHaveLength(1);
    expect(html).toMatch(/Log in\s*(?:&rsaquo;|›)/);
  });

  it("frame :1147 Submitted · has an account -- MATCHES: title + exactly ONE meta line, \"You already have an account here.\" + filled \"Log in to track it\" primary", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1157 `<span style="font-size:14px; line-height:1.6; color:#3F4237">You already have an account here.</span>`
    verbatimLine(1157, `          <span style="font-size:14px; line-height:1.6; color:#3F4237">You already have an account here.</span>`);
    const existingContact = { id: "contact-1", title: null, company: null, bio: null };
    const accountUser = { id: "user-1", contactId: "contact-1", email: "marcus@example.com" };
    const res = await postSubmit({ existingContact, accountUser }, "marcus@example.com");
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain("That&#39;s in. Check your email.");
    // :1151-1153 card: title + exactly ONE meta line, no speaker line.
    const card = html.split('class="chq-cfp-confirm-card"')[1]?.split("</div>")[0] ?? "";
    const metaSpans = [...card.matchAll(/class="chq-cfp-confirm-card-meta"/g)];
    expect(metaSpans).toHaveLength(1);
    expect(card).not.toContain("Priya Raman");
    // :1157 the account-holder line, verbatim.
    expect(html).toContain("You already have an account here.");
    // :1158 the filled primary CTA, no /claim/ path minted or rendered.
    expect(html).toMatch(/<a class="chq-btn chq-btn-primary" href="\/login">\s*Log in to track it\s*<\/a>/);
    expect(html).not.toContain("/claim/");
  });

  it("DIVERGES: the frames draw a state-specific confirmation-body sentence; submit-views.tsx renders one generic body for all three states", async () => {
    const freshHtml = await (await postSubmit({})).text();
    const knownHtml = await (
      await postSubmit({ existingContact: { id: "contact-1", title: null, company: null, bio: null } }, "dana@example.com")
    ).text();
    const acctHtml = await (
      await postSubmit(
        { existingContact: { id: "contact-1", title: null, company: null, bio: null }, accountUser: { id: "user-1", contactId: "contact-1", email: "marcus@example.com" } },
        "marcus@example.com",
      )
    ).text();

    // submit-views.tsx:833's ONE generic body, byte-identical across all
    // three states -- never the frames' three distinct sentences
    // ("a portal link ... edit this talk until <date>" / "a confirmation,
    // with a link to set a password" / "a confirmation.").
    const genericBody = (html: string, email: string) =>
      html.includes(`We&#39;ve emailed a confirmation for &quot;Taming 40-Minute CI: Incremental Builds at Monorepo Scale&quot; to ${email}.`);
    expect(genericBody(freshHtml, "priya@example.com")).toBe(true);
    expect(genericBody(knownHtml, "dana@example.com")).toBe(true);
    expect(genericBody(acctHtml, "marcus@example.com")).toBe(true);

    // docs/design/Chautauqua Public and Portal.dc.html:1132 `        <span style="font-size:15px; line-height:1.65; color:#3F4237">We emailed dana@example.com a confirmation, with a link to set a password.</span>`
    verbatimLine(1132, `        <span style="font-size:15px; line-height:1.65; color:#3F4237">We emailed dana@example.com a confirmation, with a link to set a password.</span>`);
    // :1132's own distinct sentence never appears -- the generic body above
    // is what the "email already known" state actually renders.
    expect(knownHtml).not.toContain("a confirmation, with a link to set a password");

    // docs/design/Chautauqua Public and Portal.dc.html:1155 `        <span style="font-size:15px; line-height:1.65; color:#3F4237">We emailed marcus@example.com a confirmation.</span>`
    verbatimLine(1155, `        <span style="font-size:15px; line-height:1.65; color:#3F4237">We emailed marcus@example.com a confirmation.</span>`);
    // :1155's own distinct (bare, no clause) sentence never appears either
    // -- the "has an account" state renders the same generic body too.
    expect(acctHtml).not.toMatch(/We emailed marcus@example\.com a confirmation\.[^,]/);
  });

  it("phone (max-width:700px terminal block) governs .chq-cfp-confirm / -card / -actions / -password geometry the frames require", () => {
    const mediaStart = CFP_CSS.indexOf("@media (max-width: 700px)");
    expect(mediaStart).toBeGreaterThan(-1);
    const phoneBlock = CFP_CSS.slice(mediaStart);

    // :1084 confirmation h1 register (27px/1.08), shared byte-identically
    // across all three Submitted frames (:1077/:1127/:1150).
    expect(phoneBlock).toContain(".chq-cfp-confirm h1 { font-size: 27px; line-height: 1.08; }");
    // :1085-1088 the bordered claim block's phone geometry.
    expect(phoneBlock).toContain(".chq-cfp-confirm-password { display: flex; flex-direction: column; gap: 9px; }");
    expect(phoneBlock).toContain(
      ".chq-cfp-confirm-password-heading { font-family: var(--chq-font-display); font-size: 17px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.3; }",
    );
    expect(phoneBlock).toContain(".chq-cfp-confirm-password-body { font-size: 14px; line-height: 1.6; color: var(--chq-ink-2); }");
    // :1092/:1135/:1158's plain-anchor forward paths get their own 44px
    // floor (min-height + centred flex + horizontal padding, never a bare
    // min-height) -- the DEC-393-flavoured control-floor rule this whole
    // media block exists to carry.
    expect(phoneBlock).toContain(
      ".chq-cfp-links a,\n    .chq-cfp-confirm-actions a:not(.chq-btn) { min-height: 44px; display: inline-flex; align-items: center; padding: 0 2px; }",
    );
  });
});
