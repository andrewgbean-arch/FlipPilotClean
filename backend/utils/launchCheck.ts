import { freeScanCapEnabled } from "../middleware/freeScanLimit";

/**
 * A list of what is still not set up for real customers, worked out from the
 * server's own settings and printed when it starts. It only ever READS the names
 * of settings (never prints a value), and nothing here changes how the server
 * behaves: it is a checklist that can't be forgotten, because the server says it
 * out loud every time it starts.
 *
 * "must" means real users would be harmed or locked out. "should" means it works
 * but is weaker or less complete than it should be.
 */

export type LaunchIssue = { level: "must" | "should"; setting: string; why: string };

type Env = Record<string, string | undefined>;

const has = (env: Env, name: string) => Boolean(env[name] && env[name]!.trim());

export function launchIssues(env: Env = process.env): LaunchIssue[] {
  const out: LaunchIssue[] = [];
  const add = (level: LaunchIssue["level"], setting: string, why: string) => out.push({ level, setting, why });

  if (env.NODE_ENV !== "production") {
    add("must", "NODE_ENV=production", "Without it, error replies show internal details and the free-scan cap is off.");
  }
  if (!has(env, "ADMIN_TOKEN")) {
    add("must", "ADMIN_TOKEN", "Without it you cannot approve adverts, read reports or see flagged listings.");
  }
  if (!has(env, "TOKEN_ENCRYPTION_KEY")) {
    add("must", "TOKEN_ENCRYPTION_KEY", "Needed to store people's eBay connections safely (32+ characters). Connecting eBay fails without it.");
  }
  if (!has(env, "PUBLIC_BASE_URL")) {
    add("must", "PUBLIC_BASE_URL", "Photos and advert pictures are given full web addresses from this. Behind a proxy without it they can point at the wrong place.");
  }
  if (!has(env, "MARKETPLACE_PROMO_ENDS_AT") || Number.isNaN(new Date(env.MARKETPLACE_PROMO_ENDS_AT!).getTime())) {
    add("must", "MARKETPLACE_PROMO_ENDS_AT", "The free-listing launch offer has no end date, so it never ends.");
  }
  if (has(env, "SELLING_ALLOWED_DEVICE_IDS")) {
    add("must", "SELLING_ALLOWED_DEVICE_IDS (remove it)", "Named test phones skip every selling limit. It must be empty for real customers.");
  }
  if (!has(env, "TRUST_PROXY_HOPS")) {
    add("must", "TRUST_PROXY_HOPS", "Behind a host's proxy every customer looks like one address, so one person's requests can lock everyone out. Set it to how many proxies are in front (often 1 or 2).");
  }
  if (!has(env, "REVENUECAT_SECRET_KEY")) {
    add(
      "must",
      "REVENUECAT_SECRET_KEY",
      has(env, "REVENUECAT_API_KEY")
        ? "The server reads REVENUECAT_SECRET_KEY, but only REVENUECAT_API_KEY is set. Paying Pro users would be treated as free until it is set."
        : "Without it paying Pro users are treated as free."
    );
  }
  if (!has(env, "OPENAI_API_KEY")) {
    add("must", "OPENAI_API_KEY", "Scans, descriptions and the advert AI check need it. The AI check falls back to 'unchecked' without it.");
  }
  if (!freeScanCapEnabled()) {
    add("must", "FREE_SCAN_CAP", "The 5-scans-a-week free limit is OFF. It is on by default in production; remove FREE_SCAN_CAP=off.");
  }
  if (!has(env, "DVLA_API_KEY")) {
    add("should", "DVLA_API_KEY", "Vehicle number-plate lookups need it.");
  }
  if (has(env, "ADVERT_AI_REVIEW")) {
    add("should", "ADVERT_AI_REVIEW (remove it)", "It switches the advert AI check off or fakes it, which is only for testing.");
  }
  add("should", "a persistent disk for backend/data", "Listings, messages and counters are files. On a host without a persistent disk they are wiped on every redeploy. (Cannot be detected from here.)");
  return out;
}

/** Prints the list at start-up, in words, without ever printing a value. */
export function logLaunchChecks(env: Env = process.env): void {
  const issues = launchIssues(env);
  const production = env.NODE_ENV === "production";
  const must = issues.filter((i) => i.level === "must");
  const should = issues.filter((i) => i.level === "should");

  if (!production) {
    console.log(
      `ℹ️  Development mode: ${must.length} setting(s) still to set before real customers (fine for testing). Start with NODE_ENV=production to see them listed.`
    );
    return;
  }

  if (must.length === 0) console.log("✅ Launch check: every must-have setting is in place.");
  for (const i of must) console.warn(`⛔ LAUNCH CHECK, must fix: ${i.setting}: ${i.why}`);
  for (const i of should) console.warn(`⚠️  Launch check, should fix: ${i.setting}: ${i.why}`);
}
