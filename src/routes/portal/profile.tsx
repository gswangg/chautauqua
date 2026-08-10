// Portal profile self-service (J7), per DEC-028 (portal splits into
// parallel sub-apps; headshots get kind 'headshot' + a public /headshots
// route) + DEC-012 (thin handlers: gate -> repo -> render) + DEC-020
// (upload validation values) + DEC-005 (route map). Route files export a
// named Hono sub-app; only src/index.ts mounts it.

import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../../server/env";
import { csrfForm } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { makeFileStore } from "../../server/context";
import { assertSpeakerContactId, getPortalData } from "../../server/repo/portal";
import {
  getContactProfile,
  getHeadshotFileScope,
  setContactHeadshot,
  updateContactProfile,
  type ContactProfile,
  type SocialLinks,
} from "../../server/repo/profile";
import { sanitizeFilenameForKey, validateHeadshotUpload } from "../../domain/files";
import { newId } from "../../domain/ids";
import { CSRF_COOKIE_NAME, newCsrfToken, parseCookies } from "../../auth/cookies";
import { speakerGate, PortalLayout } from "./shared";

// Mounted at /portal in src/index.ts (DEC-012, declared union overlap with
// portalRoutes / portalTasksRoutes — all three sub-apps share the
// /portal/* prefix).
export const portalProfileRoutes = new Hono<AppEnv>();

portalProfileRoutes.use("/profile", speakerGate);
portalProfileRoutes.use("/profile/*", speakerGate);

const HEADSHOT_HELP_TEXT =
  "PNG, JPG, JPEG, or WEBP, up to 8 MB. Images are automatically downscaled to 512px on the longest edge before upload.";

// DEC-059: framework-free, ES5-safe inline script — downscales oversized
// headshots client-side (max edge 512px) before they hit the wire, so the
// 8 MB server-side cap in validateHeadshotUpload (src/domain/files.ts)
// rarely triggers for normal photos. On any failure (unsupported API,
// decode error, etc.) it leaves the original file input untouched and
// lets the server-side cap be the sole authority.
const HEADSHOT_DOWNSCALE_JS = `(function(){
  var MAX_EDGE = 512;
  var input = document.querySelector('input[name="headshot"]');
  if (!input) return;
  function toJpegFile(blob, originalName) {
    var base = originalName.replace(/\\.[^.]+$/, '');
    return new File([blob], base + '.jpg', { type: 'image/jpeg' });
  }
  function downscale(file) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      try {
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (w <= MAX_EDGE && h <= MAX_EDGE) {
          URL.revokeObjectURL(url);
          return;
        }
        var scale = MAX_EDGE / Math.max(w, h);
        var targetW = Math.round(w * scale);
        var targetH = Math.round(h * scale);
        var canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        var ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(url); return; }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        canvas.toBlob(function (blob) {
          URL.revokeObjectURL(url);
          if (!blob) return;
          try {
            var dt = new DataTransfer();
            dt.items.add(toJpegFile(blob, file.name));
            input.files = dt.files;
          } catch (e) {
            // Leave the original file in place; server-side cap decides.
          }
        }, 'image/jpeg', 0.85);
      } catch (e) {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }
  input.addEventListener('change', function () {
    try {
      var file = input.files && input.files[0];
      if (!file) return;
      downscale(file);
    } catch (e) {
      // Leave the original file in place; server-side cap decides.
    }
  });
})();`;

function ensureCsrfCookie(c: { req: { header(name: string): string | undefined } }): {
  token: string;
  setCookieIfNew: string | null;
} {
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const existing = cookies[CSRF_COOKIE_NAME];
  if (existing) return { token: existing, setCookieIfNew: null };
  const token = newCsrfToken();
  return { token, setCookieIfNew: `${CSRF_COOKIE_NAME}=${token}; Path=/; SameSite=Lax` };
}

function ProfilePage(props: {
  branding: { eventName: string; welcomeMessage: string | null; accentColor: string | null; logoUrl: string | null };
  profile: ContactProfile;
  csrfToken: string;
  error?: string;
  saved?: boolean;
}) {
  const { profile } = props;
  return (
    <PortalLayout branding={props.branding}>
      <a href="/portal">&larr; Back to My Submissions</a>
      <h2>My Profile</h2>
      {props.error ? <p role="alert">{props.error}</p> : null}
      {props.saved ? <p role="status">Profile saved.</p> : null}

      <section aria-label="Headshot">
        <h3>Headshot</h3>
        {profile.headshotUrl ? <img src={profile.headshotUrl} alt="" width={120} height={120} /> : <p>No headshot uploaded yet.</p>}
        <form method="post" action="/portal/profile/headshot" enctype="multipart/form-data">
          <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />
          <label>
            Upload a new headshot
            <input type="file" name="headshot" accept=".png,.jpg,.jpeg,.webp" required />
          </label>
          <p>{HEADSHOT_HELP_TEXT}</p>
          <button type="submit">Upload headshot</button>
        </form>
        <script dangerouslySetInnerHTML={{ __html: HEADSHOT_DOWNSCALE_JS }} />
      </section>

      <section aria-label="Profile details">
        <h3>Details</h3>
        <form method="post" action="/portal/profile">
          <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />
          <label>
            First name
            <input type="text" name="firstName" value={profile.firstName} required />
          </label>
          <label>
            Last name
            <input type="text" name="lastName" value={profile.lastName} required />
          </label>
          <label>
            Title
            <input type="text" name="title" value={profile.title ?? ""} />
          </label>
          <label>
            Company
            <input type="text" name="company" value={profile.company ?? ""} />
          </label>
          <label>
            Bio
            <textarea name="bio">{profile.bio ?? ""}</textarea>
          </label>
          <label>
            Twitter
            <input type="text" name="twitter" value={profile.socialLinks.twitter} />
          </label>
          <label>
            LinkedIn
            <input type="text" name="linkedin" value={profile.socialLinks.linkedin} />
          </label>
          <label>
            GitHub
            <input type="text" name="github" value={profile.socialLinks.github} />
          </label>
          <label>
            Website
            <input type="text" name="website" value={profile.socialLinks.website} />
          </label>
          <button type="submit">Save profile</button>
        </form>
      </section>
    </PortalLayout>
  );
}

async function loadProfile(c: { var: { db: any; auth?: AuthInfo } }) {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const [data, profile] = await Promise.all([
    getPortalData(c.var.db, contactId, auth.orgId),
    getContactProfile(c.var.db, contactId),
  ]);
  if (!profile) {
    // Fail loudly: a live speaker session with no contact row is data
    // corruption, not a recoverable 404 — assertSpeakerContactId already
    // guarantees auth.contactId is set for a speaker session.
    throw new Error(`No contact row for speaker contactId '${contactId}'`);
  }
  return { branding: data.branding, profile };
}

portalProfileRoutes.get("/profile", async (c) => {
  const { branding, profile } = await loadProfile(c);
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew);
  return c.html(<ProfilePage branding={branding} profile={profile} csrfToken={csrfToken} />);
});

portalProfileRoutes.post("/profile", csrfForm, async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const body = await c.req.parseBody();

  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  if (!firstName || !lastName) {
    const { branding, profile } = await loadProfile(c);
    const { token: csrfToken } = ensureCsrfCookie(c);
    return c.html(
      <ProfilePage branding={branding} profile={profile} csrfToken={csrfToken} error="First and last name are required." />,
      400,
    );
  }

  const socialLinks: SocialLinks = {
    twitter: String(body.twitter ?? ""),
    linkedin: String(body.linkedin ?? ""),
    github: String(body.github ?? ""),
    website: String(body.website ?? ""),
  };

  await updateContactProfile(c.var.db, contactId, {
    firstName,
    lastName,
    title: String(body.title ?? "").trim() || null,
    company: String(body.company ?? "").trim() || null,
    bio: String(body.bio ?? "").trim() || null,
    socialLinks,
  });

  const { branding, profile } = await loadProfile(c);
  const { token: csrfToken } = ensureCsrfCookie(c);
  return c.html(<ProfilePage branding={branding} profile={profile} csrfToken={csrfToken} saved />);
});

portalProfileRoutes.post("/profile/headshot", csrfForm, async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const body = await c.req.parseBody();
  const headshot = body["headshot"];

  if (!(headshot instanceof File)) {
    throw new ApiError("invalid", "headshot is required", { headshot: "Required" });
  }

  const validation = validateHeadshotUpload({ filename: headshot.name, sizeBytes: headshot.size });
  if (!validation.ok) {
    const { branding, profile } = await loadProfile(c);
    const { token: csrfToken } = ensureCsrfCookie(c);
    return c.html(
      <ProfilePage branding={branding} profile={profile} csrfToken={csrfToken} error={validation.message} />,
      400,
    );
  }

  const sanitized = sanitizeFilenameForKey(headshot.name);
  const r2Key = `headshot/${contactId}/${newId()}-${sanitized}`;
  const store = makeFileStore(c.env.FILES);
  const buf = await headshot.arrayBuffer();
  await store.put(r2Key, buf, validation.servedContentType);

  await setContactHeadshot(c.var.db, contactId, {
    filename: headshot.name,
    r2Key,
    sizeBytes: headshot.size,
    contentType: validation.servedContentType,
    uploadedByContactId: contactId,
  });

  const { branding, profile } = await loadProfile(c);
  const { token: csrfToken } = ensureCsrfCookie(c);
  return c.html(<ProfilePage branding={branding} profile={profile} csrfToken={csrfToken} saved />);
});

// -----------------------------------------------------------------------
// GET /headshots/:fileId — PUBLIC route (DEC-028): headshots of visible
// speakers are public content by definition (J10 renders them). 404 unless
// the file row's kind is 'headshot'; never routes through the authenticated
// /files/:fileId surface (in-flight w3-f, speaker/participant authz would
// 401 public pages).
// -----------------------------------------------------------------------
export const headshotServeRoutes = new Hono<AppEnv>();

headshotServeRoutes.get("/headshots/:fileId", async (c) => {
  const fileId = c.req.param("fileId");
  const scope = await getHeadshotFileScope(c.var.db, fileId);
  if (!scope) throw new ApiError("not_found", "Headshot not found");

  const store = makeFileStore(c.env.FILES);
  const obj = await store.get(scope.r2Key);
  if (!obj) throw new ApiError("not_found", "Headshot contents not found");

  const contentType = obj.contentType ?? scope.contentType;
  return c.body(obj.body, 200, {
    "Content-Type": contentType,
    // DEC-059: safe to cache immutably — every upload writes a fresh
    // random R2 key (see r2Key above), so a given fileId's contents never
    // change.
    "Cache-Control": "public, max-age=31536000, immutable",
  });
});
