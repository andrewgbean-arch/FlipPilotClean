// Run with: npx tsx src/utils/checks/scanAllowance.check.ts (from the app root).
// The free-to-use plan chosen 22 Oct 2026: sign up to scan, 100 free scans a month, one Pro plan (4.99 a month, unlimited),
// no credit packs. This pins the app's reading of what the server says about a person's scans, the words put to them, and what is
// offered when a scan is refused. The replies below are the real ones the live server gave on 22 Oct 2026.
import {
  dateInWords,
  needsSignUp,
  parseScanAllowance,
  planSubtitle,
  quotaAlertContent,
  quotaReasonOf,
  scanAllowanceIsEmpty,
  scanAllowanceSummary,
  scanAllowanceWords,
} from "../../lib/scanAllowance";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fail++;
    console.log("FAIL", label, "\n   got ", JSON.stringify(got), "\n   want", JSON.stringify(want));
  }
};

// A phone that is not signed in, and a signed-in account that has used 13 of its 100, as the live server answered.
const signedOutReply = {
  ok: true, metering: true, signedIn: false, accountRequired: true, credits: 0,
  free: { limit: 0, left: 0, resetsOn: "2026-11-01" }, signedInFreeLimit: 100, period: "month",
  plan: { active: false, renewsOn: null }, proDailyLimit: 150, packs: [],
};
const signedInReply = {
  ...signedOutReply, signedIn: true, free: { limit: 100, left: 87, resetsOn: "2026-11-01" },
};
const proReply = {
  ...signedInReply, free: { limit: 100, left: 0, resetsOn: "2026-11-01" },
  plan: { active: true, renewsOn: "2026-11-11T13:32:09.313Z" },
};

const out = parseScanAllowance(signedOutReply)!;
const inn = parseScanAllowance(signedInReply)!;
const pro = parseScanAllowance(proReply)!;

// ---- reading the server's reply
eq("signed out: asks for a sign-up", [out.accountRequired, out.signedIn, needsSignUp(out)], [true, false, true]);
eq("signed out: 0 free scans stays 0 (not swapped for a default)", [out.freeLimit, out.freeLeft], [0, 0]);
eq("signed out: signing in is worth 100 a month", out.signedInFreeLimit, 100);
eq("signed in: 87 of 100 left, resets on the 1st", [inn.freeLeft, inn.freeLimit, inn.resetsOn], [87, 100, "2026-11-01"]);
eq("no packs on sale", inn.packs, []);
eq("not on Pro", [inn.pro, inn.proRenewsOn], [false, null]);
eq("Pro: on the plan with a renewal date and the 150 ceiling", [pro.pro, pro.proRenewsOn, pro.proDailyLimit], [true, "2026-11-11T13:32:09.313Z", 150]);
eq("packs the server does list are kept, bad ones dropped", parseScanAllowance({ ...signedInReply, packs: [{ productId: "a", credits: 25 }, { productId: "b", credits: 0 }, { credits: 5 }] })!.packs, [{ productId: "a", credits: 25 }]);
eq("a reply that isn't ok is nothing", parseScanAllowance({ ok: false }), null);
eq("a reply with no free block is nothing", parseScanAllowance({ ok: true, free: null }), null);
eq("nothing at all is nothing", parseScanAllowance(null), null);
const older = parseScanAllowance({ ok: true, metering: true, signedIn: true, credits: 4, free: { limit: 5, left: 2, resetsOn: "2026-10-26" }, signedInFreeLimit: 5, packs: [] })!;
eq("an older server (no plan, no accountRequired) still reads: not Pro, no sign-up demanded", [older.pro, older.accountRequired, older.proDailyLimit], [false, false, 150]);

// ---- the dates
eq("1 November", dateInWords("2026-11-01"), "1 November");
eq("a full ISO date", dateInWords("2026-11-11T13:32:09.313Z"), "11 November");
eq("empty", dateInWords(""), "");
eq("not a date", dateInWords("soon"), "");
eq("a month that doesn't exist", dateInWords("2026-13-01"), "");
eq("null", dateInWords(null), "");

// ---- the pill
eq("pill, signed out: invites a sign-up", scanAllowanceWords(out), "Sign in to start scanning");
eq("pill, signed out: not a warning", scanAllowanceIsEmpty(out), false);
eq("pill, 87 left", scanAllowanceWords(inn), "87 free scans left");
eq("pill, 1 left", scanAllowanceWords({ ...inn, freeLeft: 1 }), "1 free scan left");
eq("pill, free ones gone but 3 credits held", scanAllowanceWords({ ...inn, freeLeft: 0, credits: 3 }), "3 credits left");
eq("pill, one credit", scanAllowanceWords({ ...inn, freeLeft: 0, credits: 1 }), "1 credit left");
eq("pill, credits keep it from being a warning", scanAllowanceIsEmpty({ ...inn, freeLeft: 0, credits: 3 }), false);
eq("pill, nothing left", scanAllowanceWords({ ...inn, freeLeft: 0 }), "Out of free scans");
eq("pill, nothing left is a warning", scanAllowanceIsEmpty({ ...inn, freeLeft: 0 }), true);
eq("pill, Pro", scanAllowanceWords(pro), "Pro: unlimited scans");
eq("pill, Pro is never a warning, even with no free scans left", scanAllowanceIsEmpty(pro), false);
const lever = { ...out, accountRequired: false };
eq("pill, server lets a few scans through without an account (testing): sign in for more", scanAllowanceWords(lever), "Sign in for more scans");
eq("pill, ...and that is a warning", scanAllowanceIsEmpty(lever), true);

// ---- Settings
eq("scans row, free", scanAllowanceSummary(inn), "87 of 100 free scans left this month");
eq("scans row, free with credits held", scanAllowanceSummary({ ...inn, credits: 3 }), "87 of 100 free scans left this month, and 3 scan credits");
eq("scans row, one credit held", scanAllowanceSummary({ ...inn, credits: 1 }), "87 of 100 free scans left this month, and 1 scan credit");
eq("scans row, signed out", scanAllowanceSummary(out), "Sign in free to get 100 scans a month");
eq("scans row, Pro", scanAllowanceSummary(pro), "Pro: unlimited scans (up to 150 a day)");
eq("plan row, free", planSubtitle(inn, false), "100 free scans a month. Go Pro (£4.99 a month) for unlimited");
eq("plan row, signed out", planSubtitle(out, false), "Sign in free for 100 scans a month. Go Pro (£4.99 a month) for unlimited");
eq("plan row, not known yet", planSubtitle(null, false), "100 free scans a month. Go Pro (£4.99 a month) for unlimited");
eq("plan row, the store's own price", planSubtitle(inn, false, "€5.49"), "100 free scans a month. Go Pro (€5.49 a month) for unlimited");
eq("plan row, Pro", planSubtitle(pro, true), "Unlimited scans (up to 150 a day), shop-price checks on pricier items and eBay export");
eq("plan row, Pro according to the store before the server has answered", planSubtitle(null, true), "Unlimited scans (up to 150 a day), shop-price checks on pricier items and eBay export");

// ---- a refused scan
eq("sign-in wall", quotaReasonOf({ error: "free-scan-limit", signedIn: false }), "sign-in");
eq("an older server's limit for someone signed in", quotaReasonOf({ error: "free-scan-limit", signedIn: true }), "out-of-scans");
eq("limit with no word on sign-in", quotaReasonOf({ error: "free-scan-limit" }), "out-of-scans");
eq("out of scans", quotaReasonOf({ error: "out-of-scans", signedIn: true }), "out-of-scans");
eq("Pro's daily ceiling", quotaReasonOf({ error: "pro-daily-limit", signedIn: true }), "daily-limit");
eq("an older server's out of credits", quotaReasonOf({ error: "out-of-credits" }), "out-of-credits");
eq("some other failure is not a refusal for running out", quotaReasonOf({ error: "Lookup failed" }), null);
eq("no error", quotaReasonOf({}), null);
eq("nothing", quotaReasonOf(null), null);

eq("alert: sign in", quotaAlertContent("sign-in"), { title: "Sign in to start scanning", buttons: [{ label: "Not now" }, { label: "Sign in", to: "/sign-in" }] });
eq("alert: out of scans offers Pro", quotaAlertContent("out-of-scans"), { title: "You're out of free scans", buttons: [{ label: "Not now" }, { label: "Go Pro", to: "/upgrade" }] });
eq("alert: an older server's out of credits offers Pro too", quotaAlertContent("out-of-credits"), quotaAlertContent("out-of-scans"));
eq("alert: nothing known offers Pro", quotaAlertContent(undefined), quotaAlertContent("out-of-scans"));
eq("alert: the daily ceiling only says OK (a subscriber is never sold Pro)", quotaAlertContent("daily-limit"), { title: "That's today's limit", buttons: [{ label: "OK" }] });

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
