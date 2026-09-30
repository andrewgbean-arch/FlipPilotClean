// Run with: npx tsx market-backend/checks/fetchMarketData.googleStillMissing.check.ts (from the backend folder).
// Found live 2026-09-30: the call to evidenceCacheSet used `googleStartedLate && (!google ||
// google.avg == null)` to decide whether Google's evidence was "still missing" (and so should NOT
// be cached for the full 10-minute TTL — see fetchMarketData.evidenceCache.check.ts for that
// mechanism, added the day before for exactly this reason). `googleStartedLate` is only ever set
// true inside the GOOGLE_SHOPPING=when-needed branch; in GOOGLE_SHOPPING=always mode Google is
// asked up front and that flag never becomes true for the whole call — so a genuine Google
// timeout/error in "always" mode was never treated as missing, silently re-locking in the exact
// "bad price cached for 10 minutes" bug this mechanism exists to prevent, just in the other mode.
import { googleStillMissing } from "../fetchMarketData";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};

// The exact real case: GOOGLE_SHOPPING=always means googleSkipped is always false (Google is
// always asked), and here it came back empty — this must be treated as missing.
eq("always mode, Google timed out/errored (null)", googleStillMissing(false, null), true);
eq("always mode, Google answered but with no usable average", googleStillMissing(false, { avg: null }), true);
eq("always mode, Google genuinely answered", googleStillMissing(false, { avg: 84.99 }), false);

// when-needed mode, Google was asked (started late) and still came back empty — same as before.
eq("when-needed mode, asked late and still missing", googleStillMissing(false, null), true);

// when-needed mode, Google was never asked at all because eBay alone was strong enough — not
// "missing", it was never expected to answer, so this must NOT block caching.
eq("when-needed mode, genuinely skipped, no Google evidence", googleStillMissing(true, null), false);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
