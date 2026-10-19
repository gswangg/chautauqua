// Portal profile self-service (J7), per DEC-028 (portal splits into
// parallel sub-apps; headshots get kind 'headshot' + a /headshots route,
// gated per DEC-067) + DEC-012 (thin handlers: gate -> repo -> render) +
// DEC-020 (upload validation values) + DEC-005 (route map). Route files
// export a named Hono sub-app; only src/index.ts mounts it.

import { Hono } from "hono";
import { loadHome, mergeProfileFields } from "./home";
import { lockLine, type ProfileField, type ResolvedField } from "../../domain/portals/permissions";
import type { AppEnv, AuthInfo } from "../../server/env";
import { csrfForm } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { makeFileStore, putThenRecord } from "../../server/context";
import { assertSpeakerContactId, getPortalData } from "../../server/repo/portal";
import { DEC_067, DEC_084, DEC_894, DEC_154, DEC_576, DEC_385 } from "../../decisions";
import { readImageDims, MAX_HEADSHOT_EDGE_PX } from "../../lib/image-dims";
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH, MAX_LONG_TEXT_LENGTH } from "../../forms/validate";
import { overBudgetBy } from "../../domain/count-copy";
void DEC_067; // DEC-067: /headshots/:fileId gate — see headshotServeRoutes below.
void DEC_084; // DEC-084: server-side PNG/JPEG dimension gate on headshot upload — see below.
void DEC_894; // DEC-894: the dimension gate covers webp too — see below.
void DEC_154; // DEC-154 (wave 125): profile adopts the ONE SSR dock band — see profileDock below.
void DEC_576; // DEC-576 (wave-110/119): the dock is PortalLayout's real footer element, one copy at any width.
void DEC_385; // DEC-385: the phone override lives in portal.css.ts's terminal max-width block only.
import {
  getContactProfile,
  getHeadshotServeScope,
  setContactHeadshot,
  updateContactProfile,
  type ContactProfile,
  type SocialLinks,
} from "../../server/repo/profile";
import { CLIENT_CACHE_CONTROL } from "../../server/pubcache";
import {
  assertServedContentTypeHeader,
  sanitizeFilenameForKey,
  validateHeadshotUpload,
  HEADSHOT_EXTENSIONS,
  HEADSHOT_DOWNSCALE_EDGE_PX,
  HEADSHOT_DOWNSCALE_QUALITY,
  headshotHintText,
} from "../../domain/files";
import { newId } from "../../domain/ids";
import {
  CSRF_COOKIE_NAME,
  newCsrfToken,
  parseCookies,
  buildCsrfCookie,
  isSecureRequest,
} from "../../auth/cookies";
import { speakerGate, PortalLayout, PortalBackLink } from "./shared";

// Mounted at /portal in src/index.ts (DEC-012, declared union overlap with
// portalRoutes / portalTasksRoutes — all three sub-apps share the
// /portal/* prefix).
export const portalProfileRoutes = new Hono<AppEnv>();

portalProfileRoutes.use("/profile", speakerGate);
portalProfileRoutes.use("/profile/*", speakerGate);

const HEADSHOT_HELP_TEXT = `Images are automatically downscaled to ${HEADSHOT_DOWNSCALE_EDGE_PX}px on the longest edge before upload.`;

// DEC-059: framework-free, ES5-safe inline script — downscales oversized
// headshots client-side (max edge 512px) before they hit the wire, so the
// 8 MB server-side cap in validateHeadshotUpload (src/domain/files.ts)
// rarely triggers for normal photos. On any failure (unsupported API,
// decode error, etc.) it leaves the original file input untouched and
// lets the server-side cap be the sole authority.
const HEADSHOT_DOWNSCALE_JS = `(function(){
  var MAX_EDGE = ${HEADSHOT_DOWNSCALE_EDGE_PX};
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
        }, 'image/jpeg', ${HEADSHOT_DOWNSCALE_QUALITY});
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

function ensureCsrfCookie(c: {
  req: { header(name: string): string | undefined; url: string };
}): {
  token: string;
  setCookieIfNew: string | null;
} {
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const existing = cookies[CSRF_COOKIE_NAME];
  if (existing) return { token: existing, setCookieIfNew: null };
  const token = newCsrfToken();
  return {
    token,
    setCookieIfNew: buildCsrfCookie(token, { secure: isSecureRequest(c.req.url) }),
  };
}

// Multi-portal field permissions (Portals frame, flow 2 "Permissions ·
// fields"): a field a portal hides isn't shown; a view-only field shows the
// stored value read-only with its lock line ("Locked for your invited
// panel"); help text sits under the label. Email is never edited here (it is
// the login), so "edit" reads as view for it.
function FieldNote(props: { field: ResolvedField }) {
  const { field } = props;
  return (
    <>
      {field.help ? <p class="chq-portal-field-help">{field.help}</p> : null}
      {field.level === "view" && field.lockedBy ? (
        <p class="chq-portal-field-lock">
          <span class="chq-home-lock-word">Locked</span> {lockLine(field.lockedBy)}
        </p>
      ) : null}
    </>
  );
}

function ProfilePage(props: {
  branding: { eventName: string; welcomeMessage: string | null; accentColor: string | null; logoUrl: string | null };
  profile: ContactProfile;
  csrfToken: string;
  error?: string;
  saved?: boolean;
  headshotSavedMessage?: string;
  speakerName: string;
  fields?: Record<ProfileField, ResolvedField>;
}) {
  const { profile } = props;
  const fields = props.fields ?? mergeProfileFields([]);
  const ro = (f: ProfileField) => fields[f].level !== "edit";
  const shown = (f: ProfileField) => fields[f].level !== "hidden";
  // DEC-576 (wave-110/wave-119) + DEC-154 wave-125: the 390 frame's pinned
  // action band (docs/design/Chautauqua Public and Portal.dc.html:550-552
  // `<div style="flex-shrink:0; border-top:1px solid #1B1D17;
  // background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">`)
  // draws a Save primary through PortalLayout's dock slot, same call shape
  // as edit.tsx's editDock (:178-188) and index.tsx's session-detail dock
  // (:496-503) -- a single control referencing the form by id since the
  // dock renders inside <footer>, outside the profile form element. The
  // frame also draws a bordered Cancel here, but this page has no referent
  // for one (no "leave without saving" destination distinct from the
  // header/footer sign-out and back-link on screen) -- DEVIATIONS.md records the
  // omission per DEC-576's own "never manufactured just to fill the band"
  // rule (shared.tsx:163).
  const profileDock = (
    <button type="submit" form="chq-portal-profile-form" class="chq-portal-profile-dock chq-btn chq-btn-primary">Save profile</button>
  );
  return (
    <PortalLayout branding={props.branding} csrfToken={props.csrfToken} speakerName={props.speakerName} dock={profileDock}>
      <PortalBackLink to="/portal" />
      {/* DEC-576 (wave-16 amendment): docs/design/Chautauqua Public and
          Portal.dc.html:534 draws the H1 `Your profile` behind the back
          link -- a drill-in H1 takes the 25px register and the frame's
          literal copy. */}
      <h1 class="chq-portal-hero chq-portal-hero-drill">Your profile</h1>
      {props.error ? <p role="alert">{props.error}</p> : null}
      {props.saved ? <p role="status">Profile saved.</p> : null}
      {/* DEC-393 wave-142 (task w17-e): standalone row link (sole content of
          its own <p>, not a sentence phrase) -- real floor. */}
      <p><a class="chq-portal-standalone-link" href="/account/password">Change password</a></p>

      {/* DEC-574: ONE form for details + headshot — a speaker who edits the
          bio and then picks a new photo must not lose either. The headshot
          <input> lives inside this same multipart form; POST /portal/profile
          saves both fields and photo (if provided) in a single act. */}
      <form method="post" action="/portal/profile" id="chq-portal-profile-form" enctype="multipart/form-data">
        <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />

        {shown("headshot") ? (
        <section aria-label="Headshot" class="chq-section chq-portal-profile-head">
          {/* DEC-245: headshot success renders its own 'Headshot uploaded.'
              status, distinct from the details form's 'Profile saved.' */}
          {/* The alt names the person, matching the public speaker renderers
              (public/detail.tsx, public/speakers.tsx, both
              `${firstName} ${lastName}`). alt="" made the one image on this
              screen presentational — invisible to the a11y tree — so a screen
              reader met the "Headshot" heading with nothing under it and no
              way to tell a loaded photo from the empty-box branch. Built from
              profile.first/lastName, not props.speakerName, because that prop
              is a pre-joined string that can be "". */}
          {profile.headshotUrl ? (
            <img
              src={profile.headshotUrl}
              alt={`${profile.firstName} ${profile.lastName}`}
              width={64}
              height={64}
              class="chq-portal-avatar"
            />
          ) : (
            <div class="chq-portal-avatar" />
          )}
          <div class="chq-portal-facts" style="flex:1; min-width:200px">
            {/* w8-g (DEC-380 wave-133): frame :540 draws the visible label
                with its consequence clause attached -- headshotHintText
                (size/format hint) stays a separate line below. */}
            <h3 style="margin:0 0 4px">Headshot &middot; shown on the public speakers page</h3>
            {props.headshotSavedMessage ? <p role="status">{props.headshotSavedMessage}</p> : null}
            {/* DEC-576 wave-21: docs/design/Chautauqua Public and Portal.dc.html:541
                draws the control as a bordered pill (1px border, radius 6px, the
                surface-sunk fill, 44px floor, centred flex, 13px/600) reading
                `Replace`. Legal at every width -- DESIGN-RULINGS.md item 6 rules
                the portal has no separate desktop design, so this is not wrapped
                in a DEC-385 max-width block. Label text branches on
                profile.headshotUrl per clause (b): `Replace` when a headshot is
                already on file, `Add a headshot` when none exists yet -- one
                literal that is false for half the population is the DEC-029
                precedent this control follows. Clause (c): the redundant
                `No headshot uploaded yet.` paragraph the frame does not draw is
                deleted; the label's own text now carries that state. */}
            {ro("headshot") ? null : (
              <label class="chq-portal-headshot-pick">
                {profile.headshotUrl ? "Replace" : "Add a headshot"}
                <input
                  class="chq-portal-headshot-pick-input"
                  type="file"
                  name="headshot"
                  accept={HEADSHOT_EXTENSIONS.map((e) => `.${e}`).join(",")}
                />
              </label>
            )}
            {ro("headshot") ? null : <p class="chq-portal-detail">{headshotHintText()}</p>}
            <p class="chq-portal-sub">{HEADSHOT_HELP_TEXT}</p>
            <FieldNote field={fields.headshot} />
          </div>
        </section>
        ) : null}

        <section aria-label="Profile details" class="chq-section">
          <div class="chq-section-label">Details</div>
          {shown("firstName") ? (
            <div class="chq-portal-field">
              <label class="chq-portal-field-label" for="firstName">First name</label>
              <input class="chq-input" type="text" id="firstName" name="firstName" value={profile.firstName} maxLength={MAX_NAME_LENGTH} readonly={ro("firstName")} required />
              <FieldNote field={fields.firstName} />
            </div>
          ) : null}
          {shown("lastName") ? (
            <div class="chq-portal-field">
              <label class="chq-portal-field-label" for="lastName">Last name</label>
              <input class="chq-input" type="text" id="lastName" name="lastName" value={profile.lastName} maxLength={MAX_NAME_LENGTH} readonly={ro("lastName")} required />
              <FieldNote field={fields.lastName} />
            </div>
          ) : null}
          {shown("title") ? (
            <div class="chq-portal-field">
              <label class="chq-portal-field-label" for="title">Title</label>
              <input class="chq-input" type="text" id="title" name="title" value={profile.title ?? ""} maxLength={MAX_NAME_LENGTH} readonly={ro("title")} />
              <FieldNote field={fields.title} />
            </div>
          ) : null}
          {shown("company") ? (
            <div class="chq-portal-field">
              <label class="chq-portal-field-label" for="company">Company</label>
              <input class="chq-input" type="text" id="company" name="company" value={profile.company ?? ""} maxLength={MAX_NAME_LENGTH} readonly={ro("company")} />
              <FieldNote field={fields.company} />
            </div>
          ) : null}
          {shown("bio") ? (
          <div class="chq-portal-field">
            <label class="chq-portal-field-label" for="bio">Bio</label>
            {/* G13 (frame 10--07, MAJOR): rows=5 -- the default 2-row box
                clipped the speaker's own stored bio on first paint (the
                frame draws the box four lines tall). */}
            <textarea class="chq-textarea" id="bio" name="bio" rows={5} maxLength={MAX_LONG_TEXT_LENGTH} readonly={ro("bio")}>{profile.bio ?? ""}</textarea>
            <FieldNote field={fields.bio} />
          </div>
          ) : null}
          {shown("phone") ? (
            <div class="chq-portal-field">
              <label class="chq-portal-field-label" for="phone">Phone number</label>
              <input class="chq-input" type="tel" id="phone" name="phone" value={profile.phone ?? ""} maxLength={MAX_NAME_LENGTH} readonly={ro("phone")} />
              <FieldNote field={fields.phone} />
            </div>
          ) : null}
          {shown("email") ? (
            <div class="chq-portal-field">
              <label class="chq-portal-field-label" for="email">Email</label>
              <input class="chq-input" type="email" id="email" value={profile.email ?? ""} maxLength={MAX_TEXT_LENGTH} readOnly />
              <FieldNote field={fields.email} />
            </div>
          ) : null}
          {shown("social") ? (
            <div class="chq-portal-field">
              <label class="chq-portal-field-label" for="twitter">Twitter</label>
              <input class="chq-input" type="text" id="twitter" name="twitter" value={profile.socialLinks.twitter} maxLength={MAX_TEXT_LENGTH} readonly={ro("social")} />
            </div>
          ) : null}
          {shown("social") ? (
            <div class="chq-portal-field">
              <label class="chq-portal-field-label" for="linkedin">LinkedIn</label>
              <input class="chq-input" type="text" id="linkedin" name="linkedin" value={profile.socialLinks.linkedin} maxLength={MAX_TEXT_LENGTH} readonly={ro("social")} />
            </div>
          ) : null}
          {shown("social") ? (
            <div class="chq-portal-field">
              <label class="chq-portal-field-label" for="github">GitHub</label>
              <input class="chq-input" type="text" id="github" name="github" value={profile.socialLinks.github} maxLength={MAX_TEXT_LENGTH} readonly={ro("social")} />
            </div>
          ) : null}
          {shown("social") ? (
            <div class="chq-portal-field">
              <label class="chq-portal-field-label" for="website">Website</label>
              <input class="chq-input" type="text" id="website" name="website" value={profile.socialLinks.website} maxLength={MAX_TEXT_LENGTH} readonly={ro("social")} />
              <FieldNote field={fields.social} />
            </div>
          ) : null}
          {/* Wrapped in the generic .chq-portal-actions-footer (edit.tsx's
              same selector, portal.css.ts:608/900) so the terminal phone
              block's existing `display:none` rule stands this copy down at
              390 -- exactly one Save control visible at any width, the
              other being profileDock's docked copy above. */}
          <div class="chq-portal-actions-footer">
            <div class="chq-portal-actions">
              <button type="submit" class="chq-btn chq-btn-primary">Save profile</button>
            </div>
          </div>
        </section>
      </form>
      <script dangerouslySetInnerHTML={{ __html: HEADSHOT_DOWNSCALE_JS }} />
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
  const home = await loadHome(c.var.db, contactId, auth.orgId, Date.now(), { heal: false });
  return { branding: data.branding, profile, contactName: data.contactName, fields: mergeProfileFields(home.views) };
}

portalProfileRoutes.get("/profile", async (c) => {
  const { branding, profile, contactName, fields } = await loadProfile(c);
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew);
  const saved = c.req.query("saved") === "1";
  const headshotSavedMessage = c.req.query("headshot") === "1" ? "Headshot uploaded." : undefined;
  return c.html(
    <ProfilePage
      branding={branding}
      profile={profile}
      csrfToken={csrfToken}
      saved={saved}
      headshotSavedMessage={headshotSavedMessage}
      speakerName={contactName}
      fields={fields}
    />,
  );
});

// DEC-574: ONE multipart POST carries the details fields and the optional
// headshot file together, so a speaker who edits the bio and then picks a
// new photo never loses either — the previous split into
// POST /portal/profile (details) + POST /portal/profile/headshot (photo,
// its own PRG redirect) meant an upload discarded any unsaved bio edit.
// The now-redundant POST /portal/profile/headshot route is deleted rather
// than kept as a shim (house rule: no back-compat).
portalProfileRoutes.post("/profile", csrfForm, async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const body = await c.req.parseBody();

  let firstName = String(body.firstName ?? "").trim();
  let lastName = String(body.lastName ?? "").trim();
  let socialLinks: SocialLinks = {
    twitter: String(body.twitter ?? ""),
    linkedin: String(body.linkedin ?? ""),
    github: String(body.github ?? ""),
    website: String(body.website ?? ""),
  };
  let title = String(body.title ?? "").trim();
  let company = String(body.company ?? "").trim();
  let bio = String(body.bio ?? "").trim();
  const phoneInput = String(body.phone ?? "").trim();

  // Re-render on any validation failure with what the speaker just typed,
  // not the previously stored row — losing typed-but-unsaved edits on a
  // rejected submit would be its own data-loss path.
  const { branding, profile: storedProfile, contactName, fields } = await loadProfile(c);
  const { token: csrfToken } = ensureCsrfCookie(c);
  // multi-portal: a field the participant can't edit keeps its stored value,
  // whatever the form sent
  const editable = (f: ProfileField) => fields[f].level === "edit";
  if (!editable("firstName")) firstName = storedProfile.firstName;
  if (!editable("lastName")) lastName = storedProfile.lastName;
  if (!editable("title")) title = storedProfile.title ?? "";
  if (!editable("company")) company = storedProfile.company ?? "";
  if (!editable("bio")) bio = storedProfile.bio ?? "";
  if (!editable("social")) socialLinks = storedProfile.socialLinks;
  const phone = editable("phone") ? phoneInput || null : undefined;
  const submittedProfile: ContactProfile = {
    ...storedProfile,
    firstName,
    lastName,
    title: title || null,
    company: company || null,
    bio: bio || null,
    socialLinks,
  };
  const renderError = (error: string) =>
    c.html(
      <ProfilePage
        branding={branding}
        profile={submittedProfile}
        csrfToken={csrfToken}
        error={error}
        speakerName={contactName}
        fields={fields}
      />,
      400,
    );

  if (!firstName || !lastName) {
    return renderError("First and last name are required.");
  }

  // DEC-422: bound every free-text field before it reaches updateContactProfile
  // (portal profile had no length limit at all — an unbounded write to
  // `contact` could otherwise hit SQLITE_TOOBIG as a 500).
  const capped: Array<[string, string, number]> = [
    ["First name", firstName, MAX_NAME_LENGTH],
    ["Last name", lastName, MAX_NAME_LENGTH],
    ["Title", title, MAX_NAME_LENGTH],
    ["Company", company, MAX_NAME_LENGTH],
    ["Twitter", socialLinks.twitter, MAX_TEXT_LENGTH],
    ["LinkedIn", socialLinks.linkedin, MAX_TEXT_LENGTH],
    ["GitHub", socialLinks.github, MAX_TEXT_LENGTH],
    ["Website", socialLinks.website, MAX_TEXT_LENGTH],
    ["Bio", bio, MAX_LONG_TEXT_LENGTH],
    ["Phone number", phoneInput, MAX_NAME_LENGTH],
  ];
  for (const [label, value, max] of capped) {
    if (value.length > max) {
      return renderError(`${label} is ${overBudgetBy(value.length, max)} the limit. Nothing else was saved.`);
    }
  }

  // Optional headshot part: an <input type="file"> with nothing chosen
  // still submits a File with an empty name in multipart bodies — that's
  // "no file provided", not a validation failure. A File with a real name
  // is a deliberate upload attempt and runs the same gates the old
  // POST /portal/profile/headshot route ran.
  const headshotPart = body["headshot"];
  const hasHeadshot = editable("headshot") && headshotPart instanceof File && headshotPart.name !== "";
  let uploadedHeadshot = false;

  if (hasHeadshot) {
    const headshot = headshotPart as File;
    const validation = validateHeadshotUpload({ filename: headshot.name, sizeBytes: headshot.size });
    if (!validation.ok) {
      return renderError(validation.message);
    }

    const buf = await headshot.arrayBuffer();

    // DEC-084: server-side dimension gate, amending DEC-059's client-only
    // downscale — a client can always be bypassed. DEC-894: webp runs the
    // same gate as png/jpeg.
    if (
      validation.servedContentType === "image/png" ||
      validation.servedContentType === "image/jpeg" ||
      validation.servedContentType === "image/webp"
    ) {
      let dims: { width: number; height: number };
      try {
        dims = readImageDims(new Uint8Array(buf), validation.servedContentType);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Headshot image could not be read";
        return renderError(message);
      }
      if (dims.width > MAX_HEADSHOT_EDGE_PX || dims.height > MAX_HEADSHOT_EDGE_PX) {
        return renderError(
          "Headshot is larger than 2048px on its longest edge — please upload a smaller image (the portal resizes automatically in modern browsers).",
        );
      }
    }

    const sanitized = sanitizeFilenameForKey(headshot.name);
    const r2Key = `headshot/${contactId}/${newId()}-${sanitized}`;
    const store = makeFileStore(c.env.FILES);
    await putThenRecord(store, r2Key, buf, validation.servedContentType, () =>
      setContactHeadshot(c.var.db, contactId, {
        filename: headshot.name,
        r2Key,
        sizeBytes: headshot.size,
        contentType: validation.servedContentType,
        uploadedByContactId: contactId,
      }),
    );
    uploadedHeadshot = true;
  }

  await updateContactProfile(c.var.db, contactId, {
    firstName,
    lastName,
    title: title || null,
    company: company || null,
    bio: bio || null,
    socialLinks,
    ...(phone !== undefined ? { phone } : {}),
  });

  // Redirect (PRG) rather than re-rendering directly: a fresh GET picks up
  // the newly-saved fields and headshot, and ?saved=1 (plus ?headshot=1
  // when a photo was part of this submit) renders the right success notice
  // (DEC-245's 'Headshot uploaded.' stays distinct from 'Profile saved.').
  const redirectUrl = uploadedHeadshot ? "/portal/profile?saved=1&headshot=1" : "/portal/profile?saved=1";
  return c.redirect(redirectUrl, 302);
});

// -----------------------------------------------------------------------
// GET /headshots/:fileId — gated route (DEC-028 origin, DEC-067 gate):
// headshots of visible speakers are public content by definition (J10
// renders them), but a not-yet-visible speaker's headshot is private —
// only the owning speaker or a same-org organizer may preview it, and a
// superseded (no-longer-referenced) fileId 404s for everyone. Never routes
// through the authenticated /files/:fileId surface (speaker/participant
// authz there would 401 the public pages). sessionLoader runs "*" ahead of
// every sub-app mount (src/server/app.ts), so c.var.auth is already
// populated here with no extra wiring needed.
// -----------------------------------------------------------------------
export const headshotServeRoutes = new Hono<AppEnv>();

headshotServeRoutes.get("/headshots/:fileId", async (c) => {
  const fileId = c.req.param("fileId");
  const scope = await getHeadshotServeScope(c.var.db, fileId);
  if (!scope) throw new ApiError("not_found", "Headshot not found");

  let cacheControl: string;
  if (scope.publiclyVisible) {
    // DEC-059 (amended wave 70): immutable may describe BYTES (every
    // upload writes a fresh random R2 key, see r2Key above, so a given
    // fileId's contents never change) but must never describe an
    // AUTHORIZATION OUTCOME — this scope flips to private the moment the
    // speaker is un-published, and no purge path reaches /headshots/*.
    // Share the same short-lived, revalidating budget as the public pages
    // that embed this image, so both expire on one clock.
    cacheControl = CLIENT_CACHE_CONTROL;
  } else {
    const auth = c.var.auth;
    const authorized =
      !!auth &&
      ((auth.role === "organizer" && auth.orgId === scope.orgId) ||
        (auth.role === "speaker" && auth.contactId === scope.contactId));
    // Never leak existence to an unauthorized caller — 404, not 401/403.
    if (!authorized) throw new ApiError("not_found", "Headshot not found");
    cacheControl = "private, max-age=0";
  }

  const store = makeFileStore(c.env.FILES);
  const obj = await store.get(scope.r2Key);
  if (!obj) throw new ApiError("not_found", "Headshot contents not found");

  const contentType = assertServedContentTypeHeader(scope.contentType);
  // Vary: Cookie — the same URL answers 404 to a stranger and 200 to the
  // owning speaker/organizer while a headshot is private, so a shared
  // cache must never mix the two responses.
  return c.body(obj.body, 200, {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    Vary: "Cookie",
  });
});
