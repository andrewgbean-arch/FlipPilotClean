import axios from "axios";

/**
 * The DVSA's MOT history service: every MOT test a car has had, with the mileage the tester read
 * off the odometer each time. It is the government's own record, so it is the best evidence there
 * is of a car's real mileage.
 *
 * OAuth2 client-credentials: a bearer token from TOKEN_URL plus the x-api-key header. The token is
 * kept until shortly before it expires. The base URLs can be overridden so this can be tested
 * against a local stand-in.
 */

let motTokenCache: { token: string; expiresAt: number } | null = null;

// A government service that hangs must not hang the app with it.
const UPSTREAM_TIMEOUT_MS = 10_000;

const motBaseUrl = () => process.env.MOT_API_URL || "https://history.mot.api.gov.uk/v1/trade/vehicles/registration";

/** Is the MOT service set up at all? Without these there is simply no MOT data. */
export const motConfigured = () =>
  Boolean(process.env.CLIENT_ID && process.env.CLIENT_SECRET && process.env.SCOPE_URL && process.env.TOKEN_URL && process.env.API_KEY);

async function getMotAccessToken(): Promise<string> {
  if (motTokenCache && motTokenCache.expiresAt > Date.now() + 30_000) {
    return motTokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.CLIENT_ID!,
    client_secret: process.env.CLIENT_SECRET!,
    scope: process.env.SCOPE_URL!,
  });

  const tokenRes = await axios.post(process.env.TOKEN_URL!, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: UPSTREAM_TIMEOUT_MS,
  });

  const { access_token, expires_in } = tokenRes.data;
  motTokenCache = {
    token: access_token,
    expiresAt: Date.now() + Number(expires_in ?? 3600) * 1000,
  };

  return access_token;
}

/** The car's MOT history, or null if the DVSA has none (an unknown or brand-new car). Throws if the service fails. */
export async function fetchMotHistory(reg: string) {
  const token = await getMotAccessToken();

  const res = await axios.get(`${motBaseUrl()}/${encodeURIComponent(reg)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-api-key": process.env.API_KEY!,
    },
    timeout: UPSTREAM_TIMEOUT_MS,
    // 400 = not a valid registration, 404 = no such vehicle: both mean "nothing to show", not "broken".
    validateStatus: (status) => status === 200 || status === 400 || status === 404,
  });

  if (res.status !== 200) return null;
  return res.data;
}

/* --------------------------------------------------
   What a buyer needs from it, in a small fixed shape
-------------------------------------------------- */

export type MotReading = { date: string; miles: number; result: "PASSED" | "FAILED" };

export type MotSummary = {
  checkedAt: string;
  testCount: number;
  failedCount: number;
  /** Oldest first. One reading per test, in miles. */
  readings: MotReading[];
  /** True when the mileage went DOWN between two tests by more than a rounding error. */
  mileageDrops: boolean;
  latest: {
    date: string;
    result: "PASSED" | "FAILED";
    expiryDate: string | null;
    miles: number | null;
    advisories: string[];
    failures: string[];
  } | null;
};

const KM_TO_MILES = 0.621371;
/** A reading may sit a little below the one before it (rounding, a re-test) without meaning anything. */
const DROP_TOLERANCE_MILES = 500;

const day = (v: unknown): string | null => {
  const t = Date.parse(String(v ?? ""));
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
};
const words = (v: unknown, max = 120): string => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Turns the DVSA's answer into the summary we keep, or null when there is no usable test history. */
export function summariseMot(mot: any, now = new Date()): MotSummary | null {
  const tests: any[] = Array.isArray(mot?.motTests) ? mot.motTests : [];

  const parsed = tests
    .map((t) => {
      const date = day(t?.completedDate);
      const raw = Number(String(t?.odometerValue ?? "").replace(/,/g, ""));
      const unit = String(t?.odometerUnit ?? "MI").toUpperCase();
      const miles = Number.isFinite(raw) && raw > 0 ? Math.round(unit.startsWith("K") ? raw * KM_TO_MILES : raw) : null;
      const result = String(t?.testResult ?? "").toUpperCase().startsWith("F") ? ("FAILED" as const) : ("PASSED" as const);
      return { t, date, miles, result };
    })
    .filter((x) => x.date)
    .sort((a, b) => Date.parse(a.date!) - Date.parse(b.date!));

  if (parsed.length === 0) return null;

  const readings: MotReading[] = parsed
    .filter((x) => x.miles !== null)
    .map((x) => ({ date: x.date!, miles: x.miles!, result: x.result }))
    .slice(-20);

  let mileageDrops = false;
  let highest = 0;
  for (const r of readings) {
    if (highest - r.miles > DROP_TOLERANCE_MILES) mileageDrops = true;
    highest = Math.max(highest, r.miles);
  }

  const last = parsed[parsed.length - 1];
  const lines = (type: string) =>
    (Array.isArray(last.t?.rfrAndComments) ? last.t.rfrAndComments : [])
      .filter((x: any) => String(x?.type ?? "").toUpperCase() === type)
      .map((x: any) => words(x?.text))
      .filter(Boolean)
      .slice(0, 6);

  return {
    checkedAt: now.toISOString(),
    testCount: parsed.length,
    failedCount: parsed.filter((x) => x.result === "FAILED").length,
    readings,
    mileageDrops,
    latest: {
      date: last.date!,
      result: last.result,
      expiryDate: day(last.t?.expiryDate),
      miles: last.miles,
      advisories: lines("ADVISORY"),
      failures: lines("FAIL"),
    },
  };
}

/** The highest reading on record: mileage only ever goes up, so nobody can honestly be below it. */
export const highestReading = (mot: MotSummary | null): { miles: number; date: string } | null => {
  if (!mot || mot.readings.length === 0) return null;
  return mot.readings.reduce((a, b) => (b.miles > a.miles ? b : a));
};
