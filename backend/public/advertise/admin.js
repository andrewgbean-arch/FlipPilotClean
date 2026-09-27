// FlipPilot adverts admin: read every advert as it will look, then approve it, turn it down (saying
// why), mark an invoice paid, pause or delete it. Uses the /admin/adverts routes, which check the
// admin token. The token is kept for this browser tab only (sessionStorage), never saved.

import { esc, PREVIEW, previewFeed } from "./previews.js";

const app = document.getElementById("app");
const nav = document.getElementById("nav");
const KEY = "flippilot-ads-admin";
const $ = (s, r = app) => r.querySelector(s);
const $$ = (s, r = app) => [...r.querySelectorAll(s)];
const pounds = (p) => { const v = p / 100; return "£" + (Number.isInteger(v) ? v : v.toFixed(2)); };
const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");

const token = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
const setToken = (t) => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch {} };

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 3500);
}

async function api(method, path, body) {
  const res = await fetch(path, { method, headers: { "content-type": "application/json", "x-admin-token": token() ?? "" }, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => null);
  if (!res) return { ok: false, status: 0, data: { error: "Couldn't reach the server." } };
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 404 && path === "/admin/adverts") { setToken(null); }
  return { ok: res.ok, status: res.status, data };
}
const err = (r) => r.data?.message || r.data?.error || "That didn't work.";

let filter = "attention";

function signIn(msg = "") {
  nav.innerHTML = "";
  app.innerHTML = `<form class="card stack signin" id="f" style="margin:0 auto"><h1 style="font-size:1.8rem">Adverts admin</h1><p class="muted">Enter the admin token (ADMIN_TOKEN on the server). It's kept for this tab only.</p><label class="field"><span>Admin token</span><input id="t" type="password" autocomplete="off" required></label><p class="error">${esc(msg)}</p><button class="btn primary">Open</button></form>`;
  $("#t").focus();
  $("#f").addEventListener("submit", (e) => { e.preventDefault(); setToken($("#t").value.trim()); load(); });
}

const STATUS = {
  "in-review": ["warn", "Needs review"],
  "awaiting-payment": ["gold", "Approved, awaiting payment"],
  rejected: ["bad", "Rejected"],
  active: ["ok", "Paid"],
  cancelling: ["ok", "Paid, cancelling"],
  ended: ["", "Ended"],
  withdrawn: ["", "Withdrawn"],
};

function badge(ad) {
  if (!ad.booking) return `<span class="pill">${esc(ad.state)} (made by hand)</span>`;
  const [k, t] = STATUS[ad.booking.status] ?? ["", ad.booking.status];
  const review = ad.booking.status === "active" && !ad.approved ? ` <span class="pill warn">Changed: needs review</span>` : "";
  return `<span class="pill ${k}"><span class="dot"></span>${t}</span>${review}${ad.state === "paused-by-reports" ? ` <span class="pill bad">Paused by reports</span>` : ""}`;
}

function card(ad) {
  const b = ad.booking;
  const c = { title: ad.title, tagline: ad.tagline, description: ad.description, photo: (ad.images || []).find((u) => u !== ad.artwork) || ad.image, logo: ad.logo, name: ad.advertiser, cta: ad.cta || "website" };
  const tabs = ad.placements.filter((p) => PREVIEW[p]);
  const ai = ad.aiReview;
  return `
  <article class="card stack" data-id="${esc(ad.id)}">
    <div class="spread"><div class="row">${badge(ad)}<span class="small muted">${esc(ad.placements.join(" · "))}</span></div><span class="small muted">sent ${day(b?.submittedAt || ad.createdAt)}</span></div>
    <div class="builder" style="grid-template-columns:minmax(0,1fr) 300px">
      <div class="stack">
        <div><h2 style="font-size:1.25rem">${esc(ad.title)}</h2><p class="muted">${esc(ad.advertiser)}${ad.ownerEmail ? ` · <a href="mailto:${esc(ad.ownerEmail)}">${esc(ad.ownerEmail)}</a>` : ""}</p></div>
        ${ad.tagline ? `<p><b>${esc(ad.tagline)}</b></p>` : ""}${ad.description ? `<p>${esc(ad.description)}</p>` : ""}
        <p class="small">Button: <b>${esc(ad.cta || "website")}</b>${ad.website ? ` · <a href="${esc(ad.website)}" target="_blank" rel="noopener noreferrer">${esc(ad.website)}</a>` : ""}${ad.phone ? ` · ${esc(ad.phone)}` : ""}${ad.address ? ` · ${esc(ad.address)}` : ""}</p>
        <p class="small">${ad.scope === "local" ? `Within ${ad.radiusMiles} miles of ${esc(ad.postcode)}` : "Nationwide"} · ${day(ad.startsAt)} to ${day(ad.endsAt)}${b ? ` · ${pounds(b.monthlyPence)} a month${b.launchMonthlyPence !== null && b.launchMonths ? ` (${pounds(b.launchMonthlyPence)} for ${b.launchMonths} months)` : ""}` : ""}${b?.paidThrough ? ` · paid to ${day(b.paidThrough)}` : ""}${b?.invoiceRequested ? ` · <b>invoice requested</b>` : ""}</p>
        <div class="note ${ai?.verdict === "ok" ? "ok" : ai?.verdict === "reject" ? "bad" : "warn"}"><b>AI check: ${esc(ai?.verdict ?? "not checked")}</b>${ai?.reasons?.length ? `<br><span class="small">${ai.reasons.map(esc).join("<br>")}</span>` : ""}</div>
        ${ad.reportCount ? `<div class="note bad"><b>${ad.reportCount} report${ad.reportCount === 1 ? "" : "s"}</b>: ${Object.entries(ad.reportReasons || {}).map(([k, v]) => `${esc(k)} ×${v}`).join(", ")}${(ad.reportNotes || []).length ? `<br><span class="small">${ad.reportNotes.map(esc).join("<br>")}</span>` : ""}</div>` : ""}
        ${b?.rejectedReason ? `<p class="small">Told them: <i>${esc(b.rejectedReason)}</i></p>` : ""}
        ${ad.freeMonth === "asked" ? `<div class="note warn"><b>Asked for the launch offer's free month</b> (${day(b.freeMonth.requestedAt)}). ${b.stripe?.subscriptionId ? "Card payer: adding it puts a month's credit on their Stripe account, which pays their next invoice." : "Invoice payer: adding it gives a month more of paid time."}${b.freeMonth.note ? `<br><span class="small">They said: <i>${esc(b.freeMonth.note)}</i></span>` : ""}</div>` : ""}
        ${ad.freeMonth === "granted" ? `<p class="small">Free month added ${day(b.freeMonth.decidedAt)}.</p>` : ""}
        <p class="small muted num">Shown ${ad.totals.views} · tapped ${ad.totals.clicks} · saved ${ad.totals.saves}${ad.trustedAdvertiser ? " · trusted advertiser" : ""}</p>
        <div class="row">
          ${!ad.approved && (!b || ["in-review", "active", "cancelling"].includes(b.status)) ? `<button class="btn primary small" data-act="approve">Approve</button>` : ""}
          ${b && ["in-review", "awaiting-payment", "active", "cancelling"].includes(b.status) ? `<button class="btn small" data-act="reject">Turn down…</button>` : ""}
          ${ad.freeMonth === "asked" ? `<button class="btn primary small" data-act="free">Add the free month</button><button class="btn small" data-act="nofree">Say no…</button>` : ""}
          ${b && ad.approved && (b.status === "awaiting-payment" || (["active", "cancelling"].includes(b.status) && !b.stripe?.subscriptionId)) ? `<button class="btn small" data-act="paid">Mark paid…</button>` : ""}
          ${ad.approved ? `<button class="btn small quiet" data-act="pause">Pause</button>` : ""}
          <button class="btn small quiet danger" data-act="delete">Delete</button>
        </div>
      </div>
      <div class="stack"><div class="tabs">${tabs.map((p, i) => `<button type="button" data-tab="${p}" aria-pressed="${i === 0}">${esc(p)}</button>`).join("")}</div><div class="pv">${(PREVIEW[tabs[0]] || previewFeed)({ ...c, artwork: tabs[0] === "scan-full" ? ad.artwork : null })}</div></div>
    </div>
  </article>`;
}

async function load() {
  if (!token()) return signIn();
  const r = await api("GET", "/admin/adverts");
  if (!r.ok) return signIn(r.status === 404 ? "The admin routes are off: set ADMIN_TOKEN on the server." : "That token isn't right.");
  const all = r.data.adverts.sort((a, b) => String(b.booking?.submittedAt || b.createdAt).localeCompare(String(a.booking?.submittedAt || a.createdAt)));
  const groups = {
    attention: all.filter((a) => a.needsAttention || a.booking?.invoiceRequested),
    unpaid: all.filter((a) => a.booking?.status === "awaiting-payment"),
    live: all.filter((a) => a.state === "live"),
    all,
  };
  nav.innerHTML = `<button class="btn small quiet" id="out" type="button">Close</button>`;
  $("#out", nav).addEventListener("click", () => { setToken(null); signIn(); });
  const list = groups[filter];
  app.innerHTML = `
  <div class="stack-lg">
    <div class="spread"><h1 style="font-size:1.8rem">Adverts</h1>
      <div class="tabs" id="filters">${[["attention", `Needs you (${groups.attention.length})`], ["unpaid", `Awaiting payment (${groups.unpaid.length})`], ["live", `Live (${groups.live.length})`], ["all", `All (${all.length})`]].map(([k, t]) => `<button type="button" data-f="${k}" aria-pressed="${k === filter}">${t}</button>`).join("")}</div></div>
    ${list.length ? list.map(card).join("") : `<div class="card empty"><p class="muted">Nothing here.</p></div>`}
  </div>`;
  $$("#filters button").forEach((b) => b.addEventListener("click", () => { filter = b.dataset.f; load(); }));
  $$("article").forEach((el) => {
    const id = el.dataset.id;
    const ad = all.find((a) => a.id === id);
    $$(".tabs button", el).forEach((t) => t.addEventListener("click", () => {
      $$(".tabs button", el).forEach((x) => x.setAttribute("aria-pressed", String(x === t)));
      const c = { title: ad.title, tagline: ad.tagline, description: ad.description, photo: (ad.images || []).find((u) => u !== ad.artwork) || ad.image, logo: ad.logo, name: ad.advertiser, cta: ad.cta || "website", artwork: t.dataset.tab === "scan-full" ? ad.artwork : null };
      $(".pv", el).innerHTML = (PREVIEW[t.dataset.tab] || previewFeed)(c);
    }));
    $$("[data-act]", el).forEach((btn) => btn.addEventListener("click", () => act(btn.dataset.act, ad)));
  });
}

async function act(what, ad) {
  let r;
  if (what === "approve") {
    r = await api("PATCH", `/admin/adverts/${ad.id}`, { approved: true });
    if (!r.ok && (r.data.error === "ai-rejected" || r.data.canOverride)) {
      if (!confirm(`${err(r)}\n\nApprove it anyway? (You've read it and are sure.)`)) return;
      r = await api("PATCH", `/admin/adverts/${ad.id}`, { approved: true, reviewed: true });
    }
  } else if (what === "reject") {
    const reason = prompt("Why? The business sees this, so say what to change (for example: the photo doesn't show what you sell).");
    if (!reason) return;
    r = await api("POST", `/admin/adverts/${ad.id}/reject`, { reason });
  } else if (what === "paid") {
    const months = Number(prompt("Paid for how many months?", "1"));
    if (!months) return;
    r = await api("POST", `/admin/adverts/${ad.id}/mark-paid`, { months });
  } else if (what === "free") {
    if (!confirm("Add their free month?")) return;
    r = await api("POST", `/admin/adverts/${ad.id}/free-month`, { grant: true });
  } else if (what === "nofree") {
    const reason = prompt("Why not? They see this, so be kind and clear.");
    if (!reason) return;
    r = await api("POST", `/admin/adverts/${ad.id}/free-month`, { grant: false, reason });
  } else if (what === "pause") {
    if (!confirm("Stop showing it until you approve it again?")) return;
    r = await api("PATCH", `/admin/adverts/${ad.id}`, { approved: false });
  } else if (what === "delete") {
    if (!confirm("Delete this advert and its pictures for good?")) return;
    r = await api("DELETE", `/admin/adverts/${ad.id}`);
  }
  if (!r?.ok) { toast(err(r)); return; }
  toast(r.data.note || "Done.");
  load();
}

load();
