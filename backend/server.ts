import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import axios from "axios";
import registerPublishListingRoute from "./routes/publishListing";
import registerPublishedListingsRoute from "./routes/publishedListings";
import registerFairsRoute from "./routes/fairs";
import registerMessagesRoute from "./routes/messages";
import registerSellersRoute from "./routes/sellers";
import registerAIDescriptionRoute from "./routes/aiDescription";
import registerEbayExportRoute from "./routes/ebayExport";
import searchRoute from "./routes/search";
import searchImageRoute from "./routes/searchImage";
import scanStepsRoute from "./routes/scanSteps";
import vehiclePhotoAnalysisRoute from "./routes/vehiclePhotoAnalysis";
import vehiclePriceRoute from "./routes/vehiclePrice";
import { rateLimit } from "./middleware/rateLimit";



dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Set TRUST_PROXY_HOPS=1 when hosted behind one proxy (Render, Fly, Heroku ...) so
// req.ip is the real caller. Left at 0 for running on your own network.
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS) || 0;
if (trustProxyHops > 0) app.set("trust proxy", trustProxyHops);

/* -------------------------------------------------------
   MIDDLEWARE
   Must run BEFORE routes are registered — otherwise req.body
   is undefined for every POST route (a bug that silently broke
   /search-image, /ai/description, publish-listing and messages).
------------------------------------------------------- */
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(helmet());
app.use(morgan("dev"));

/* -------------------------------------------------------
   DISABLE ALL CACHING
------------------------------------------------------- */
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  next();
});

// The Marketplace has no sign-in yet (anyone can post a listing or a message,
// under whatever name they type in), so the write routes below carry their own
// rate limit. Publishing a listing also needs a verified Pro subscriber
// (sellingGate, applied in publishListing.ts) - browsing and messaging stay
// open. /ai/description writes a fixed template, not a paid AI call.
registerPublishedListingsRoute(app);
registerPublishListingRoute(app);
registerFairsRoute(app);
registerMessagesRoute(app);
registerSellersRoute(app);
registerAIDescriptionRoute(app);
registerEbayExportRoute(app);
app.use(searchRoute);
app.use(searchImageRoute);
app.use(scanStepsRoute);
app.use(vehiclePhotoAnalysisRoute);
app.use(vehiclePriceRoute);

/* -------------------------------------------------------
   ENV VALIDATION
   MOT lookup (DVSA MOT History API, OAuth2 client-credentials)
   and DVLA lookup (Vehicle Enquiry Service) are independent —
   /vehicle works with whichever one is configured instead of
   requiring both, so a missing key warns instead of crashing
   the whole server on boot.
------------------------------------------------------- */
const motLookupEnv = ["API_KEY", "TOKEN_URL", "CLIENT_ID", "CLIENT_SECRET", "SCOPE_URL"];
const dvlaLookupEnv = ["DVLA_API_KEY"];
const ebayBrowseEnv = ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"];

const missingMotEnv = motLookupEnv.filter((key) => !process.env[key]);
const missingDvlaEnv = dvlaLookupEnv.filter((key) => !process.env[key]);
const missingEbayBrowseEnv = ebayBrowseEnv.filter((key) => !process.env[key]);

if (missingMotEnv.length > 0) {
  console.warn(`⚠️  Missing environment variable(s): ${missingMotEnv.join(", ")} — MOT lookup disabled until these are set in backend/.env`);
}
if (missingDvlaEnv.length > 0) {
  console.warn(`⚠️  Missing environment variable(s): ${missingDvlaEnv.join(", ")} — DVLA lookup disabled until these are set in backend/.env`);
}
if (missingEbayBrowseEnv.length > 0) {
  console.warn(`⚠️  Missing environment variable(s): ${missingEbayBrowseEnv.join(", ")} — using the older SerpAPI eBay scraper (less reliable) until these are set in backend/.env. Get them free at developer.ebay.com.`);
}

/* -------------------------------------------------------
   ⭐ DVSA MOT HISTORY API — OAuth2 client-credentials
   The old beta.check-mot.service.gov.uk API was decommissioned;
   the current API requires a bearer token from TOKEN_URL plus
   the x-api-key header. Token is cached until near expiry.
------------------------------------------------------- */
let motTokenCache: { token: string; expiresAt: number } | null = null;

// The base URLs can be overridden so the lookup can be tested against a local stand-in.
const DVLA_URL =
  process.env.DVLA_API_URL ||
  "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";
const MOT_URL =
  process.env.MOT_API_URL ||
  "https://history.mot.api.gov.uk/v1/trade/vehicles/registration";

// A government service that hangs must not hang the app with it.
const UPSTREAM_TIMEOUT_MS = 10_000;

// People type "AB12 CDE", "ab12-cde" and the like; both services want "AB12CDE".
// Anything with other characters is rejected rather than cleaned up, so it never reaches a URL.
function normaliseReg(input: unknown): string | null {
  if (typeof input !== "string" || !/^[A-Za-z0-9 -]{1,12}$/.test(input)) return null;
  const reg = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return reg.length >= 1 && reg.length <= 8 ? reg : null;
}

async function getMotAccessToken(): Promise<string> {
  if (motTokenCache && motTokenCache.expiresAt > Date.now() + 30_000) {
    return motTokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.CLIENT_ID!,
    client_secret: process.env.CLIENT_SECRET!,
    scope: process.env.SCOPE_URL!
  });

  const tokenRes = await axios.post(process.env.TOKEN_URL!, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: UPSTREAM_TIMEOUT_MS
  });

  const { access_token, expires_in } = tokenRes.data;
  motTokenCache = {
    token: access_token,
    expiresAt: Date.now() + Number(expires_in ?? 3600) * 1000
  };

  return access_token;
}

async function fetchMotHistory(reg: string) {
  const token = await getMotAccessToken();

  const res = await axios.get(`${MOT_URL}/${encodeURIComponent(reg)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-api-key": process.env.API_KEY!
    },
    timeout: UPSTREAM_TIMEOUT_MS,
    // 400 = not a valid registration, 404 = no such vehicle: both mean "nothing to show", not "broken".
    validateStatus: (status) => status === 200 || status === 400 || status === 404
  });

  if (res.status !== 200) return null;
  return res.data;
}

type Lookup = { data: any; failed: boolean };

// `failed` means the service itself did not answer properly (down, refused our key, timed out).
// "No such vehicle" is a normal answer: data is null and failed is false.
async function lookupDvla(reg: string): Promise<Lookup> {
  try {
    const res = await axios.post(
      DVLA_URL,
      { registrationNumber: reg },
      {
        headers: {
          "x-api-key": process.env.DVLA_API_KEY!,
          "Content-Type": "application/json"
        },
        timeout: UPSTREAM_TIMEOUT_MS,
        // 400 = not a valid registration, 404 = no such vehicle: nothing to show, not a fault.
        validateStatus: (status) => status === 200 || status === 400 || status === 404
      }
    );
    return { data: res.status === 200 ? res.data : null, failed: false };
  } catch (err: any) {
    console.error("DVLA LOOKUP ERROR:", err.response?.status ?? err.code ?? err.message);
    return { data: null, failed: true };
  }
}

async function lookupMot(reg: string): Promise<Lookup> {
  try {
    return { data: await fetchMotHistory(reg), failed: false };
  } catch (err: any) {
    console.error("MOT LOOKUP ERROR:", err.response?.status ?? err.code ?? err.message);
    return { data: null, failed: true };
  }
}

/* -------------------------------------------------------
   HEALTH CHECK
------------------------------------------------------- */
app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    message: "FlipPilot backend running",
    timestamp: new Date().toISOString()
  });
});

/* -------------------------------------------------------
   ⭐ MERGED VEHICLE LOOKUP — REAL DVLA + REAL MOT
------------------------------------------------------- */
app.get("/vehicle", rateLimit(30), async (req, res) => {
  try {
    if (missingMotEnv.length > 0 && missingDvlaEnv.length > 0) {
      // The boot warnings already name what is missing; clients only need to know it is not set up.
      return res.status(503).json({
        ok: false,
        error: "Vehicle lookup isn't set up on the server yet."
      });
    }

    const reg = normaliseReg(req.query.reg);
    if (!reg) {
      return res.status(400).json({
        ok: false,
        error: "Enter a valid UK registration, for example AB12 CDE."
      });
    }

    /* -----------------------------
       1 + 2. DVLA VEHICLE DATA and MOT HISTORY (each optional — skipped if not configured)
       They don't depend on each other, so ask both at once: it is faster, and a slow
       service costs one timeout instead of two.
    ----------------------------- */
    const [dvlaResult, motResult] = await Promise.all([
      missingDvlaEnv.length > 0 ? null : lookupDvla(reg),
      missingMotEnv.length > 0 ? null : lookupMot(reg)
    ]);

    const dvla = dvlaResult?.data ?? null;
    const dvlaFailed = dvlaResult?.failed ?? false;
    const mot = motResult?.data ?? null;
    const motFailed = motResult?.failed ?? false;

    if (!dvla && !mot) {
      // A service that errored says nothing about whether the vehicle exists, so don't claim it doesn't.
      if (dvlaFailed || motFailed) {
        return res.status(502).json({
          ok: false,
          error: "The vehicle lookup isn't responding right now. Please try again in a moment."
        });
      }

      return res.status(404).json({
        ok: false,
        error: `We couldn't find a vehicle with the registration ${reg}. Check it and try again.`
      });
    }

    // Newest test first, whatever order the service returns them in.
    const tests: any[] = Array.isArray(mot?.motTests) ? mot.motTests : [];
    const completedAt = (test: any) => Date.parse(test?.completedDate) || 0;
    const latestMot = [...tests].sort((a, b) => completedAt(b) - completedAt(a))[0] ?? null;

    /* -----------------------------
       3. MERGE WHATEVER WE HAVE INTO ONE OBJECT
    ----------------------------- */
    const merged = {
      ok: true,
      reg,
      dvla,
      mot,
      dvlaAvailable: !!dvla,
      motAvailable: !!mot,
      vehicle: {
        make: dvla?.make ?? mot?.make ?? null,
        model: dvla?.model ?? mot?.model ?? null,
        colour: dvla?.colour ?? mot?.primaryColour ?? null,
        fuelType: dvla?.fuelType ?? mot?.fuelType ?? null,
        engineSize: dvla?.engineCapacity ?? null,
        year: dvla?.yearOfManufacture ?? null,
        taxStatus: dvla?.taxStatus ?? null,
        motExpiry: dvla?.motExpiryDate ?? latestMot?.expiryDate ?? null,

        mileage: latestMot?.odometerValue ?? null,
        mileageUnit: latestMot?.odometerUnit ?? null,
        lastMotDate: latestMot?.completedDate ?? null,

        advisories: latestMot?.rfrAndComments?.filter((x: any) => x.type === "ADVISORY") ?? [],
        failures: latestMot?.rfrAndComments?.filter((x: any) => x.type === "FAIL") ?? []
      }
    };

    return res.json(merged);

  } catch (err: any) {
    // Never pass an upstream response body through: it is not written for users and can be an object.
    console.error("VEHICLE LOOKUP ERROR:", err.response?.status ?? err.message);
    return res.status(500).json({
      ok: false,
      error: "Something went wrong looking up that registration. Please try again."
    });
  }
});

/* -------------------------------------------------------
   GLOBAL ERROR HANDLER
------------------------------------------------------- */
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const error = err instanceof Error ? err : new Error("Unknown error");

  console.error("Unhandled error:", error.message);
  res.status(500).json({
    ok: false,
    error: process.env.NODE_ENV === "production" ? "Something went wrong." : error.message
  });
});

/* -------------------------------------------------------
   START SERVER
------------------------------------------------------- */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 FlipPilot backend listening on http://0.0.0.0:${PORT}`);
});
