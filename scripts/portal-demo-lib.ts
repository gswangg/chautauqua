// Multi-portal demo data for DevFlow Conf 2027 (docs/design/multi-portal):
// portals, a library, Gold and Silver sponsors with their sessions, CFP and
// invited speakers, press roles, and Priya Raman holding a CFP talk, an
// invited panel and a Gold sponsor contact role.
//
// Every statement is idempotent and additive: fixed ids, INSERT OR IGNORE
// (or INSERT ... WHERE NOT EXISTS), and every reference resolved by
// subquery from the event's slug and people's emails -- so the SAME SQL
// runs after a local reseed (scripts/seed.ts) and against production
// (scripts/portal-demo-seed.ts), never wiping or overwriting a row.

import { createHash } from "node:crypto";

export const DEMO_EVENT_SLUG = "devflow-conf-2027";
// the invitation link the demo's invited speaker (Ruth) can open:
// /portal/invitations/<DEMO_INVITATION_TOKEN>
export const DEMO_INVITATION_TOKEN = "demo-invitation-ruth-adeyemi-2027";

const DAY_MS = 24 * 60 * 60 * 1000;

function q(v: string | number | boolean | null): string {
  if (v === null) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  return `'${v.replace(/'/g, "''")}'`;
}

/** A raw SQL expression, passed through q-less. */
interface Raw {
  sql: string;
}
const raw = (sql: string): Raw => ({ sql });
type Val = string | number | boolean | null | Raw;
const val = (v: Val) => (typeof v === "object" && v !== null ? v.sql : q(v));

function dayLabel(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function day(y: number, m: number, d: number): number {
  return Date.UTC(y, m - 1, d);
}

const E = raw(`(SELECT id FROM event WHERE slug = ${q(DEMO_EVENT_SLUG)})`);
const ORG = raw(`(SELECT org_id FROM event WHERE slug = ${q(DEMO_EVENT_SLUG)})`);
const HAS_EVENT = `EXISTS (SELECT 1 FROM event WHERE slug = ${q(DEMO_EVENT_SLUG)})`;
const contactByEmail = (email: string) =>
  raw(`(SELECT id FROM contact WHERE org_id = ${ORG.sql} AND lower(email) = lower(${q(email)}) ORDER BY created_at, id LIMIT 1)`);
const taskByTitle = (title: string) => raw(`(SELECT id FROM task WHERE event_id = ${E.sql} AND title = ${q(title)} ORDER BY id LIMIT 1)`);
const roomByName = (name: string) => raw(`(SELECT id FROM room WHERE event_id = ${E.sql} AND name = ${q(name)} ORDER BY id LIMIT 1)`);
const FORMAT_FIELD = raw(
  `(SELECT ff.id FROM form_field ff JOIN form f ON f.id = ff.form_id WHERE f.event_id = ${E.sql} AND f.is_default = 1 AND ff.role = 'session_format' ORDER BY ff.id LIMIT 1)`,
);
const NEXT_SEQ = raw(`(SELECT coalesce(max(seq), 0) + 1 FROM submission WHERE event_id = ${E.sql})`);
const PROFILE_BASICS = raw(
  `(SELECT id FROM portal WHERE event_id = ${E.sql} AND template = 'profile_basics' ORDER BY position, id LIMIT 1)`,
);

function insertSelect(table: string, row: Record<string, Val>, where = HAS_EVENT): string {
  const cols = Object.keys(row);
  return `INSERT OR IGNORE INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(", ")}) SELECT ${cols.map((c) => val(row[c]!)).join(", ")} WHERE ${where};`;
}

/** Every event gets the Profile basics portal the migration gave every
 * existing event (migrations/0046), for a reseeded database whose portal
 * table was cleared. */
export function profileBasicsForEveryEvent(nowMs: number): string {
  const rule = JSON.stringify({
    groups: [
      { conditions: [{ field: "session_status", op: "is", values: ["accepted"] }] },
      { conditions: [{ field: "kind", op: "is", values: ["company"] }, { field: "sponsorship_status", op: "is", values: ["active"] }] },
    ],
  });
  return (
    "INSERT OR IGNORE INTO `portal` (`id`, `event_id`, `name`, `note`, `rule_json`, `field_permissions_json`, `capabilities_json`, `notify_on_join`, `template`, `position`, `created_at`, `updated_at`) " +
    `SELECT 'pb_' || \`event\`.\`id\`, \`event\`.\`id\`, 'Profile basics', NULL, ${q(rule)}, '{}', ${q(JSON.stringify({ editSubmission: true, addCoPresenters: true }))}, 1, 'profile_basics', 0, ${nowMs}, ${nowMs} ` +
    "FROM `event` WHERE NOT EXISTS (SELECT 1 FROM `portal` WHERE `portal`.`event_id` = `event`.`id` AND `portal`.`template` = 'profile_basics');"
  );
}

export function portalDemoStatements(nowMs: number): string[] {
  const out: string[] = [];
  const t = (offsetDays = 0) => nowMs + offsetDays * DAY_MS;
  const stamp = { created_at: t(), updated_at: t() };

  // --- people ---------------------------------------------------------------
  const people: { key: string; first: string; last: string; email: string; company: string | null; title: string | null; bio?: string }[] = [
    { key: "imani", first: "Imani", last: "Brooks", email: "imani.brooks@example.com", company: "Fernwood", title: "VP Engineering", bio: "Imani Brooks leads developer platforms at Fernwood." },
    { key: "iris", first: "Iris", last: "Bell", email: "iris.bell@example.com", company: "Harbor Labs", title: "Engineering Manager" },
    { key: "ruth", first: "Ruth", last: "Adeyemi", email: "ruth.adeyemi@example.com", company: "Tessellate", title: "Head of Platform" },
    { key: "sofia", first: "Sofia", last: "Marchetti", email: "sofia@latticework.example", company: "Latticework Systems", title: "Developer Relations" },
    { key: "ben", first: "Ben", last: "Aturo", email: "ben@latticework.example", company: "Latticework Systems", title: "Events" },
    { key: "ana", first: "Ana", last: "Ruiz", email: "ana@latticework.example", company: "Latticework Systems", title: "Staff Engineer" },
    { key: "hannah", first: "Hannah", last: "Okoye", email: "hannah@riverbed.example", company: "Riverbed", title: "Partnerships" },
    { key: "tomas", first: "Tomas", last: "Bell", email: "tomas.bell@riverbed.example", company: "Riverbed", title: "Principal Engineer" },
    { key: "wei", first: "Wei", last: "Chen", email: "wei.chen@northwind.example", company: "Northwind Data", title: "Search Lead" },
    { key: "mina", first: "Mina", last: "Sato", email: "mina.sato@cloudreach.example", company: "Cloudreach Labs", title: "Marketing" },
    { key: "asha", first: "Asha", last: "Menon", email: "asha.menon@press.example", company: "The Build Log", title: "Reporter" },
    { key: "leo", first: "Leo", last: "Park", email: "leo.park@press.example", company: "Ship It Weekly", title: "Editor" },
  ];
  for (const p of people) {
    out.push(
      insertSelect(
        "contact",
        {
          id: `demo_mp_contact_${p.key}`,
          org_id: ORG,
          first_name: p.first,
          last_name: p.last,
          email: p.email,
          company: p.company,
          title: p.title,
          bio: p.bio ?? null,
          ...stamp,
        },
        `${HAS_EVENT} AND NOT EXISTS (SELECT 1 FROM contact WHERE org_id = ${ORG.sql} AND lower(email) = lower(${q(p.email)}))`,
      ),
    );
  }
  const C = {
    priya: contactByEmail("sbek-speaker@example.com"),
    marcus: contactByEmail("sbek-speaker2@example.com"),
    ...Object.fromEntries(people.map((p) => [p.key, contactByEmail(p.email)])),
  } as Record<string, Raw>;

  // --- invited and sponsor-approved sessions --------------------------------
  const sessions: {
    key: string;
    title: string;
    abstract: string;
    format: string;
    origin: "organizer" | "sponsor";
    slot?: { day: string; start: number; minutes: number; room: string };
  }[] = [
    { key: "opening", title: "Opening keynote: The Next Decade of Developer Workflow", abstract: "Where developer workflow is heading, and what platform teams should build for it.", format: "Keynote (45 min)", origin: "organizer", slot: { day: "2027-05-12", start: 9 * 60, minutes: 45, room: "Main Stage" } },
    { key: "closing", title: "Closing keynote: Shipping in the Age of Agents", abstract: "What changes when half your commits come from agents.", format: "Keynote (45 min)", origin: "organizer", slot: { day: "2027-05-14", start: 16 * 60, minutes: 45, room: "Main Stage" } },
    { key: "panel", title: "Lunch panel: Platform teams", abstract: "Four platform leads on deciding what to build, and what to leave out.", format: "Panel (45 min)", origin: "organizer", slot: { day: "2027-05-12", start: 12 * 60 + 30, minutes: 45, room: "Main Stage" } },
    { key: "ruth", title: "Shipping Platforms People Want", abstract: "How a platform team decides what to build: interviews, paper prototypes, and saying no.", format: "Talk (30 min)", origin: "organizer", slot: { day: "2027-05-13", start: 14 * 60, minutes: 30, room: "Main Stage" } },
    { key: "lattice_talk", title: "Build Caches at Scale", abstract: "Content-addressed build caches across 400 repositories, and the incidents that shaped them.", format: "Talk (30 min)", origin: "sponsor" },
    { key: "northwind", title: "Retrieval That Survives a Rewrite", abstract: "Keeping retrieval quality steady while the corpus underneath it changes every week.", format: "Talk (30 min)", origin: "sponsor" },
  ];
  for (const s of sessions) {
    const id = `demo_mp_sub_${s.key}`;
    out.push(
      insertSelect("submission", {
        id,
        event_id: E,
        form_id: null,
        seq: NEXT_SEQ,
        title: s.title,
        description: s.abstract,
        status: "accepted",
        content_status: "pending",
        accepted_at: t(-20),
        origin: s.origin,
        ...stamp,
      }),
    );
    out.push(
      insertSelect("submission_answer", {
        id: `demo_mp_answer_${s.key}`,
        submission_id: id,
        form_field_id: FORMAT_FIELD,
        value_json: JSON.stringify(s.format),
        ...stamp,
      }, `${HAS_EVENT} AND ${FORMAT_FIELD.sql} IS NOT NULL AND EXISTS (SELECT 1 FROM submission WHERE id = ${q(id)})`),
    );
    if (s.slot) {
      out.push(
        insertSelect("schedule_slot", {
          id: `demo_mp_slot_${s.key}`,
          submission_id: id,
          room_id: roomByName(s.slot.room),
          day: s.slot.day,
          start_min: s.slot.start,
          end_min: s.slot.start + s.slot.minutes,
          ...stamp,
        }, `${HAS_EVENT} AND EXISTS (SELECT 1 FROM submission WHERE id = ${q(id)})`),
      );
    }
  }

  const participant = (
    key: string,
    submissionKey: string,
    contact: Raw,
    role: string,
    inviteStatus: string,
    order: number,
    extra: Record<string, Val> = {},
  ) =>
    insertSelect("participant", {
      id: `demo_mp_part_${key}`,
      submission_id: `demo_mp_sub_${submissionKey}`,
      contact_id: contact,
      role,
      order,
      visible: true,
      invite_status: inviteStatus,
      ...extra,
      ...stamp,
    }, `${HAS_EVENT} AND ${contact.sql} IS NOT NULL AND EXISTS (SELECT 1 FROM submission WHERE id = ${q(`demo_mp_sub_${submissionKey}`)})`);
  out.push(participant("opening_imani", "opening", C.imani!, "speaker", "none", 0));
  out.push(participant("closing_marcus", "closing", C.marcus!, "speaker", "none", 0));
  out.push(participant("panel_iris", "panel", C.iris!, "moderator", "accepted", 0));
  out.push(participant("panel_priya", "panel", C.priya!, "panelist", "accepted", 1));
  out.push(
    participant("ruth", "ruth", C.ruth!, "speaker", "invited", 0, {
      invitation_message: "We'd love a talk on how your platform team decides what to build.",
      reply_by: day(2027, 3, 15),
      invited_by_user_id: raw(`(SELECT id FROM user WHERE org_id = ${ORG.sql} AND role = 'organizer' ORDER BY created_at, id LIMIT 1)`),
      invitation_token_hash: createHash("sha256").update(DEMO_INVITATION_TOKEN).digest("hex"),
    }),
  );
  out.push(participant("lattice_priya", "lattice_talk", C.priya!, "speaker", "none", 0));
  out.push(participant("northwind_wei", "northwind", C.wei!, "speaker", "none", 0));

  // --- event roles (press: covered by no portal, on the coverage list) -------
  for (const k of ["asha", "leo"]) {
    out.push(insertSelect("event_role", { id: `demo_mp_role_${k}`, event_id: E, contact_id: C[k]!, role: "press", ...stamp }, `${HAS_EVENT} AND ${C[k]!.sql} IS NOT NULL`));
  }

  // --- sponsors --------------------------------------------------------------
  out.push(insertSelect("sponsor_tier", { id: "demo_mp_tier_gold", event_id: E, name: "Gold", position: 0, ...stamp }));
  out.push(insertSelect("sponsor_tier", { id: "demo_mp_tier_silver", event_id: E, name: "Silver", position: 1, ...stamp }));
  const ent = (id: string, tier: string, format: string, minutes: number, position: number) =>
    insertSelect("sponsor_entitlement", { id, tier_id: tier, sponsorship_id: null, count: 1, format, minutes, position, ...stamp });
  out.push(ent("demo_mp_ent_gold_talk", "demo_mp_tier_gold", "Talk (30 min)", 30, 0));
  out.push(ent("demo_mp_ent_gold_workshop", "demo_mp_tier_gold", "Workshop (120 min)", 120, 1));
  out.push(ent("demo_mp_ent_silver_talk", "demo_mp_tier_silver", "Talk (30 min)", 30, 0));

  const sponsors: { key: string; name: string; tier: string; status: string }[] = [
    { key: "lattice", name: "Latticework Systems", tier: "demo_mp_tier_gold", status: "active" },
    { key: "riverbed", name: "Riverbed", tier: "demo_mp_tier_gold", status: "active" },
    { key: "northwind", name: "Northwind Data", tier: "demo_mp_tier_silver", status: "active" },
    { key: "cloudreach", name: "Cloudreach Labs", tier: "demo_mp_tier_silver", status: "pending" },
  ];
  for (const s of sponsors) {
    out.push(
      insertSelect("sponsor_company", { id: `demo_mp_company_${s.key}`, org_id: ORG, name: s.name, ...stamp }, `${HAS_EVENT} AND NOT EXISTS (SELECT 1 FROM sponsor_company WHERE org_id = ${ORG.sql} AND lower(name) = lower(${q(s.name)}))`),
    );
    out.push(
      insertSelect("sponsorship", {
        id: `demo_mp_sponsorship_${s.key}`,
        event_id: E,
        company_id: raw(`(SELECT id FROM sponsor_company WHERE org_id = ${ORG.sql} AND lower(name) = lower(${q(s.name)}) ORDER BY created_at, id LIMIT 1)`),
        tier_id: s.tier,
        status: s.status,
        ...stamp,
      }),
    );
  }
  const team = (key: string, sponsor: string, contact: Raw, status: string, primary: boolean, joinedDays: number) =>
    insertSelect("sponsor_contact", {
      id: `demo_mp_sc_${key}`,
      sponsorship_id: `demo_mp_sponsorship_${sponsor}`,
      event_id: E,
      contact_id: contact,
      status,
      is_primary: primary,
      invited_by_contact_id: status === "invited" ? C.priya! : null,
      invited_at: status === "invited" ? t(joinedDays) : null,
      joined_at: status === "joined" ? t(joinedDays) : null,
      ...stamp,
    }, `${HAS_EVENT} AND ${contact.sql} IS NOT NULL AND EXISTS (SELECT 1 FROM sponsorship WHERE id = ${q(`demo_mp_sponsorship_${sponsor}`)})`);
  out.push(team("lattice_priya", "lattice", C.priya!, "joined", true, -40));
  out.push(team("lattice_sofia", "lattice", C.sofia!, "joined", false, -15));
  out.push(team("lattice_ben", "lattice", C.ben!, "invited", false, -12));
  out.push(team("riverbed_hannah", "riverbed", C.hannah!, "joined", true, -30));
  out.push(team("riverbed_tomas", "riverbed", C.tomas!, "joined", false, -28));
  out.push(team("northwind_wei", "northwind", C.wei!, "joined", true, -35));
  out.push(team("cloudreach_mina", "cloudreach", C.mina!, "joined", true, -5));

  const sponsorSession = (row: Record<string, Val>) =>
    insertSelect("sponsor_session", { ...row, event_id: E, ...stamp }, `${HAS_EVENT} AND EXISTS (SELECT 1 FROM sponsorship WHERE id = ${val(row.sponsorship_id!)})`);
  out.push(
    sponsorSession({
      id: "demo_mp_ss_lattice_talk",
      sponsorship_id: "demo_mp_sponsorship_lattice",
      entitlement_id: "demo_mp_ent_gold_talk",
      title: "Build Caches at Scale",
      abstract: "Content-addressed build caches across 400 repositories, and the incidents that shaped them.",
      status: "approved",
      submission_id: "demo_mp_sub_lattice_talk",
      created_by_contact_id: C.priya!,
      submitted_at: t(-30),
      submit_count: 1,
      decided_at: t(-25),
      last_note_by: "Jordan Alvarez",
    }),
  );
  out.push(
    sponsorSession({
      id: "demo_mp_ss_lattice_workshop",
      sponsorship_id: "demo_mp_sponsorship_lattice",
      entitlement_id: "demo_mp_ent_gold_workshop",
      title: "Hands-on: Build Caches from Scratch",
      abstract:
        "In two hours you'll build a content-addressed build cache in TypeScript, wire it into a real CI pipeline, and measure the speed-up yourself.",
      status: "submitted",
      last_note: "The abstract reads as a product pitch. Can you describe what attendees will build, and drop the pricing slide?",
      last_note_at: t(-3),
      last_note_by: "Jordan Alvarez",
      created_by_contact_id: C.priya!,
      submitted_at: t(0) - 2 * 60 * 60 * 1000,
      submit_count: 2,
    }),
  );
  out.push(
    sponsorSession({
      id: "demo_mp_ss_riverbed_talk",
      sponsorship_id: "demo_mp_sponsorship_riverbed",
      entitlement_id: "demo_mp_ent_gold_talk",
      title: "Shipping Feature Flags Without the Debt",
      abstract: "Flags that ship features, then leave: lifecycles, ownership and the clean-up nobody schedules.",
      status: "submitted",
      created_by_contact_id: C.hannah!,
      submitted_at: t(-2),
      submit_count: 1,
    }),
  );
  out.push(
    sponsorSession({
      id: "demo_mp_ss_northwind_talk",
      sponsorship_id: "demo_mp_sponsorship_northwind",
      entitlement_id: "demo_mp_ent_silver_talk",
      title: "Retrieval That Survives a Rewrite",
      abstract: "Keeping retrieval quality steady while the corpus underneath it changes every week.",
      status: "approved",
      submission_id: "demo_mp_sub_northwind",
      created_by_contact_id: C.wei!,
      submitted_at: t(-60),
      submit_count: 1,
      decided_at: t(-50),
      last_note_by: "Jordan Alvarez",
    }),
  );
  const ssSpeaker = (key: string, session: string, contact: Raw, position: number) =>
    insertSelect("sponsor_session_speaker", { id: `demo_mp_sss_${key}`, sponsor_session_id: session, contact_id: contact, position, ...stamp }, `${HAS_EVENT} AND ${contact.sql} IS NOT NULL AND EXISTS (SELECT 1 FROM sponsor_session WHERE id = ${q(session)})`);
  out.push(ssSpeaker("lattice_talk_priya", "demo_mp_ss_lattice_talk", C.priya!, 0));
  out.push(ssSpeaker("lattice_ws_priya", "demo_mp_ss_lattice_workshop", C.priya!, 0));
  out.push(ssSpeaker("lattice_ws_ana", "demo_mp_ss_lattice_workshop", C.ana!, 1));
  out.push(ssSpeaker("riverbed_tomas", "demo_mp_ss_riverbed_talk", C.tomas!, 0));
  out.push(ssSpeaker("northwind_wei", "demo_mp_ss_northwind_talk", C.wei!, 0));

  // the workshop's history (the review page lists it from the audit log)
  const audit = (key: string, action: string, actor: string, actorContact: Raw | null, at: number, details: Record<string, string | boolean>) =>
    insertSelect("audit_event", {
      id: `demo_mp_audit_${key}`,
      org_id: ORG,
      event_id: E,
      actor_user_id: null,
      actor_contact_id: actorContact,
      actor_label: actor,
      action,
      target_type: "sponsor_session",
      target_id: "demo_mp_ss_lattice_workshop",
      subject_contact_id: null,
      details_json: JSON.stringify(details),
      created_at: at,
    });
  out.push(audit("ws_submit1", "sponsor_session.submit", "Priya Raman", C.priya!, t(-6), { resubmitted: false, title: "Hands-on: Build Caches from Scratch" }));
  out.push(audit("ws_changes", "sponsor_session.request_changes", "Jordan Alvarez", null, t(-3), { note: "The abstract reads as a product pitch. Can you describe what attendees will build, and drop the pricing slide?" }));
  out.push(audit("ws_submit2", "sponsor_session.submit", "Priya Raman", C.priya!, t(0) - 2 * 60 * 60 * 1000, { resubmitted: true, title: "Hands-on: Build Caches from Scratch" }));

  // --- the item library (portal-only tasks) ----------------------------------
  const tasks: { title: string; kind: string; scope: string; instructions: string; types?: string[]; maxMb?: number; deliverable?: string }[] = [
    { title: "Final slides", kind: "file_request", scope: "participation", instructions: "Upload the deck you'll present, 16:9.", types: ["pdf", "keynote", "powerpoint"], maxMb: 200, deliverable: "presentation" },
    { title: "AV needs", kind: "general", scope: "participation", instructions: "Mics, adapters, a clicker, a confidence monitor: tell us what you need on stage." },
    { title: "Speaker release", kind: "general", scope: "participation", instructions: "Agree to the recording and publishing of your session." },
    { title: "Share your talk", kind: "share_kit", scope: "participation", instructions: "I'm speaking at {event}: {session}. Come say hi! {link}" },
    { title: "Travel form", kind: "general", scope: "person", instructions: "Your travel dates and where you're flying from." },
    { title: "Panel prep notes", kind: "general", scope: "participation", instructions: "Three questions you'd like the moderator to ask." },
    { title: "Logo and booth details", kind: "file_request", scope: "participation", instructions: "Your logo (SVG or PNG) and what you need at the booth.", types: ["image", "pdf"], maxMb: 50 },
    { title: "Workshop materials", kind: "file_request", scope: "participation", instructions: "Setup instructions attendees need before they arrive.", types: ["pdf"], maxMb: 50 },
    { title: "Volunteer shift preferences", kind: "general", scope: "person", instructions: "Which days and times you can help." },
  ];
  tasks.forEach((tk, i) => {
    out.push(
      insertSelect(
        "task",
        {
          id: `demo_mp_task_${i + 1}`,
          event_id: E,
          kind: tk.kind,
          title: tk.title,
          description: null,
          due_date: null,
          required: false,
          form_id: null,
          deliverable_kind: tk.deliverable ?? null,
          instructions: tk.instructions,
          audience: "portal",
          scope: tk.scope,
          accepted_types_json: tk.types ? JSON.stringify(tk.types) : null,
          max_size_mb: tk.maxMb ?? null,
          max_files: tk.types ? 1 : null,
          ...stamp,
        },
        `${HAS_EVENT} AND NOT EXISTS (SELECT 1 FROM task WHERE event_id = ${E.sql} AND title = ${q(tk.title)})`,
      ),
    );
  });

  // --- portals ---------------------------------------------------------------
  out.push(
    insertSelect(
      "portal",
      {
        id: "demo_mp_portal_profile",
        event_id: E,
        name: "Profile basics",
        note: null,
        rule_json: JSON.stringify({
          groups: [
            { conditions: [{ field: "session_status", op: "is", values: ["accepted"] }] },
            { conditions: [{ field: "kind", op: "is", values: ["company"] }, { field: "sponsorship_status", op: "is", values: ["active"] }] },
          ],
        }),
        field_permissions_json: "{}",
        capabilities_json: JSON.stringify({ editSubmission: true, addCoPresenters: true }),
        notify_on_join: true,
        template: "profile_basics",
        position: 0,
        ...stamp,
      },
      `${HAS_EVENT} AND NOT EXISTS (SELECT 1 FROM portal WHERE event_id = ${E.sql} AND template = 'profile_basics')`,
    ),
  );
  const portal = (row: { id: string; name: string; note: string | null; rule: unknown; fields?: unknown; caps?: unknown; template: string | null; position: number }) =>
    insertSelect("portal", {
      id: row.id,
      event_id: E,
      name: row.name,
      note: row.note,
      rule_json: JSON.stringify(row.rule),
      field_permissions_json: JSON.stringify(row.fields ?? {}),
      capabilities_json: JSON.stringify(row.caps ?? {}),
      notify_on_join: true,
      template: row.template,
      position: row.position,
      ...stamp,
    });
  out.push(
    portal({
      id: "demo_mp_portal_cfp",
      name: "CFP speakers",
      note: "As a CFP speaker, you'll share final slides and your AV needs.",
      rule: { groups: [{ conditions: [{ field: "arrival", op: "is", values: ["cfp"] }, { field: "session_status", op: "is", values: ["accepted"] }, { field: "role", op: "is_any_of", values: ["speaker", "co-presenter"] }] }] },
      caps: { editSubmission: true, addCoPresenters: true },
      template: "cfp_speakers",
      position: 1,
    }),
  );
  out.push(
    portal({
      id: "demo_mp_portal_invited",
      name: "Invited speakers",
      note: "As an invited speaker, you'll confirm your session and share a bio.",
      rule: {
        groups: [
          { conditions: [{ field: "role", op: "is_any_of", values: ["speaker", "moderator", "panelist"] }, { field: "arrival", op: "is", values: ["organizer"] }] },
        ],
      },
      fields: { headshot: { level: "view", help: "We use the photo from your keynote announcement." } },
      template: "invited_speakers",
      position: 2,
    }),
  );
  out.push(
    portal({
      id: "demo_mp_portal_sponsors",
      name: "Sponsors",
      note: "As a sponsor contact, you'll send booth details and design your sponsored sessions.",
      rule: {
        groups: [
          {
            conditions: [
              { field: "kind", op: "is", values: ["company"] },
              { field: "sponsorship_status", op: "is", values: ["active"] },
              { field: "sponsor_tier", op: "is_any_of", values: ["demo_mp_tier_gold", "demo_mp_tier_silver"] },
            ],
          },
        ],
      },
      caps: { addTeammates: true, createSponsorSessions: true },
      template: "sponsors",
      position: 3,
    }),
  );
  out.push(
    portal({
      id: "demo_mp_portal_workshops",
      name: "Workshop leads",
      note: "Workshop leads: send setup instructions for attendees a week ahead.",
      rule: { groups: [{ conditions: [{ field: "format", op: "is", values: ["Workshop (120 min)"] }, { field: "session_status", op: "is", values: ["accepted"] }] }] },
      template: null,
      position: 4,
    }),
  );
  out.push(
    portal({
      id: "demo_mp_portal_volunteers",
      name: "Volunteers",
      note: null,
      rule: { groups: [{ conditions: [{ field: "role", op: "is", values: ["volunteer"] }] }] },
      template: null,
      position: 5,
    }),
  );

  const item = (
    id: string,
    portalRef: Raw | string,
    ref: { task?: string; system?: string },
    s: { deadline: "none" | "fixed" | "relative"; due?: number; days?: number; required: boolean; grace?: number; position: number; viewOnly?: boolean; allowEdit?: boolean },
  ) =>
    insertSelect(
      "portal_item",
      {
        id,
        portal_id: typeof portalRef === "string" ? portalRef : portalRef,
        task_id: ref.task ? taskByTitle(ref.task) : null,
        resource_id: null,
        system_kind: ref.system ?? null,
        display_name: null,
        deadline_kind: s.deadline,
        due_date: s.deadline === "fixed" ? (s.due ?? null) : null,
        relative_days: s.deadline === "relative" ? (s.days ?? null) : null,
        required: s.required,
        grace_days: s.grace ?? 0,
        allow_edit_after_submit: s.allowEdit ?? false,
        view_only_when_done: s.viewOnly ?? false,
        position: s.position,
        ...stamp,
      },
      `${HAS_EVENT} AND ${typeof portalRef === "string" ? `EXISTS (SELECT 1 FROM portal WHERE id = ${q(portalRef)})` : `${portalRef.sql} IS NOT NULL`}${ref.task ? ` AND ${taskByTitle(ref.task).sql} IS NOT NULL` : ""}`,
    );
  // Profile basics (the migrated or seeded one): bio and headshot
  out.push(item("demo_mp_item_pb_bio", PROFILE_BASICS, { system: "bio" }, { deadline: "none", required: true, position: 0 }));
  out.push(item("demo_mp_item_pb_headshot", PROFILE_BASICS, { system: "headshot" }, { deadline: "fixed", due: day(2027, 4, 10), required: true, position: 1 }));
  // CFP speakers
  out.push(item("demo_mp_item_cfp_slides", "demo_mp_portal_cfp", { task: "Final slides" }, { deadline: "fixed", due: day(2027, 5, 1), required: true, grace: 7, position: 0, allowEdit: true }));
  out.push(item("demo_mp_item_cfp_av", "demo_mp_portal_cfp", { task: "AV needs" }, { deadline: "fixed", due: day(2027, 4, 20), required: true, position: 1 }));
  out.push(item("demo_mp_item_cfp_release", "demo_mp_portal_cfp", { task: "Speaker release" }, { deadline: "fixed", due: dayLabel(t(-5)), required: true, position: 2, viewOnly: true }));
  out.push(item("demo_mp_item_cfp_share", "demo_mp_portal_cfp", { task: "Share your talk" }, { deadline: "none", required: false, position: 3 }));
  // Invited speakers
  out.push(item("demo_mp_item_inv_accept", "demo_mp_portal_invited", { system: "acceptance" }, { deadline: "fixed", due: day(2027, 3, 15), required: true, position: 0 }));
  out.push(item("demo_mp_item_inv_bio", "demo_mp_portal_invited", { system: "bio" }, { deadline: "fixed", due: day(2027, 4, 3), required: true, grace: 7, position: 1 }));
  out.push(item("demo_mp_item_inv_travel", "demo_mp_portal_invited", { task: "Travel form" }, { deadline: "relative", days: 14, required: true, position: 2 }));
  out.push(item("demo_mp_item_inv_prep", "demo_mp_portal_invited", { task: "Panel prep notes" }, { deadline: "fixed", due: day(2027, 5, 1), required: false, position: 3 }));
  out.push(item("demo_mp_item_inv_slides", "demo_mp_portal_invited", { task: "Final slides" }, { deadline: "fixed", due: day(2027, 5, 1), required: true, grace: 7, position: 4 }));
  // Sponsors
  out.push(item("demo_mp_item_sp_logo", "demo_mp_portal_sponsors", { task: "Logo and booth details" }, { deadline: "fixed", due: dayLabel(t(-3)), required: true, grace: 7, position: 0 }));
  out.push(item("demo_mp_item_sp_sessions", "demo_mp_portal_sponsors", { system: "sponsor_sessions" }, { deadline: "fixed", due: day(2027, 4, 15), required: true, position: 1 }));
  // Workshop leads
  out.push(item("demo_mp_item_ws_materials", "demo_mp_portal_workshops", { task: "Workshop materials" }, { deadline: "fixed", due: day(2027, 5, 5), required: true, position: 0 }));
  out.push(item("demo_mp_item_ws_release", "demo_mp_portal_workshops", { task: "Speaker release" }, { deadline: "fixed", due: dayLabel(t(-5)), required: true, position: 1 }));
  // Volunteers
  out.push(item("demo_mp_item_vol_shift", "demo_mp_portal_volunteers", { task: "Volunteer shift preferences" }, { deadline: "none", required: true, position: 0 }));

  // --- finished work, so homes show done states ------------------------------
  // Priya's CFP talk: AV needs sent (the portal assignment, scoped to her
  // participation on the talk)
  const priyaCfpParticipant = raw(
    `(SELECT p.id FROM participant p JOIN submission s ON s.id = p.submission_id WHERE p.contact_id = ${C.priya!.sql} AND s.event_id = ${E.sql} AND s.origin = 'cfp' AND s.status = 'accepted' ORDER BY s.seq, p.id LIMIT 1)`,
  );
  out.push(
    insertSelect(
      "task_assignment",
      {
        id: "demo_mp_ta_priya_av",
        task_id: taskByTitle("AV needs"),
        contact_id: C.priya!,
        status: "complete",
        completed_at: t(-10),
        completed_by: null,
        scope_key: raw(`'p:' || ${priyaCfpParticipant.sql}`),
        source: "portal",
        due_date: day(2027, 4, 20),
        required: true,
        ...stamp,
      },
      `${HAS_EVENT} AND ${priyaCfpParticipant.sql} IS NOT NULL AND ${taskByTitle("AV needs").sql} IS NOT NULL`,
    ),
  );
  // ...and her share kit, still to do, under a fixed id the render sweep's
  // manifest visits (reconcile keeps it: same task, contact and scope)
  out.push(
    insertSelect(
      "task_assignment",
      {
        id: "demo_mp_ta_priya_share",
        task_id: taskByTitle("Share your talk"),
        contact_id: C.priya!,
        status: "pending",
        completed_at: null,
        completed_by: null,
        scope_key: raw(`'p:' || ${priyaCfpParticipant.sql}`),
        source: "portal",
        due_date: null,
        required: false,
        ...stamp,
      },
      `${HAS_EVENT} AND ${priyaCfpParticipant.sql} IS NOT NULL AND ${taskByTitle("Share your talk").sql} IS NOT NULL`,
    ),
  );
  return out;
}
