// Pure helpers for scripts/seed.ts, extracted for plain-vitest testing.
// Not part of the pure-core (src/{auth,domain,forms,mail,lib}) — this is
// seed tooling per DEC-001 — but kept dependency-free anyway so it's easy
// to unit test without touching the filesystem or a real D1 binding.

/** SQL-quote a value for a single-column-value literal in an INSERT statement. */
export function sqlQuote(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`cannot quote non-finite number: ${value}`);
    }
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  // String: escape single quotes by doubling, per SQL string-literal rules.
  return `'${value.replace(/'/g, "''")}'`;
}

/** Builds a single-row INSERT statement. Column order follows the row's own key order. */
export function insertStmt(table: string, row: Record<string, string | number | boolean | null | undefined>): string {
  const columns = Object.keys(row);
  if (columns.length === 0) {
    throw new Error(`insertStmt: empty row for table '${table}'`);
  }
  const values = columns.map((c) => sqlQuote(row[c]));
  // Double-quote column identifiers: SQLite reserves words like `order`
  // (participant.order) as keywords, and this keeps the generator safe for
  // any future column name too.
  const quotedColumns = columns.map((c) => `"${c}"`);
  return `INSERT INTO ${table} (${quotedColumns.join(", ")}) VALUES (${values.join(", ")});`;
}

/** Builds a DELETE-all statement for idempotent reseeding. */
export function deleteAllStmt(table: string): string {
  return `DELETE FROM ${table};`;
}

// ---------------------------------------------------------------------------
// DEC-578: the explicit FK-safe DELETE order below is real knowledge the
// schema itself does not encode (drizzle-orm doesn't declare FK constraints
// on these sqlite tables, so there's nothing to topologically sort from) —
// it stays hand-curated, children before parents. But the *set* of tables it
// wipes must always equal the full set src/db/schema.ts exports; a table
// added to the schema without updating this list would survive every
// reseed, as pipeline_entry once silently did. seed.ts calls
// assertDeleteOrderCoversSchema against the live schema before writing any
// DELETE statement, and test/seed-delete-order.test.ts pins the same check.
export const TABLES_IN_DELETE_ORDER: readonly string[] = [
  "email_log",
  "email_template",
  "file_comment",
  "file",
  "resource",
  "portal_settings",
  "task_assignment",
  "task",
  "schedule_slot",
  // DEC-271: review_recusal references evaluation_plan/submission/user.
  "review_recusal",
  "evaluation",
  "plan_reviewer",
  "evaluation_plan",
  "participant",
  "submission_track",
  "submission_answer",
  // DEC-158: submission_revision references submission and (nullably) user.
  "submission_revision",
  "submission",
  "form_field",
  "form",
  "room",
  "track",
  // CRM-07/08 (DEC-157): pipeline_activity references pipeline_entry and
  // user; pipeline_entry references contact and org. Both must clear before
  // contact/user/org below.
  "pipeline_activity",
  "pipeline_entry",
  // DEC-770: contact_duplicate_dismissal references org and two contacts, so
  // it must clear before contact/org below.
  "contact_duplicate_dismissal",
  "contact",
  "auth_session",
  "user",
  "saved_view",
  // DEC-785: embed references org and event, so it must clear before both.
  "embed",
  "event",
  "segment",
  "api_token",
  // DEC-948: rate_limit has no FK to anything the seed creates (its `key`
  // column is an opaque derived string, not a reference) -- no ordering
  // constraint, listed here alongside its schema-file neighbor api_token.
  "rate_limit",
  "org",
];

/**
 * Fails loudly, BY NAME, when the hand-curated delete-order list and the
 * schema's actual table set diverge in either direction: a schema table the
 * list omits (would survive a reseed), or a list entry naming a table the
 * schema no longer has (dead/typo'd entry). Also rejects a duplicate entry,
 * which would silently mask a missing one via a length-only comparison.
 */
export function assertDeleteOrderCoversSchema(
  deleteOrder: readonly string[],
  schemaTableNames: readonly string[],
): void {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const t of deleteOrder) {
    if (seen.has(t)) dupes.add(t);
    seen.add(t);
  }
  if (dupes.size > 0) {
    throw new Error(
      `seed TABLES_IN_DELETE_ORDER lists duplicate table(s): ${[...dupes].sort().join(", ")}`,
    );
  }

  const deleteSet = new Set(deleteOrder);
  const schemaSet = new Set(schemaTableNames);
  const missing = schemaTableNames.filter((t) => !deleteSet.has(t)).sort();
  const extra = deleteOrder.filter((t) => !schemaSet.has(t)).sort();
  if (missing.length > 0 || extra.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0) {
      parts.push(`schema table(s) missing from TABLES_IN_DELETE_ORDER: ${missing.join(", ")}`);
    }
    if (extra.length > 0) {
      parts.push(`TABLES_IN_DELETE_ORDER names table(s) not in src/db/schema.ts: ${extra.join(", ")}`);
    }
    throw new Error(`seed delete order is out of sync with src/db/schema.ts — ${parts.join("; ")}`);
  }
}

export const ADDITIONAL_SUBMISSION_STATUS_COUNTS: Readonly<Record<string, number>> = {
  pending: 15,
  accept_queue: 4,
  accepted: 5,
  decline_queue: 1,
  declined: 2,
};

/**
 * Deterministic status distribution for the N "additional" synthetic
 * submissions (beyond the 3 fixture ones, which are all 'pending'),
 * matching the swarm task's ~18 pending / 4 accept_queue / 5 accepted /
 * 1 decline_queue / 2 declined split across all 30 submissions.
 */
export function additionalSubmissionStatuses(count: number): string[] {
  const total = Object.values(ADDITIONAL_SUBMISSION_STATUS_COUNTS).reduce((a, b) => a + b, 0);
  if (count !== total) {
    throw new Error(`additionalSubmissionStatuses: expected count ${total}, got ${count}`);
  }
  const out: string[] = [];
  for (const [status, n] of Object.entries(ADDITIONAL_SUBMISSION_STATUS_COUNTS)) {
    for (let i = 0; i < n; i++) {
      out.push(status);
    }
  }
  return out;
}

/** Zero-padded deterministic id, e.g. seedId('submission', 4) === 'seed_submission_0004'. */
export function seedId(kind: string, n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`seedId: n must be a non-negative integer, got ${n}`);
  }
  return `seed_${kind}_${String(n).padStart(4, "0")}`;
}

// --------------------------------------------------------------------------
// Deterministic tiny R2 assets (task w6-e): a minimal valid single-page PDF
// and a 1x1 PNG, generated as pure byte-array builders so they're plain-
// vitest testable without touching the filesystem or a real R2 binding.
// --------------------------------------------------------------------------

/**
 * Builds a minimal, valid, single-page PDF (no text, empty content stream)
 * as raw bytes. Deterministic byte-for-byte across runs — no timestamps or
 * random ids embedded in the body.
 */
export function minimalPdfBytes(): Uint8Array {
  // Fixed byte offsets for the xref table, computed from the literal object
  // bodies below (which never change), so this stays 100% deterministic.
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>\nendobj\n",
    "4 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n",
  ];

  const header = "%PDF-1.4\n";
  let body = header;
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(body.length);
    body += obj;
  }
  const xrefStart = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new TextEncoder().encode(body + xref + trailer);
}

// CRC-32 (ISO 3309 / PNG spec) table, built once.
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u32be(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Builds a PNG chunk (length + type + data + CRC-32 over type+data). */
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const crcInput = concatBytes([typeBytes, data]);
  return concatBytes([u32be(data.length), typeBytes, data, u32be(crc32(crcInput))]);
}

/**
 * A hardcoded, computed-correct 1x1 opaque black PNG, as raw bytes (valid
 * PNG signature + IHDR + IDAT + IEND chunks with proper CRC-32s). The pixel
 * bytes and zlib "stored" (uncompressed) IDAT framing are literal/fixed, so
 * output is byte-for-byte deterministic across runs.
 */
export function onePixelPngBytes(): Uint8Array {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = concatBytes([
    u32be(1), // width
    u32be(1), // height
    new Uint8Array([8, 2, 0, 0, 0]), // bit depth 8, color type 2 (RGB), compression/filter/interlace 0
  ]);
  const ihdr = pngChunk("IHDR", ihdrData);

  // Raw scanline: 1 filter-type byte (0 = none) + 1 RGB pixel (black).
  const raw = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
  // zlib stream with a single "stored" (uncompressed) deflate block, per
  // RFC 1950/1951 — avoids needing a deflate implementation while staying a
  // fully valid zlib-wrapped IDAT payload.
  const zlibHeader = new Uint8Array([0x78, 0x01]); // CMF/FLG, no preset dict, default compression
  const blockHeader = new Uint8Array([0x01]); // BFINAL=1, BTYPE=00 (stored)
  const len = raw.length;
  const lenBytes = new Uint8Array([len & 0xff, (len >> 8) & 0xff, (~len) & 0xff, ((~len) >> 8) & 0xff]);
  const adler = adler32(raw);
  const idatData = concatBytes([zlibHeader, blockHeader, lenBytes, raw, u32be(adler)]);
  const idat = pngChunk("IDAT", idatData);

  const iend = pngChunk("IEND", new Uint8Array(0));

  return concatBytes([signature, ihdr, idat, iend]);
}

// DEC-792: seeded email_template literals, moved here (exported) from
// seed.ts so they're reachable by test/seeded-template-vocabulary.test.ts
// without importing the whole seed script. Bodies deliberately use a
// literal space (never a real "\n" newline character) between sentences —
// seed.ts writes one statement per output line, and a raw newline embedded
// in a quoted value would split an INSERT across lines, breaking every
// line-anchored tool (grep, and this test file's own per-line SQL parser)
// that assumes one statement/line.
export const ADDITIONAL_EMAIL_TEMPLATES: Array<{ name: string; subject: string; bodyText: string }> = [
  {
    name: "Decline Notification",
    subject: "Update on your submission to {event_name}",
    bodyText:
      "Hi {speaker_name}, thank you for submitting \"{talk_title}\" to {event_name}. After careful review, " +
      "we're not able to include it in this year's program. We hope you'll consider submitting again next time. " +
      "Thank you, The {event_name} Team",
  },
  {
    name: "Schedule Confirmation",
    subject: "Your session is scheduled — {event_name}",
    bodyText:
      "Hi {speaker_name}, your session \"{talk_title}\" is now scheduled for {event_name}. You can view the " +
      "full details, including room and time, in your speaker portal: {portal_link}. See you there!",
  },
  {
    name: "Content Reminder",
    // DEC-836/DEC-847: the subject must not interpolate {task_list} — it's a
    // multi-line block (one task per line), which renders a paragraph
    // subject and a stray double period when the list is empty. Keep
    // {due_date} (a single value) and let the body carry the block.
    subject: "Reminder: onboarding tasks due {due_date}",
    bodyText:
      "Hi {speaker_name}, this is a friendly reminder that the following onboarding tasks are due " +
      "{due_date}: {task_list}. Please complete them via the speaker portal: {portal_link}. Thanks!",
  },
  {
    name: "Final Logistics",
    subject: "Final logistics for {event_name}",
    bodyText:
      "Hi {speaker_name}, as {event_name} approaches, here's everything you need for the big day: parking, " +
      "AV setup, and check-in instructions are all in your speaker portal: {portal_link}. See you soon!",
  },
  {
    name: "Speaker Portal Invitation",
    subject: "Your speaker portal for {event_name}",
    bodyText:
      "Hi {speaker_name}, welcome to {event_name}! You can view your submission status and complete any " +
      "outstanding tasks in your speaker portal: {portal_link}. See you there!",
  },
];

function adler32(bytes: Uint8Array): number {
  const MOD_ADLER = 65521;
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % MOD_ADLER;
    b = (b + a) % MOD_ADLER;
  }
  return ((b << 16) | a) >>> 0;
}
