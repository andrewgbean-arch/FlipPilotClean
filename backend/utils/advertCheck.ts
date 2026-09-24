/**
 * A safety net for advert wording and links, run before an advert is saved and
 * again before one is approved.
 *
 * It is a net, not a judge: it catches the obvious (swearing, the classic scam
 * phrases, links built to hide where they go) so a human approving an advert
 * starts from a cleaner pile. It cannot see the picture, and it can be beaten by
 * someone determined, so the real protection is still that nothing goes live
 * without being approved by a person, and that anyone can report an advert.
 *
 * Two kinds of finding:
 *  - "language": swearing or abuse. Always refused, no exceptions.
 *  - everything else: refused too, unless the person approving says they have
 *    looked at it and it is fine (a legitimate "Crypto Coffee Co." exists).
 */

export type Problem = {
  kind: "language" | "scam" | "link" | "contact" | "shouting";
  message: string;
};

/* ------------------------------ language ------------------------------ */

// Whole words only, so "Scunthorpe" and "class" are never caught.
const SWEARS = [
  "fuck", "fucker", "fucking", "fucked", "motherfucker", "shit", "shite", "bullshit", "cunt", "bitch",
  "bastard", "arse", "arsehole", "asshole", "wank", "wanker", "twat", "prick", "dick", "dickhead",
  "bollocks", "piss", "pissed", "slag", "whore", "slut", "nigger", "nigga", "faggot", "fag", "retard",
  "retarded", "paki", "spastic", "tranny", "coon", "kike", "chink", "cock", "pussy", "cum", "tits",
];
const SWEAR_SET = new Set(SWEARS);

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

function normalise(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[01345 7@$!]/g, (c) => LEET[c] ?? " ")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

function isSwear(word: string): boolean {
  if (SWEAR_SET.has(word)) return true;
  // plurals and endings: fucks, wankers, shitty
  const stem = word.replace(/(s|es|ed|er|ers|ing|y|ie)$/, "");
  if (stem.length < 3) return false;
  // shitty -> shitt -> shit
  const undoubled = stem.length > 3 && stem[stem.length - 1] === stem[stem.length - 2] ? stem.slice(0, -1) : stem;
  return SWEAR_SET.has(stem) || SWEAR_SET.has(undoubled);
}

/** "f*ck", "sh*t": a word with stars in it, where a star could be any letter. */
function maskedSwear(text: string): boolean {
  for (const raw of text.toLowerCase().split(/\s+/)) {
    if (!raw.includes("*")) continue;
    const clean = raw.replace(/[^a-z0-9*]/g, "");
    const letters = clean.replace(/\*/g, "");
    if (letters.length < 2 || clean.length < 3) continue;
    const re = new RegExp("^" + clean.replace(/\*/g, ".") + "$");
    if (SWEARS.some((w) => re.test(w))) return true;
  }
  return false;
}

function findSwearing(text: string): boolean {
  if (maskedSwear(text)) return true;
  const tokens = normalise(text).split(" ").filter(Boolean);
  if (tokens.some(isSwear)) return true;

  // "f u c k" and "f.u.c.k": runs of single letters joined up.
  let run = "";
  for (const t of [...tokens, ""]) {
    if (t.length === 1) run += t;
    else {
      if (run.length >= 3 && isSwear(run)) return true;
      run = "";
    }
  }
  return false;
}

/* -------------------------------- scams -------------------------------- */

const SCAM_PATTERNS: { re: RegExp; message: string }[] = [
  { re: /guarantee[d]?\s+(returns?|profits?|income|win|approval|results?)/i, message: "promises guaranteed returns or results" },
  { re: /risk[\s-]?free/i, message: "says it is risk free" },
  { re: /(double|triple|10x|100x)\s+your\s+(money|investment|cash)/i, message: "promises to multiply money" },
  { re: /get\s+rich|make\s+money\s+fast|easy\s+money|quick\s+cash|passive\s+income|financial\s+freedom/i, message: "get-rich-quick wording" },
  { re: /\b(bitcoin|btc|crypto(currency)?|forex|nfts?|binary\s+options|ponzi)\b/i, message: "crypto or trading offer" },
  { re: /(pay(ment)?|deposit|fee)\s+(up\s*front|in\s+advance|first)|advance\s+fee/i, message: "asks for money up front" },
  { re: /gift\s*cards?|western\s+union|moneygram|wire\s+transfer|bank\s+transfer\s+only/i, message: "asks for gift cards or an untraceable payment" },
  { re: /you('ve|\s+have)\s+(been\s+)?(won|selected|chosen)|congratulations|claim\s+your\s+(prize|reward|gift)/i, message: "\"you have won\" wording" },
  { re: /\b(whatsapp|telegram|signal|snapchat)\b/i, message: "moves people to a private chat app" },
  { re: /no\s+credit\s+check|guaranteed\s+loan|loan\s+approved|debt\s+(write[\s-]?off|wipe)/i, message: "loan or debt offer" },
  { re: /\b(act|buy|order|call|apply)\s+now\b|\burgent(ly)?\b|last\s+chance|hurry/i, message: "pressure or urgency wording" },
  { re: /miracle|\bcures?\b|lose\s+\d+\s*(lbs?|kg|pounds|stone)|weight\s+loss/i, message: "health or miracle claim" },
  { re: /\bfree\s+(money|iphone|ipad|car|gift)\b/i, message: "\"free\" prize wording" },
];

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /(\+?\d[\d\s().-]{8,}\d)/;

function shouting(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 15) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return upper / letters.length > 0.6 || /!{3,}/.test(text);
}

export function checkAdvertText(fields: {
  advertiser: string;
  title: string;
  tagline: string;
  description: string;
}): Problem[] {
  const problems: Problem[] = [];
  const all = [fields.advertiser, fields.title, fields.tagline, fields.description].filter(Boolean);
  const joined = all.join(" \n ");

  if (all.some(findSwearing)) {
    problems.push({ kind: "language", message: "contains swearing or abusive language" });
  }
  for (const p of SCAM_PATTERNS) {
    if (p.re.test(joined)) problems.push({ kind: "scam", message: p.message });
  }
  if (EMAIL.test(joined) || PHONE.test(joined)) {
    problems.push({ kind: "contact", message: "has an email address or phone number in the wording (people should go through the website)" });
  }
  if (all.some(shouting)) {
    problems.push({ kind: "shouting", message: "is written in capitals or with lots of exclamation marks" });
  }
  return problems;
}

/* -------------------------------- links -------------------------------- */

const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly", "rebrand.ly",
  "shorturl.at", "tiny.cc", "rb.gy", "s.id", "lnkd.in", "bl.ink", "v.gd",
]);
const CHAT_HOSTS = new Set(["wa.me", "t.me", "telegram.me", "telegram.org", "whatsapp.com", "discord.gg", "signal.me"]);
const RISKY_TLDS = new Set(["tk", "ml", "ga", "cf", "gq", "zip", "mov", "click"]);

// A name a scammer would borrow, and the hosts that really are that name.
const BRANDS: { names: string[]; hosts: RegExp }[] = [
  { names: ["ebay"], hosts: /(^|\.)ebay\.[a-z.]+$/ },
  { names: ["paypal"], hosts: /(^|\.)paypal\.[a-z.]+$/ },
  { names: ["royal mail", "royalmail"], hosts: /(^|\.)royalmail\.com$/ },
  { names: ["dvla"], hosts: /\.gov\.uk$/ },
  { names: ["dvsa"], hosts: /\.gov\.uk$/ },
  { names: ["hmrc"], hosts: /\.gov\.uk$/ },
  { names: ["nhs"], hosts: /(^|\.)nhs\.uk$/ },
  { names: ["amazon"], hosts: /(^|\.)amazon\.[a-z.]+$/ },
  { names: ["apple"], hosts: /(^|\.)apple\.com$/ },
  { names: ["barclays", "lloyds", "natwest", "santander", "hsbc", "monzo", "revolut"], hosts: /a^/ },
];

export function checkAdvertLink(website: string, advertiser: string, title: string): Problem[] {
  const problems: Problem[] = [];
  let host = "";
  try {
    host = new URL(website).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return [{ kind: "link", message: "the website address is not valid" }];
  }

  if (SHORTENERS.has(host)) problems.push({ kind: "link", message: "the link is a shortener that hides where it goes" });
  if (CHAT_HOSTS.has(host)) problems.push({ kind: "link", message: "the link goes to a chat app, not a website" });
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") || host.includes("[")) {
    problems.push({ kind: "link", message: "the link is a bare number, not a named website" });
  }
  if (host.split(".").some((label) => label.startsWith("xn--"))) {
    problems.push({ kind: "link", message: "the address uses look-alike characters (a common trick)" });
  }
  const tld = host.split(".").pop() ?? "";
  if (RISKY_TLDS.has(tld)) problems.push({ kind: "link", message: `the .${tld} ending is often used by scam sites` });

  const claimed = `${advertiser} ${title}`.toLowerCase();
  for (const brand of BRANDS) {
    const named = brand.names.find((n) => new RegExp(`\\b${n}\\b`).test(claimed));
    if (named && !brand.hosts.test(host)) {
      problems.push({ kind: "link", message: `names "${named}" but the website is not theirs (${host})` });
    }
  }
  return problems;
}

/** Everything found in one advert. Empty means nothing to worry about. */
export function checkAdvert(a: {
  advertiser: string;
  title: string;
  tagline: string;
  description: string;
  website: string;
}): Problem[] {
  return [...checkAdvertText(a), ...checkAdvertLink(a.website, a.advertiser, a.title)];
}

/** Language can never be waved through; the rest can, by someone who has looked. */
export function blocking(problems: Problem[], reviewed: boolean): Problem[] {
  return reviewed ? problems.filter((p) => p.kind === "language") : problems;
}
