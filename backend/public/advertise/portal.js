// FlipPilot advertising portal. Plain JavaScript, no outside scripts: talks only to this server.
// Screens by address: #/ (welcome), #/sign-in, #/business, #/adverts, #/new, #/advert/<id>, #/edit/<id>

import { esc, previewFeed, PREVIEW } from "./previews.js";

const TOKEN_KEY = "flippilot-ads-token";
const app = document.getElementById("app");
const nav = document.getElementById("nav");

/* ---------------- small helpers ---------------- */

const pounds = (pence) => { const v = pence / 100; return "£" + (Number.isInteger(v) ? v : v.toFixed(2)); };
const dateUK = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const todayISO = () => new Date().toISOString().slice(0, 10);
const $ = (sel, root = app) => root.querySelector(sel);
const $$ = (sel, root = app) => [...root.querySelectorAll(sel)];

function token() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } }
function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} }

function toast(msg, ms = 3800) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, ms);
}

async function api(method, path, body) {
  const headers = { "content-type": "application/json" };
  const t = token();
  if (t) headers.authorization = `Bearer ${t}`;
  let res;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    return { ok: false, status: 0, data: { error: "We couldn't reach FlipPilot. Check your connection and try again." } };
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && t) {
    setToken(null);
    state.me = null;
    go("#/sign-in");
  }
  return { ok: res.ok, status: res.status, data };
}
const errorOf = (r) => r.data?.message || r.data?.error || "Something went wrong. Please try again.";

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

/** Reads a picture the business chose, shrinks it if it's big, and hands back a data URL. */
function readPicture(file, { maxSide = 1600, keepPng = false, minWidth = 0 } = {}) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error("Please choose a JPEG, PNG or WebP picture."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That picture couldn't be read."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That picture couldn't be opened."));
      img.onload = () => {
        if (minWidth && img.naturalWidth < minWidth) return reject(new Error(`That design is ${img.naturalWidth} pixels wide: it needs to be at least ${minWidth}.`));
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        const g = c.getContext("2d");
        if (!keepPng) { g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); }
        g.drawImage(img, 0, 0, c.width, c.height);
        let out = keepPng ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.86);
        if (out.length > 3.9e6) out = c.toDataURL("image/jpeg", 0.72);
        if (out.length > 3.9e6) return reject(new Error("That picture is too big, even made smaller. Try a smaller one."));
        resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------------- state ---------------- */

const state = { me: null, loadingMe: null };

async function loadMe(force = false) {
  if (!token()) { state.me = null; return null; }
  if (state.me && !force) return state.me;
  const r = await api("GET", "/advertiser/me");
  state.me = r.ok ? r.data : null;
  return state.me;
}

function drawNav() {
  if (!token()) {
    nav.innerHTML = `<a class="btn small quiet" href="#/sign-in">Sign in</a><a class="btn small primary" href="#/sign-in">Start advertising</a>`;
    return;
  }
  nav.innerHTML = `
    <a class="btn small quiet" href="#/adverts">My adverts</a>
    <a class="btn small quiet" href="#/business">Business details</a>
    <a class="btn small primary" href="#/new">New advert</a>
    <button class="btn small quiet" id="signOut" type="button">Sign out</button>`;
  $("#signOut", nav).addEventListener("click", async () => {
    await api("POST", "/auth/logout", {});
    setToken(null);
    state.me = null;
    go("#/");
    toast("Signed out.");
  });
}

/* ---------------- placements: names and what they are ---------------- */

const PLACES = [
  { id: "messages", title: "Messages banner", what: "A card at the top of the inbox, where people talk to buyers and sellers." },
  { id: "feed", title: "Marketplace feed", what: "A sponsored card between listings, about every six listings." },
  { id: "scan-panel", title: "Scan cross-over", what: "You and one other advertiser share the screen while a scan is looked up." },
  { id: "scan-full", title: "Scan full page", what: "The whole screen while a scan is looked up, on your turn. Up to 3 per area." },
];

const STATE_TEXT = {
  "in-review": ["warn", "Being checked"],
  "awaiting-payment": ["gold", "Approved: pay to go live"],
  rejected: ["bad", "Needs a change"],
  "starting-soon": ["ok", "Paid: starts soon"],
  live: ["ok", "Live"],
  "live-until-end": ["ok", "Live until the end of the month"],
  "payment-due": ["bad", "Payment due"],
  paused: ["bad", "Paused"],
  ended: ["", "Ended"],
  withdrawn: ["", "Withdrawn"],
};
const stateBadge = (s) => { const [k, t] = STATE_TEXT[s] ?? ["", s]; return `<span class="pill ${k}"><span class="dot"></span>${esc(t)}</span>`; };

/* ---------------- screens ---------------- */

async function screenWelcome() {
  if (token()) { await loadMe(); if (state.me) return go("#/adverts"); }
  app.innerHTML = `
  <div class="stack-lg">
    <section class="hero">
      <div class="stack">
        <span class="label">Advertise in the FlipPilot app</span>
        <h1>Put your business in front of local buyers and sellers.</h1>
        <p class="lede">FlipPilot is a UK app for reselling and second-hand buying. Your advert appears in the moments people already use it, clearly marked as sponsored, to people near you. Add your logo and photos, see exactly how it looks, and go live once we've checked it.</p>
        <div class="offer"><span style="font-size:1.4rem">★</span><div><b>Half price for your first 2 months.</b><div class="small muted">Prices below cover people within 10, 25 or 50 miles of you. No VAT is added.</div></div></div>
        <div class="row"><a class="btn primary" href="#/sign-in">Start advertising</a><button class="btn" type="button" id="howBtn">How it works</button></div>
      </div>
      <div>${previewFeed({ title: "Your headline here", tagline: "A short line about what you offer", photo: null, logo: "icon.png", name: "Your business", cta: "website" })}</div>
    </section>

    <section class="stack">
      <h2>Where your advert can appear</h2>
      <div class="grid-4">
        ${PLACES.map((p) => `<div class="card flat stack" style="gap:6px"><h3>${esc(p.title)}</h3><p class="small muted">${esc(p.what)}</p><p style="font:800 1.3rem var(--display)" class="num">${{ messages: "£15", feed: "£25", "scan-panel": "£29", "scan-full": "£99" }[p.id]} <small class="muted" style="font:500 .85rem var(--body)">a month</small></p></div>`).join("")}
      </div>
      <p class="muted">All three shared places (Messages, feed and cross-over) together: <b class="num">£59</b> a month. The scan full page can go with Messages and the feed, but not with the cross-over: it takes the whole scan screen.</p>
    </section>

    <section class="stack" id="how">
      <h2>How it works</h2>
      <ol class="steps">
        <li class="card flat"><h3>Your business</h3><p class="small muted">Sign in with your email, add your name, logo, website, phone and address.</p></li>
        <li class="card flat"><h3>Your advert</h3><p class="small muted">Pick where and your area, add photos and words, and choose a Visit, Call or Directions button. See it exactly as people will.</p></li>
        <li class="card flat"><h3>We check it</h3><p class="small muted">A person reads every advert, usually within one working day. Nothing is charged before it's approved.</p></li>
        <li class="card flat"><h3>Pay and go live</h3><p class="small muted">Pay monthly by card, cancel any time. Follow views, taps and saves by day.</p></li>
      </ol>
    </section>

    <section class="card stack">
      <h2>Honest numbers</h2>
      <p class="muted">You see how many times your advert was shown, tapped and saved, by day, as counted by the app. We're new and our audience is growing, so we don't promise a number of views: that's why the first two months are half price.</p>
    </section>
  </div>`;
  $("#howBtn").addEventListener("click", () => $("#how").scrollIntoView({ behavior: "smooth", block: "start" }));
}

async function screenSignIn() {
  if (token()) { await loadMe(); if (state.me) return go(state.me.profile ? "#/adverts" : "#/business"); }
  app.innerHTML = `
  <div class="signin stack-lg" style="margin:0 auto">
    <div class="stack"><h1 style="font-size:2rem">Sign in</h1><p class="muted">We'll email you a code. No password to remember. Use the same email as your FlipPilot app, if you have one.</p></div>
    <form id="emailForm" class="card stack" novalidate>
      <label class="field"><span>Your email</span><input id="email" type="email" autocomplete="email" required></label>
      <p class="error" id="emailErr" role="alert"></p>
      <button class="btn primary" type="submit">Email me a code</button>
    </form>
    <form id="codeForm" class="card stack" hidden novalidate>
      <p>We've sent a 6-digit code to <b id="sentTo"></b>. It works for 10 minutes; check your junk folder too.</p>
      <label class="field"><span>Code</span><input id="code" class="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label>
      <p class="error" id="codeErr" role="alert"></p>
      <div class="row"><button class="btn primary" type="submit">Sign in</button><button class="btn quiet" type="button" id="again">Use another email</button></div>
      <p class="small muted" id="devCode"></p>
    </form>
  </div>`;
  let email = "";
  $("#email").focus();
  $("#emailForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    email = $("#email").value.trim();
    $("#emailErr").textContent = "";
    const r = await api("POST", "/auth/request-code", { email });
    if (!r.ok) { $("#emailErr").textContent = errorOf(r); return; }
    $("#sentTo").textContent = email;
    $("#emailForm").hidden = true;
    $("#codeForm").hidden = false;
    if (r.data.devCode) $("#devCode").textContent = `Test server: your code is ${r.data.devCode}`;
    $("#code").focus();
  });
  $("#again").addEventListener("click", () => { $("#codeForm").hidden = true; $("#emailForm").hidden = false; $("#email").focus(); });
  $("#codeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#codeErr").textContent = "";
    const r = await api("POST", "/auth/verify", { email, code: $("#code").value.trim() });
    if (!r.ok) { $("#codeErr").textContent = errorOf(r); return; }
    setToken(r.data.token);
    const me = await loadMe(true);
    drawNav();
    go(me?.profile ? "#/adverts" : "#/business");
  });
}

async function needMe() {
  if (!token()) { go("#/sign-in"); return null; }
  const me = await loadMe();
  if (!me) { go("#/sign-in"); return null; }
  return me;
}

async function screenBusiness() {
  const me = await needMe();
  if (!me) return;
  const p = me.profile ?? {};
  let logo = null; // new logo as a data URL
  let removeLogo = false;
  app.innerHTML = `
  <div class="stack-lg" style="max-width:760px;margin:0 auto">
    <div class="stack"><h1 style="font-size:2rem">${me.profile ? "Business details" : "Tell us about your business"}</h1><p class="muted">These go on every advert you book, so you set them once. Signed in as ${esc(me.email)}.</p></div>
    <form id="biz" class="card stack" novalidate>
      <div class="row" style="align-items:flex-start;gap:18px">
        <div class="logo-box" id="logoBox">${p.logo ? `<img src="${esc(p.logo)}" alt="Your logo">` : `<span class="small muted">Logo</span>`}</div>
        <div class="stack" style="gap:8px;flex:1;min-width:220px">
          <b>Your logo</b><span class="small muted">A square picture works best. PNG with a see-through background looks smartest.</span>
          <div class="row"><label class="btn small"><input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp" hidden>Choose a logo</label>${p.logo ? `<button class="btn small quiet danger" type="button" id="rmLogo">Remove</button>` : ""}</div>
        </div>
      </div>
      <label class="field"><span>Business name</span><input id="name" maxlength="80" value="${esc(p.businessName)}" required></label>
      <div class="grid-2">
        <label class="field"><span>Website <span class="muted">(optional)</span></span><input id="web" type="url" placeholder="yourbusiness.co.uk" value="${esc(p.website)}"><span class="hint">For a Visit button.</span></label>
        <label class="field"><span>Phone <span class="muted">(optional)</span></span><input id="phone" type="tel" placeholder="0113 496 0000" value="${esc(p.phone)}"><span class="hint">For a Call button.</span></label>
      </div>
      <label class="field"><span>Address <span class="muted">(optional)</span></span><input id="addr" maxlength="160" placeholder="12 High Street, Leeds" value="${esc(p.address)}"><span class="hint">For a Directions button.</span></label>
      <label class="field" style="max-width:240px"><span>Postcode</span><input id="pc" placeholder="LS1 1AA" value="${esc(p.postcode)}"><span class="hint">Your adverts reach people around here.</span></label>
      ${me.profile?.termsAcceptedAt ? "" : `<label class="check"><input type="checkbox" id="terms"><span>I've read and accept the <a href="terms" target="_blank" rel="noopener">advertiser terms</a>.</span></label>`}
      <p class="error" id="bizErr" role="alert"></p>
      <div class="row"><button class="btn primary" type="submit">${me.profile ? "Save" : "Save and continue"}</button>${me.profile ? `<a class="btn quiet" href="#/adverts">Back</a>` : ""}</div>
    </form>
  </div>`;
  $("#logoFile").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      logo = await readPicture(f, { maxSide: 600, keepPng: true });
      removeLogo = false;
      $("#logoBox").innerHTML = `<img src="${logo}" alt="Your new logo">`;
    } catch (err) { $("#bizErr").textContent = err.message; }
  });
  $("#rmLogo")?.addEventListener("click", () => { removeLogo = true; logo = null; $("#logoBox").innerHTML = `<span class="small muted">Logo</span>`; });
  $("#biz").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      businessName: $("#name").value.trim(),
      website: $("#web").value.trim(),
      phone: $("#phone").value.trim(),
      address: $("#addr").value.trim(),
      postcode: $("#pc").value.trim(),
    };
    if (logo) body.logoBase64 = logo;
    if (removeLogo) body.removeLogo = true;
    if ($("#terms")) body.acceptTerms = $("#terms").checked;
    $("#bizErr").textContent = "";
    const r = await api("PUT", "/advertiser/profile", body);
    if (!r.ok) { $("#bizErr").textContent = errorOf(r); return; }
    await loadMe(true);
    toast("Business details saved.");
    go(me.adverts.length ? "#/adverts" : "#/new");
  });
}

async function screenAdverts() {
  const me = await needMe();
  if (!me) return;
  if (!me.profile) return go("#/business");
  const ads = me.adverts;
  app.innerHTML = `
  <div class="stack-lg">
    <div class="spread"><div class="stack" style="gap:4px"><h1 style="font-size:2rem">${esc(me.profile.businessName)}</h1><p class="muted">Your adverts, their status and how they're doing.</p></div><a class="btn primary" href="#/new">Book a new advert</a></div>
    ${ads.length === 0 ? `<div class="card empty stack" style="align-items:center"><h2>No adverts yet</h2><p class="muted">Book your first one: it takes about five minutes, and half price for 2 months.</p><a class="btn primary" href="#/new">Book an advert</a></div>` : `
    <div class="ads">
      ${ads.map((a) => `
        <a class="card ad-row" href="#/advert/${esc(a.id)}">
          <div class="thumbnail" style="background-image:url('${esc(a.artwork || a.image || "")}')"></div>
          <div class="stack" style="gap:4px;min-width:0">
            <div class="row" style="gap:8px">${stateBadge(a.state)}<span class="small muted">${esc(a.placementNames.join(" · "))}</span></div>
            <h3 style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.title)}</h3>
            <p class="small muted">${a.area === "nationwide" ? "Nationwide" : `Within ${a.area.radiusMiles} miles of ${esc(a.area.postcode)}`} · from ${dateUK(a.startsAt)}</p>
          </div>
          <div class="end stack" style="gap:2px;text-align:right">
            <b class="num">${a.booking ? pounds(a.booking.monthlyPence) : ""}<span class="small muted"> a month</span></b>
            <span class="small muted num">${a.totals.views} shown · ${a.totals.taps} taps</span>
          </div>
        </a>`).join("")}
    </div>`}
  </div>`;
}

/* ---------------- the builder (new and edit) ---------------- */

async function screenBuilder(editId) {
  const me = await needMe();
  if (!me) return;
  if (!me.profile) return go("#/business");
  const existing = editId ? me.adverts.find((a) => a.id === editId) : null;
  if (editId && !existing) return go("#/adverts");
  const paid = existing && ["active", "cancelling"].includes(existing.booking?.status);
  const p = me.profile;

  const b = {
    placements: new Set(existing ? existing.placements : ["feed"]),
    radiusMiles: existing && existing.area !== "nationwide" ? existing.area.radiusMiles : 25,
    postcode: existing && existing.area !== "nationwide" ? existing.area.postcode : p.postcode || "",
    startsAt: existing ? existing.startsAt.slice(0, 10) : todayISO(),
    title: existing?.title ?? "",
    tagline: existing?.tagline ?? "",
    description: existing?.description ?? "",
    cta: existing?.cta ?? (p.website ? "website" : p.phone ? "call" : "directions"),
    photos: existing ? [...existing.images].filter((u) => u !== existing.artwork) : [],
    photosChanged: false,
    artwork: existing?.artwork ?? null,
    artworkChanged: false,
    quote: null,
    availability: null,
    previewTab: null,
  };

  app.innerHTML = `
  <div class="stack-lg">
    <div class="stack" style="gap:4px"><a class="small" href="${existing ? `#/advert/${esc(existing.id)}` : "#/adverts"}">← Back</a><h1 style="font-size:2rem">${existing ? "Change your advert" : "Book an advert"}</h1><p class="muted">${existing ? "Changes are read by a person before they show. " : ""}Everything updates the preview as you go.</p></div>
    <div class="builder">
      <div class="stack-lg">
        <section class="card stack" ${paid ? "hidden" : ""}>
          <div class="section-title"><span class="n">1</span><h2>Where and when</h2></div>
          <div class="choices" id="places"></div>
          <p class="small muted" id="placeHint"></p>
          <div class="grid-2">
            <label class="field"><span>Centred on</span><input id="pc" value="${esc(b.postcode)}" placeholder="LS1 1AA"></label>
            <label class="field"><span>Reach people within</span><select id="radius">${[10, 25, 50].map((m) => `<option value="${m}" ${m === b.radiusMiles ? "selected" : ""}>${m} miles</option>`).join("")}</select></label>
          </div>
          <p class="error" id="areaErr" role="alert"></p>
          <label class="field" style="max-width:260px"><span>Start date</span><input id="start" type="date" min="${todayISO()}" value="${esc(b.startsAt)}"><span class="hint">It runs monthly from here until you cancel.</span></label>
          <p class="small muted">Want the whole country? <a href="mailto:flippilot@hotmail.com?subject=Nationwide%20advert">Ask us for a nationwide price</a>.</p>
        </section>

        <section class="card stack">
          <div class="section-title"><span class="n">${paid ? 1 : 2}</span><h2>Your advert</h2></div>
          <label class="field"><span>Headline</span><input id="title" maxlength="80" value="${esc(b.title)}" placeholder="Vintage furniture, fairly priced"><span class="count" data-for="title"></span></label>
          <label class="field"><span>Short line <span class="muted">(optional)</span></span><input id="tagline" maxlength="120" value="${esc(b.tagline)}" placeholder="New stock every Saturday"><span class="count" data-for="tagline"></span></label>
          <label class="field"><span>Description <span class="muted">(optional, shown on the full page)</span></span><textarea id="description" maxlength="300" placeholder="What you offer, in a sentence or two.">${esc(b.description)}</textarea><span class="count" data-for="description"></span></label>
          <p class="small muted">Please don't put phone numbers, emails or web addresses in the words: your button does that.</p>
          <div class="stack" style="gap:8px"><b>The button on your advert</b><div class="choices" id="ctas"></div></div>
          <div class="stack" style="gap:8px">
            <b>Photos</b><span class="small muted">Up to 3. The first is the main one. Landscape photos look best.</span>
            <div class="thumbs" id="thumbs"></div>
            <label class="drop" id="drop"><input type="file" id="photoFile" accept="image/png,image/jpeg,image/webp" multiple hidden><b>Add photos</b><span class="small muted">JPEG, PNG or WebP. Tap to choose, or drop them here.</span></label>
          </div>
          <div class="stack" style="gap:8px" id="artBox">
            <b>Your own full-page design <span class="muted">(optional, scan full page only)</span></b>
            <span class="small muted">A finished portrait design, 1080 × 1920 is ideal (at least 720 pixels wide). It fills the screen instead of our layout.</span>
            <div class="row" id="artRow"></div>
          </div>
          <p class="error" id="formErr" role="alert"></p>
        </section>
      </div>

      <aside class="stack sticky">
        <section class="card stack">
          <div class="spread"><h3>Preview</h3><div class="tabs" id="tabs"></div></div>
          <div id="preview"></div>
        </section>
        <section class="card stack summary" id="summary"></section>
      </aside>
    </div>
  </div>`;

  /* --- where --- */
  function drawPlaces() {
    const avail = Object.fromEntries((b.availability ?? []).map((a) => [a.placement, a]));
    $("#places").innerHTML = PLACES.map((pl) => {
      const on = b.placements.has(pl.id);
      const a = avail[pl.id];
      const full = a && a.placesLeft === 0 && !on;
      const left = a && a.limit ? (a.placesLeft === 0 ? `<span class="left" style="color:var(--bad)">Fully booked here</span>` : `<span class="left gold">${a.placesLeft} of ${a.limit} places left</span>`) : `<span class="left muted">Shared with other advertisers</span>`;
      return `<label class="choice ${on ? "on" : ""} ${full ? "off" : ""}"><input type="checkbox" value="${pl.id}" ${on ? "checked" : ""} ${full ? "disabled" : ""}><span class="tick">${on ? "✓" : ""}</span><b>${esc(pl.title)}</b><span class="small muted">${esc(pl.what)}</span><span class="price num">${pounds(me.prices.monthlyPence[pl.id])} <small>a month</small></span>${left}</label>`;
    }).join("");
    $$("#places input").forEach((i) => i.addEventListener("change", () => {
      if (i.checked) {
        b.placements.add(i.value);
        if (i.value === "scan-full") b.placements.delete("scan-panel");
        if (i.value === "scan-panel") b.placements.delete("scan-full");
      } else b.placements.delete(i.value);
      if (!b.placements.has(b.previewTab)) b.previewTab = null;
      drawPlaces(); drawArt(); drawPreview(); requote();
    }));
    const hint = b.placements.has("scan-full") ? "The full page replaces the cross-over on scans, so you can't have both." : b.placements.size === 3 && !b.placements.has("scan-full") ? `All three shared places: ${pounds(me.prices.sharedBundlePence)} a month instead of ${pounds(1500 + 2500 + 2900)}.` : "";
    $("#placeHint").textContent = hint;
  }
  $("#pc")?.addEventListener("change", (e) => { b.postcode = e.target.value.trim(); requote(); });
  $("#radius")?.addEventListener("change", (e) => { b.radiusMiles = Number(e.target.value); requote(); });
  $("#start")?.addEventListener("change", (e) => { b.startsAt = e.target.value; requote(); });

  /* --- words --- */
  for (const id of ["title", "tagline", "description"]) {
    const el = $("#" + id);
    const count = $(`.count[data-for="${id}"]`);
    const upd = () => { b[id] = el.value; count.textContent = `${el.value.length} / ${el.maxLength}`; drawPreview(); };
    el.addEventListener("input", upd);
    upd();
  }
  function drawCtas() {
    const opts = [
      { id: "website", t: "Visit website", ok: !!p.website, why: "Add your website in Business details" },
      { id: "call", t: "Call you", ok: !!p.phone, why: "Add your phone number in Business details" },
      { id: "directions", t: "Directions", ok: !!p.address, why: "Add your address in Business details" },
    ];
    $("#ctas").innerHTML = opts.map((o) => `<label class="choice ${b.cta === o.id ? "on" : ""} ${o.ok ? "" : "off"}" style="padding:12px"><input type="radio" name="cta" value="${o.id}" ${b.cta === o.id ? "checked" : ""} ${o.ok ? "" : "disabled"}><span class="tick">${b.cta === o.id ? "✓" : ""}</span><b>${o.t}</b>${o.ok ? "" : `<span class="small muted">${o.why}</span>`}</label>`).join("");
    $$("#ctas input").forEach((i) => i.addEventListener("change", () => { b.cta = i.value; drawCtas(); drawPreview(); }));
  }

  /* --- pictures --- */
  function drawThumbs() {
    $("#thumbs").innerHTML = b.photos.map((src, i) => `<div class="thumb"><img src="${esc(src)}" alt="Photo ${i + 1}">${i === 0 ? `<span class="first">MAIN</span>` : ""}<button class="x" type="button" data-i="${i}" aria-label="Remove photo ${i + 1}">×</button></div>`).join("");
    $$("#thumbs .x").forEach((x) => x.addEventListener("click", () => { b.photos.splice(Number(x.dataset.i), 1); b.photosChanged = true; drawThumbs(); drawPreview(); }));
    $("#drop").hidden = b.photos.length >= 3;
  }
  async function addPhotos(files) {
    $("#formErr").textContent = "";
    for (const f of [...files]) {
      if (b.photos.length >= 3) break;
      try { b.photos.push(await readPicture(f)); b.photosChanged = true; } catch (err) { $("#formErr").textContent = err.message; }
    }
    drawThumbs(); drawPreview();
  }
  $("#photoFile").addEventListener("change", (e) => addPhotos(e.target.files));
  const drop = $("#drop");
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); addPhotos(e.dataTransfer.files); });

  function drawArt() {
    $("#artBox").hidden = !b.placements.has("scan-full");
    $("#artRow").innerHTML = b.artwork
      ? `<div class="thumb" style="width:72px;height:128px"><img src="${esc(b.artwork)}" alt="Your design"></div><button class="btn small quiet danger" type="button" id="rmArt">Remove design</button>`
      : `<label class="btn small"><input type="file" id="artFile" accept="image/png,image/jpeg,image/webp" hidden>Upload a design</label>`;
    $("#rmArt")?.addEventListener("click", () => { b.artwork = null; b.artworkChanged = true; drawArt(); drawPreview(); });
    $("#artFile")?.addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { b.artwork = await readPicture(f, { maxSide: 2400, minWidth: 720 }); b.artworkChanged = true; drawArt(); drawPreview(); } catch (err) { $("#formErr").textContent = err.message; }
    });
  }

  /* --- preview --- */
  function drawPreview() {
    const list = PLACES.filter((pl) => b.placements.has(pl.id));
    if (!b.previewTab || !b.placements.has(b.previewTab)) b.previewTab = list[0]?.id ?? "feed";
    $("#tabs").innerHTML = list.map((pl) => `<button type="button" data-tab="${pl.id}" aria-pressed="${pl.id === b.previewTab}">${esc(pl.title.replace("Scan ", "Scan: "))}</button>`).join("");
    $$("#tabs button").forEach((t) => t.addEventListener("click", () => { b.previewTab = t.dataset.tab; drawPreview(); }));
    const c = { title: b.title, tagline: b.tagline, description: b.description, photo: b.photos[0] ?? null, logo: p.logo, name: p.businessName, cta: b.cta, artwork: b.previewTab === "scan-full" ? b.artwork : null };
    $("#preview").innerHTML = (PREVIEW[b.previewTab] ?? previewFeed)(c) + `<p class="small muted" style="text-align:center;margin-top:10px">How it looks in the app. The "Sponsored" label is always shown.</p>`;
  }

  /* --- price --- */
  let quoteTimer = null;
  function requote() {
    clearTimeout(quoteTimer);
    quoteTimer = setTimeout(async () => {
      if (paid) return drawSummary();
      const r = await api("POST", "/advertiser/quote", { placements: [...b.placements], postcode: b.postcode, radiusMiles: b.radiusMiles, startsAt: b.startsAt });
      const areaErr = $("#areaErr");
      if (r.ok) { b.quote = r.data.quote; b.availability = r.data.availability; if (areaErr) areaErr.textContent = ""; }
      else { b.quote = { ok: false, error: errorOf(r) }; b.availability = null; if (areaErr) areaErr.textContent = errorOf(r); }
      drawPlaces(); drawSummary();
    }, 250);
  }
  function drawSummary() {
    const q = paid ? { ok: true, lines: [], monthlyPence: existing.booking.monthlyPence, launchMonthlyPence: null, launchMonths: 0 } : b.quote;
    const s = $("#summary");
    if (!q) { s.innerHTML = `<h3>Your price</h3><p class="muted">Choose where your advert goes to see its price.</p>`; return; }
    if (!q.ok) { s.innerHTML = `<h3>Your price</h3><p class="muted">${esc(q.error)}</p>`; return; }
    s.innerHTML = `
      <h3>${paid ? "Your booking" : "Your price"}</h3>
      ${q.lines.map((l) => `<div class="line"><span>${esc(l.name)}</span><span class="num">${pounds(l.monthlyPence)}</span></div>`).join("")}
      ${q.bundle ? `<div class="line"><span>Three shared places together</span><span class="num gold">−${pounds(q.bundle.savedPence)}</span></div>` : ""}
      ${q.launchMonthlyPence !== null && q.launchMonths ? `<div><span class="total num">${pounds(q.launchMonthlyPence)}</span> <span class="muted">a month for your first ${q.launchMonths} months</span></div><p class="muted">Then ${pounds(q.monthlyPence)} a month. Cancel any time.</p>` : `<div><span class="total num">${pounds(q.monthlyPence)}</span> <span class="muted">a month</span></div><p class="muted">${paid ? "Your price stays as booked." : "Cancel any time."}</p>`}
      <p class="small muted">Nothing is charged now. We read your advert first (usually within a working day), then you pay to go live.</p>
      <button class="btn primary" type="button" id="send">${existing ? "Send changes" : "Send for approval"}</button>`;
    $("#send").addEventListener("click", send);
  }

  async function send() {
    const btn = $("#send");
    $("#formErr").textContent = "";
    if (!b.title.trim()) { $("#formErr").textContent = "Give your advert a headline."; $("#title").focus(); return; }
    if (!b.artwork && b.photos.length === 0) { $("#formErr").textContent = "Add at least one photo."; return; }
    const body = { title: b.title.trim(), tagline: b.tagline.trim(), description: b.description.trim(), cta: b.cta };
    if (!paid) Object.assign(body, { placements: [...b.placements], postcode: b.postcode, radiusMiles: b.radiusMiles, startsAt: b.startsAt });
    if (!existing || b.photosChanged) body.imagesBase64 = b.photos.filter((u) => u.startsWith("data:"));
    if (existing && b.photosChanged && b.photos.some((u) => !u.startsWith("data:"))) {
      $("#formErr").textContent = "To change the photos, remove the old ones and add them all again (up to 3).";
      return;
    }
    if (b.artworkChanged || (!existing && b.artwork)) {
      if (b.artwork) body.artworkBase64 = b.artwork;
      else body.removeArtwork = true;
    }
    if (body.imagesBase64 && body.imagesBase64.length === 0) delete body.imagesBase64;
    btn.disabled = true;
    btn.textContent = "Sending… (checking your advert)";
    const r = existing ? await api("PATCH", `/advertiser/adverts/${existing.id}`, body) : await api("POST", "/advertiser/adverts", body);
    btn.disabled = false;
    btn.textContent = existing ? "Send changes" : "Send for approval";
    if (!r.ok) { $("#formErr").textContent = errorOf(r); $("#formErr").scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    await loadMe(true);
    toast(r.data.advert.state === "awaiting-payment" ? "Approved straight away: you can pay now." : "Sent. We'll email you when it's approved.");
    go(`#/advert/${r.data.advert.id}`);
  }

  drawPlaces(); drawCtas(); drawThumbs(); drawArt(); drawPreview(); drawSummary(); requote();
}

/* ---------------- one advert ---------------- */

function chart(byDay) {
  if (!byDay.length) return `<p class="muted small">No showings yet. Numbers appear here day by day once it's live.</p>`;
  const days = byDay.slice(-30);
  const max = Math.max(1, ...days.map((d) => d.views));
  const w = 600, h = 150, pad = 18, bw = (w - pad * 2) / days.length;
  const bars = days.map((d, i) => {
    const vh = ((h - 30) * d.views) / max;
    const th = ((h - 30) * d.taps) / max;
    const x = pad + i * bw;
    return `<rect class="bar-v" x="${x + 1}" y="${h - 18 - vh}" width="${Math.max(2, bw - 3)}" height="${vh}" rx="2"><title>${d.day}: shown ${d.views}, tapped ${d.taps}</title></rect><rect class="bar-t" x="${x + bw / 4}" y="${h - 18 - th}" width="${Math.max(1, bw / 2 - 2)}" height="${th}" rx="1"></rect>`;
  }).join("");
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Showings and taps by day">${bars}<text x="${pad}" y="${h - 4}">${days[0].day}</text><text x="${w - pad}" y="${h - 4}" text-anchor="end">${days[days.length - 1].day}</text></svg><p class="small muted"><span style="color:var(--gold-fill)">■</span> shown &nbsp; <span>■</span> tapped</p>`;
}

async function screenAdvert(id, query) {
  const me = await needMe();
  if (!me) return;
  let ad = me.adverts.find((a) => a.id === id);
  if (query.get("payment") === "paid") {
    // Stripe has sent them back: the payment message may take a moment to arrive.
    for (let i = 0; i < 6 && ad && ad.booking?.status === "awaiting-payment"; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      await loadMe(true);
      ad = state.me.adverts.find((a) => a.id === id);
    }
    toast("Payment received: thank you. Your receipt comes from Stripe by email.", 6000);
    history.replaceState(null, "", `#/advert/${id}`);
  }
  if (!ad) return go("#/adverts");
  const bk = ad.booking ?? {};
  const report = await api("GET", `/advertiser/adverts/${id}/report`);
  const r = report.ok ? report.data.report : { byDay: [], timesShown: 0, timesTapped: 0, timesSaved: 0, tapRatePercent: 0 };

  const explain = {
    "in-review": `<div class="note warn">We're reading your advert. That's usually within one working day, and we'll email you. Nothing is charged until it's approved.</div>`,
    "awaiting-payment": bk.invoiceRequested
      ? `<div class="note">You asked to pay by invoice: we'll email it to you. It goes live once it's paid.</div>`
      : `<div class="note ok"><b>Approved.</b> Pay to go live. We're holding your place until ${dateUK(bk.holdUntil)}.</div>`,
    rejected: `<div class="note bad"><b>We couldn't approve it as it is.</b><br>${esc(bk.rejectedReason || "")}<br><span class="small">Change it and send it again: nothing has been charged.</span></div>`,
    "starting-soon": `<div class="note ok">Paid. It starts on ${dateUK(ad.startsAt)}.</div>`,
    live: `<div class="note ok">Live in the app now. It renews monthly on your card until you cancel. Paid up to ${dateUK(bk.paidThrough)}.</div>`,
    "live-until-end": `<div class="note">Cancelled: it keeps showing until ${dateUK(bk.paidThrough)}, then stops. Nothing more will be charged.</div>`,
    "payment-due": `<div class="note bad">This month's payment hasn't come through, so it has stopped showing. Check the email from Stripe to update your card.</div>`,
    paused: `<div class="note bad">Paused: people reported it, so a person is looking at it again. We'll be in touch.</div>`,
    ended: `<div class="note">This advert has ended. Its results stay here.</div>`,
    withdrawn: `<div class="note">You withdrew this advert. Nothing was charged.</div>`,
  }[ad.state] ?? "";
  const canEdit = !["ended", "withdrawn"].includes(bk.status);
  const canPay = bk.status === "awaiting-payment" && !bk.invoiceRequested;
  const canWithdraw = ["in-review", "awaiting-payment", "rejected"].includes(bk.status);
  const canCancel = bk.status === "active";
  const c = { title: ad.title, tagline: ad.tagline, description: ad.description, photo: ad.images.find((u) => u !== ad.artwork) ?? ad.image, logo: ad.logo, name: ad.advertiser, cta: ad.cta, artwork: ad.artwork };

  app.innerHTML = `
  <div class="stack-lg">
    <div class="stack" style="gap:6px"><a class="small" href="#/adverts">← My adverts</a><div class="row">${stateBadge(ad.state)}<span class="muted small">${esc(ad.placementNames.join(" · "))}</span></div><h1 style="font-size:2rem">${esc(ad.title)}</h1><p class="muted">${ad.area === "nationwide" ? "Nationwide" : `Within ${ad.area.radiusMiles} miles of ${esc(ad.area.postcode)}`} · from ${dateUK(ad.startsAt)} · ${bk.monthlyPence ? `${pounds(bk.monthlyPence)} a month${bk.launchMonthlyPence !== null && bk.launchMonths ? ` (${pounds(bk.launchMonthlyPence)} for the first ${bk.launchMonths} months)` : ""}` : ""}</p></div>
    <div class="builder">
      <div class="stack-lg">
        ${explain}
        <div class="row" id="actions">
          ${canPay ? `${me.cardPayments ? `<button class="btn primary" id="payCard" type="button">Pay by card and go live</button>` : ""}<button class="btn ${me.cardPayments ? "" : "primary"}" id="payInvoice" type="button">Pay by invoice</button>` : ""}
          ${canEdit ? `<a class="btn" href="#/edit/${esc(ad.id)}">Change the advert</a>` : ""}
          ${canWithdraw ? `<button class="btn quiet danger" id="withdraw" type="button">Withdraw</button>` : ""}
          ${canCancel ? `<button class="btn quiet danger" id="cancel" type="button">Cancel at the end of the month</button>` : ""}
        </div>
        <p class="error" id="actErr" role="alert"></p>
        <section class="card stack">
          <h2>How it's doing</h2>
          <div class="stats">
            <div class="stat"><span class="small muted">Shown</span><b class="num">${r.timesShown}</b></div>
            <div class="stat"><span class="small muted">Tapped</span><b class="num">${r.timesTapped}</b><span class="small muted">${r.timesShown ? `${r.tapRatePercent}% of showings` : ""}</span></div>
            <div class="stat"><span class="small muted">Saved for later</span><b class="num">${r.timesSaved}</b></div>
          </div>
          ${chart(r.byDay)}
          <p class="small muted">Counted by the app on people's phones. These are showings, not separate people.</p>
        </section>
      </div>
      <aside class="stack sticky"><section class="card stack"><div class="spread"><h3>Preview</h3><div class="tabs" id="tabs"></div></div><div id="preview"></div></section></aside>
    </div>
  </div>`;

  let tab = ad.placements[0];
  const drawTabs = () => {
    $("#tabs").innerHTML = ad.placements.map((p) => `<button type="button" data-tab="${p}" aria-pressed="${p === tab}">${esc((PLACES.find((x) => x.id === p)?.title ?? p).replace("Scan ", "Scan: "))}</button>`).join("");
    $$("#tabs button").forEach((t) => t.addEventListener("click", () => { tab = t.dataset.tab; drawTabs(); }));
    $("#preview").innerHTML = (PREVIEW[tab] ?? previewFeed)({ ...c, artwork: tab === "scan-full" ? ad.artwork : null });
  };
  drawTabs();

  $("#payCard")?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    e.target.textContent = "Opening secure payment…";
    const res = await api("POST", `/advertiser/adverts/${id}/pay`, { method: "card" });
    if (res.ok && res.data.url) { location.href = res.data.url; return; }
    e.target.disabled = false;
    e.target.textContent = "Pay by card and go live";
    $("#actErr").textContent = errorOf(res);
  });
  $("#payInvoice")?.addEventListener("click", async () => {
    const res = await api("POST", `/advertiser/adverts/${id}/pay`, { method: "invoice" });
    if (!res.ok) { $("#actErr").textContent = errorOf(res); return; }
    await loadMe(true);
    toast("Thanks: we'll email you an invoice.");
    render();
  });
  $("#withdraw")?.addEventListener("click", async () => {
    if (!confirm("Withdraw this advert? Nothing has been charged.")) return;
    const res = await api("POST", `/advertiser/adverts/${id}/withdraw`, {});
    if (!res.ok) { $("#actErr").textContent = errorOf(res); return; }
    await loadMe(true);
    render();
  });
  $("#cancel")?.addEventListener("click", async () => {
    if (!confirm(`Cancel? It keeps showing until ${dateUK(bk.paidThrough)}, then stops, and nothing more is charged.`)) return;
    const res = await api("POST", `/advertiser/adverts/${id}/cancel`, {});
    if (!res.ok) { $("#actErr").textContent = errorOf(res); return; }
    await loadMe(true);
    toast("Cancelled. It runs to the end of the month you've paid for.");
    render();
  });
}

/* ---------------- router ---------------- */

async function render() {
  drawNav();
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, qs] = raw.split("?");
  const query = new URLSearchParams(qs ?? "");
  const parts = path.split("/").filter(Boolean);
  app.innerHTML = `<p class="muted loading">Loading…</p>`;
  window.scrollTo(0, 0);
  try {
    if (parts.length === 0) await screenWelcome();
    else if (parts[0] === "sign-in") await screenSignIn();
    else if (parts[0] === "business") await screenBusiness();
    else if (parts[0] === "adverts") await screenAdverts();
    else if (parts[0] === "new") await screenBuilder(null);
    else if (parts[0] === "edit" && parts[1]) await screenBuilder(decodeURIComponent(parts[1]));
    else if (parts[0] === "advert" && parts[1]) await screenAdvert(decodeURIComponent(parts[1]), query);
    else await screenWelcome();
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="card stack"><h2>Something went wrong</h2><p class="muted">Please reload the page. If it keeps happening, email flippilot@hotmail.com.</p></div>`;
  }
  drawNav();
  app.focus({ preventScroll: true });
}

window.addEventListener("hashchange", render);
render();
