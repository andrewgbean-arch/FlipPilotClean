/**
 * Checks on the contact details people paste into a conversation — email
 * addresses, phone numbers and links.
 *
 * A digit-heavy email is a WEAK signal on its own. Plenty of honest people are
 * dave1978@hotmail.com, and a scammer can register a tidy-looking address in a
 * minute. So the wording matters as much as the check: something worth a second
 * look is phrased as exactly that, and only a genuine giveaway — a throwaway
 * address, or a free account pretending to be PayPal — is called out hard.
 */

export type ContactFinding = {
  id: string;
  title: string;
  advice: string;
  severity: "high" | "caution";
};

/** Addresses that exist to be thrown away after one use. */
const DISPOSABLE_DOMAINS = [
  "mailinator.com", "guerrillamail.com", "guerrillamail.info", "yopmail.com",
  "temp-mail.org", "tempmail.com", "10minutemail.com", "throwawaymail.com",
  "sharklasers.com", "getnada.com", "trashmail.com", "dispostable.com",
  "maildrop.cc", "mailnesia.com", "fakeinbox.com", "emailondeck.com",
];

/** Free accounts anybody can open in a minute, under any name. */
const FREE_MAIL_DOMAINS = [
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.co.uk", "outlook.com",
  "live.co.uk", "live.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "aol.com",
  "icloud.com", "me.com", "gmx.com", "gmx.co.uk", "mail.com", "mail.ru",
  "protonmail.com", "proton.me", "yandex.com", "zoho.com",
];

/**
 * Names worth impersonating, with the domains they actually send from.
 *
 * `distinctive` means the word is not something an ordinary business would have
 * in its own address. Only those are judged on the domain alone — "halifax" is
 * a town and "wise" is a word, so halifaxcarparts.co.uk and wisebuys@gmail.com
 * are somebody's honest business, not an impersonation.
 */
const IMPERSONATED: {
  word: string;
  realDomains: string[];
  distinctive: boolean;
}[] = [
  { word: "paypal", realDomains: ["paypal.com", "paypal.co.uk"], distinctive: true },
  { word: "gumtree", realDomains: ["gumtree.com"], distinctive: true },
  { word: "royalmail", realDomains: ["royalmail.com", "royalmail.co.uk"], distinctive: true },
  { word: "parcelforce", realDomains: ["parcelforce.com"], distinctive: true },
  { word: "evri", realDomains: ["evri.com"], distinctive: true },
  { word: "hmrc", realDomains: ["hmrc.gov.uk", "gov.uk"], distinctive: true },
  { word: "dvla", realDomains: ["dvla.gov.uk", "gov.uk"], distinctive: true },
  { word: "natwest", realDomains: ["natwest.com"], distinctive: true },
  { word: "barclays", realDomains: ["barclays.co.uk", "barclays.com"], distinctive: true },
  { word: "lloydsbank", realDomains: ["lloydsbank.com"], distinctive: true },
  { word: "monzo", realDomains: ["monzo.com"], distinctive: true },
  { word: "revolut", realDomains: ["revolut.com"], distinctive: true },
  { word: "flippilot", realDomains: ["flippilot.co.uk", "flippilot.com"], distinctive: true },
  // Ordinary words and place names: only ever judged with a service word beside
  // them, never on the domain alone.
  { word: "ebay", realDomains: ["ebay.com", "ebay.co.uk"], distinctive: false },
  { word: "escrow", realDomains: ["escrow.com"], distinctive: false },
  { word: "dpd", realDomains: ["dpd.co.uk", "dpd.com"], distinctive: false },
  { word: "dhl", realDomains: ["dhl.com", "dhl.co.uk"], distinctive: false },
  { word: "hermes", realDomains: ["evri.com", "myhermes.co.uk"], distinctive: false },
  { word: "halifax", realDomains: ["halifax.co.uk"], distinctive: false },
  { word: "wise", realDomains: ["wise.com"], distinctive: false },
];

/**
 * The words a pretend company account puts beside the name it is borrowing.
 * A real person's address does not read "paypal-refunds".
 */
const SERVICE_WORDS = [
  "support", "service", "payment", "refund", "noreply", "no-reply", "donotreply",
  "security", "secure", "alert", "team", "admin", "billing", "invoice",
  "delivery", "deliveries", "tracking", "notification", "verify", "verification",
  "accounts", "customer", "help", "care",
];

/** Link shorteners hide where a link really goes. */
const SHORTENERS = [
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly",
  "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy", "tiny.cc", "s.id",
];

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
// Loose on purpose: people write numbers every which way.
const PHONE_RE = /(?:\+|00)\d[\d\s().-]{7,}\d/g;

/**
 * Digits and lookalike letters put back, so paypa1, g00gle and rnonzo stop
 * hiding behind a substitution.
 */
function unmask(text: string): string {
  return text
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "l")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b")
    .replace(/\$/g, "s")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w");
}

function domainMatches(domain: string, real: string): boolean {
  return domain === real || domain.endsWith(`.${real}`);
}

/** How much of the name in front of the @ is digits. */
function digitRun(localPart: string): number {
  const runs = localPart.match(/\d+/g) ?? [];
  return runs.reduce((longest, run) => Math.max(longest, run.length), 0);
}

export function checkEmailAddress(address: string): ContactFinding[] {
  const clean = address.trim().toLowerCase();
  const at = clean.lastIndexOf("@");
  if (at <= 0) return [];

  const localPart = clean.slice(0, at);
  const domain = clean.slice(at + 1);
  const findings: ContactFinding[] = [];

  if (DISPOSABLE_DOMAINS.includes(domain)) {
    findings.push({
      id: "email-disposable",
      title: "A throwaway email address",
      advice: `${address} is a temporary address that stops working shortly after it is made. Somebody buying a sofa has no reason to use one.`,
      severity: "high",
    });
  }

  const unmaskedDomain = unmask(domain);
  const unmaskedLocal = unmask(localPart);

  // Letters only, so "pay-pal" and "pay.pal99" read as "paypal".
  const localLetters = unmaskedLocal.replace(/[^a-z]/g, "");
  const hasServiceWord = SERVICE_WORDS.some((w) =>
    unmaskedLocal.includes(w.replace(/-/g, ""))
  );

  for (const { word, realDomains, distinctive } of IMPERSONATED) {
    const genuine = realDomains.some((real) => domainMatches(domain, real));
    if (genuine) continue;

    // Three ways to look like a borrowed name, in order of how sure we are:
    // the domain itself imitates it; the whole name before the @ IS it; or the
    // name has it sitting next to the sort of word only a company account uses.
    const inDomain = distinctive && unmaskedDomain.includes(word);
    const isWholeName = localLetters === word;
    const withServiceWord = unmaskedLocal.includes(word) && hasServiceWord;

    if (!inDomain && !isWholeName && !withServiceWord) continue;

    const name = word.toUpperCase();
    findings.push({
      id: "email-impersonation",
      title: `Pretending to be ${name}`,
      advice: FREE_MAIL_DOMAINS.includes(domain)
        ? `${address} is a free email account with "${word}" in the name. ${name} does not contact anyone from a free account. Ignore whatever it is telling you and check your own account directly.`
        : `${address} is not a ${name} address — look at the domain after the @. Fake payment and delivery emails are the whole scam; go to ${name} yourself instead of replying.`,
      severity: "high",
    });
    break;
  }

  // Only worth mentioning once nothing stronger has been found.
  if (findings.length === 0) {
    const digits = (localPart.match(/\d/g) ?? []).length;
    const longestRun = digitRun(localPart);
    const letters = (localPart.match(/[a-z]/g) ?? []).length;

    if (longestRun >= 5 || (digits >= 4 && digits > letters)) {
      findings.push({
        id: "email-random-looking",
        title: "That email looks auto-generated",
        advice: `${address} has a long string of numbers in it, which is what accounts made in bulk tend to look like. It is not proof of anything on its own — plenty of people have numbers in their email — but it is worth a second look before you send money or your address.`,
        severity: "caution",
      });
    }
  }

  return findings;
}

export function checkLink(url: string): ContactFinding[] {
  const clean = url.trim().replace(/[),.;]+$/, "");
  const withoutScheme = clean.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const host = withoutScheme.split(/[/?#]/)[0].toLowerCase();
  const findings: ContactFinding[] = [];

  if (SHORTENERS.some((s) => host === s || host.endsWith(`.${s}`))) {
    findings.push({
      id: "link-shortened",
      title: "A shortened link",
      advice: `${host} hides where the link actually goes. Ask them to say in words what it is, rather than tapping it.`,
      severity: "high",
    });
  }

  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host)) {
    findings.push({
      id: "link-raw-address",
      title: "A link to a bare server address",
      advice: "A real company's link has a name, not a string of numbers. Do not open it.",
      severity: "high",
    });
  }

  if (host.startsWith("xn--") || host.includes(".xn--")) {
    findings.push({
      id: "link-lookalike-characters",
      title: "A link using lookalike characters",
      advice: "This address is spelled with characters chosen to imitate a real one. Type the address you want in yourself.",
      severity: "high",
    });
  }

  const unmaskedHost = unmask(host);
  for (const { word, realDomains, distinctive } of IMPERSONATED) {
    // Only names no honest business would borrow. A link to a garage in
    // Halifax is a link to a garage in Halifax.
    if (!distinctive) continue;
    if (!unmaskedHost.includes(word)) continue;
    if (realDomains.some((real) => domainMatches(host, real))) continue;

    findings.push({
      id: "link-impersonation",
      title: `A link pretending to be ${word.toUpperCase()}`,
      advice: `${host} is not ${word.toUpperCase()}. Fake payment pages are built to look exactly right. Go there yourself through your own app or browser, never through someone else's link.`,
      severity: "high",
    });
    break;
  }

  return findings;
}

export function checkPhoneNumber(raw: string): ContactFinding[] {
  const digits = raw.replace(/\D/g, "");
  const international = /^(?:\+|00)/.test(raw.trim());
  if (!international) return [];

  // +44 and 0044 are the UK.
  const isUK = digits.startsWith("44") || digits.startsWith("0044");
  if (isUK) return [];

  return [
    {
      id: "phone-overseas",
      title: "An overseas phone number",
      advice: `${raw.trim()} is not a UK number. Worth asking about if they have told you they are local, and never worth calling back — some numbers charge you heavily for the call.`,
      severity: "caution",
    },
  ];
}

/**
 * Everything worth saying about the contact details in a message. Deduped by
 * kind, so three dodgy links do not produce the same warning three times.
 */
export function checkContactDetails(text: string | null | undefined): ContactFinding[] {
  const message = String(text ?? "");
  if (!message.trim()) return [];

  const findings: ContactFinding[] = [];

  for (const email of message.match(EMAIL_RE) ?? []) {
    findings.push(...checkEmailAddress(email));
  }

  // An email is also a URL-ish string in some messages; links are matched
  // separately and an address inside a link is handled by the email pass.
  for (const url of message.match(URL_RE) ?? []) {
    findings.push(...checkLink(url));
  }

  for (const phone of message.match(PHONE_RE) ?? []) {
    findings.push(...checkPhoneNumber(phone));
  }

  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.id}:${f.advice}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
