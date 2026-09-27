// The advert previews, drawn like the FlipPilot app draws them. Shared by the portal and the admin page.

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);


export function ctaLabel(cta) { return cta === "call" ? "Call" : cta === "directions" ? "Directions" : "Visit"; }

export function phone(inner, head = "Marketplace", sub = "Near you") {
  return `<div class="phone" aria-hidden="true"><div class="screen"><div class="status"><span>9:41</span><span>● ● ●</span></div><div class="apphead">${esc(head)}<small>${esc(sub)}</small></div>${inner}</div></div>`;
}

export function cardHtml(c) {
  return `<div class="appcard">
    <div class="pic" style="${c.photo ? `background-image:url('${esc(c.photo)}')` : ""}"></div>
    <div class="body">
      <div><div class="who"><span class="sponsored">SPONSORED</span>${c.logo ? `<img src="${esc(c.logo)}" alt="">` : ""}</div><div class="t" style="margin-top:5px">${esc(c.title || "Your headline")}</div><div class="s">${esc(c.tagline || c.description || "")}</div></div>
      <div class="acts"><span class="who small-acts">⚑ &nbsp;☆ Save</span><span class="appbtn">${ctaLabel(c.cta)}</span></div>
    </div></div>`;
}

export function previewFeed(c) {
  return phone(`<div class="fake"></div>${cardHtml(c)}<div class="fake"></div><div class="fake short"></div>`, "Marketplace", "Listings near you");
}
export function previewMessages(c) {
  return phone(`${cardHtml(c)}<div class="fake short"></div><div class="fake short"></div><div class="fake short"></div>`, "Messages", "Your chats");
}
export function previewPanels(c) {
  return phone(`<div class="panels">
    <div class="panel"><div class="pic" style="${c.photo ? `background-image:url('${esc(c.photo)}')` : ""}"></div><div class="body"><div class="row" style="gap:6px;justify-content:space-between"><span class="row" style="gap:6px"><span class="sponsored quiet">Sponsored</span>${c.logo ? `<img src="${esc(c.logo)}" alt="" style="width:20px;height:20px;border-radius:5px;background:#fff;object-fit:contain">` : ""}</span><span class="appbtn">${ctaLabel(c.cta)}</span></div><div class="t">${esc(c.title || "Your headline")}</div><div class="s">${esc(c.tagline || c.description || "")}</div></div></div>
    <div class="panel other"><div class="pic"></div><div class="body"><span class="sponsored quiet">Sponsored</span><div class="t">Another advertiser</div></div></div>
  </div><div class="scanning">Looking up your scan…</div>`, "Scanning", "Finding the price");
}
export function previewFull(c) {
  const inner = c.artwork
    ? `<div class="full"><div class="art" style="background-image:url('${esc(c.artwork)}')"></div><div class="body"><span class="appbtn">${c.cta === "website" || !c.cta ? "Visit website" : ctaLabel(c.cta)}</span></div></div>`
    : `<div class="full"><div class="pic" style="${c.photo ? `background-image:url('${esc(c.photo)}')` : ""}"></div><div class="body"><div class="row" style="gap:6px"><span class="sponsored quiet">Sponsored</span>${c.logo ? `<img src="${esc(c.logo)}" alt="" style="width:22px;height:22px;border-radius:5px;background:#fff;object-fit:contain">` : ""}</div><div class="t">${esc(c.title || "Your headline")}</div>${c.tagline ? `<div class="tag">${esc(c.tagline)}</div>` : ""}${c.description ? `<div class="d">${esc(c.description)}</div>` : ""}<span class="appbtn">${c.cta === "website" || !c.cta ? "Visit website" : ctaLabel(c.cta)}</span></div></div>`;
  return phone(inner + `<div class="scanning">Looking up your scan…</div>`, "Scanning", "Finding the price");
}
export const PREVIEW = { feed: previewFeed, messages: previewMessages, "scan-panel": previewPanels, "scan-full": previewFull };

