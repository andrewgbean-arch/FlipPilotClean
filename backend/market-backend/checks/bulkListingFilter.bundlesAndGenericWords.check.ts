// Run with: npx tsx market-backend/checks/bulkListingFilter.bundlesAndGenericWords.check.ts (from the backend folder).
// Found live 2026-09-30, a real "Edifier R1280T Multimedia Speaker" scan: Retail price showed
// £229.99 when the real UK price is ~£80-100. Two compounding, independent bugs:
//
//   1. "Multimedia" was never in GENERIC_WORDS, so it counted as an identifying word the search
//      needed. No real listing actually says "Multimedia" (it's AI-generated filler from the
//      scanned title), so matchesQuery failed on EVERY listing, all 38 of them — the strict
//      match tier could never kick in for this product at all, leaving every scan of it
//      protected only by the weaker sharesNumericIdentity fallback.
//   2. sharesNumericIdentity correctly passes a listing that genuinely mentions "R1280T", but
//      several real listings bundle the speaker together with an entirely different, separately
//      sold product — "...with Sub-out T5 Active Subwoofer" (£229.99), "Turntable + Edifier
//      R1280T..." (£229.99 and £399.99) — and nothing existing caught that shape of problem:
//      these are real, unbroken items, just two of them sold together, so isBulkListing/
//      priceForPack's multiplier logic doesn't apply either.
import { isNotTheItem, matchesQuery, identifyingWords } from "../bulkListingFilter";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log("FAIL", label, "got", JSON.stringify(got), "want", JSON.stringify(want)); }
};

const QUERY = "Edifier R1280T Multimedia Speaker";

// "Multimedia" (and "System"/"Systems", found alongside it) no longer count as identifying —
// only the real distinguishing words do.
eq("multimedia is not an identifying word", identifyingWords(QUERY).includes("multimedia"), false);
eq("identifying words are just the brand and model", identifyingWords(QUERY).sort(), ["edifier", "r1280t"].sort());

// Real listings that previously failed to match purely because they don't say "multimedia" now
// correctly match.
eq("a real listing with no 'multimedia' now matches", matchesQuery("Edifier R1280T Powered Bookshelf Speakers", QUERY), true);
eq("a real listing with 'System' wording still matches ('system' is generic too)", matchesQuery("EDIFIER R1280T Active Speaker System with Dual RCA Inputs - White", QUERY), true);

// The exact real bundle listings: excluded, even though they genuinely mention R1280T.
eq(
  "a speaker+subwoofer bundle is excluded",
  isNotTheItem("EDIFIER R1280Ts Wood Active Bookshelf Speakers with Sub-out T5 Active Subwoofer", QUERY, false, false),
  true
);
eq(
  "a turntable+speaker bundle is excluded",
  isNotTheItem("Audio-Technica AT-LP60X Turntable and Edifier R1280T Active Speaker Package Exclusive Set", QUERY, false, false),
  true
);
eq(
  "a different turntable+speaker bundle is excluded",
  isNotTheItem("Audio-Technica AT-LPW50PB Turntable + Edifier R1280T Active Bookshelf Speakers", QUERY, false, false),
  true
);

// A real, genuine standalone listing must be completely unaffected.
eq(
  "a real standalone speaker listing is unaffected",
  isNotTheItem("Edifier R1280T Powered Bookshelf Speakers", QUERY, false, false),
  false
);
eq(
  "a real standalone listing mentioning a wireless remote (not a bundle) is unaffected",
  isNotTheItem("Edifier R1280T Active Bookshelf Speakers 2.0, with Wireless Remote", QUERY, false, false),
  false
);

// Self-correction: someone actually scanning a turntable must not have real turntable listings
// excluded just for saying "turntable" — same existing rule NOT_THE_ITEM already relies on.
eq(
  "scanning an actual turntable is unaffected by the bundle-word check",
  isNotTheItem("Audio-Technica AT-LP60X Turntable Black", "Audio-Technica AT-LP60X Turntable", false, false),
  false
);
eq(
  "scanning an actual subwoofer is unaffected by the bundle-word check",
  isNotTheItem("Edifier T5 Active Subwoofer Black", "Edifier T5 Active Subwoofer", false, false),
  false
);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
