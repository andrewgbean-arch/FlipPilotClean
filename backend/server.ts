import "./utils/asyncErrors";
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
import registerSafetyRoute from "./routes/safety";
import registerUploadsRoute from "./routes/uploads";
import registerMeRoute from "./routes/me";
import registerAdvertsRoute from "./routes/adverts";
import registerAuthRoutes from "./routes/auth";
import { fetchMotHistory } from "./utils/dvsaMot";
import registerCreditsRoutes from "./routes/credits";
import registerCostsRoute from "./routes/costs";
import registerBoostRoute from "./routes/boost";
import registerWebhookRoutes from "./routes/webhooks";
import { DATA_DIR } from "./config/dataDir";
import { accountGuard } from "./middleware/accountGuard";
import { runRetention } from "./utils/retentionJob";
import { logLaunchChecks } from "./utils/launchCheck";
import registerAIDescriptionRoute from "./routes/aiDescription";
import registerListingDescriptionRoute from "./routes/listingDescription";
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
// Method, path, status and time. The query string is left out on purpose: it
// carries device ids, barcodes and vehicle registrations, which have no
// business sitting in the host's logs.
app.use(
  morgan((tokens, req, res) =>
    [
      tokens.method(req, res),
      (req.originalUrl || req.url || "").split("?")[0],
      tokens.status(req, res),
      `${tokens["response-time"](req, res)}ms`,
    ].join(" ")
  )
);

/* -------------------------------------------------------
   DISABLE ALL CACHING
------------------------------------------------------- */
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  next();
});

// Who is asking, and whether they may act as the id they name (see middleware/accountGuard.ts).
app.use(accountGuard);
registerAuthRoutes(app);
registerCreditsRoutes(app);
registerCostsRoute(app);

// The Marketplace has no sign-in yet (anyone can post a listing or a message,
// under whatever name they type in), so the write routes below carry their own
// rate limit. Publishing follows the launch-offer rules in
// config/marketplacePolicy.ts (listingPolicy, applied in publishListing.ts);
// browsing and messaging stay open. /ai/description writes a fixed template, not a paid AI call.
registerPublishedListingsRoute(app);
registerPublishListingRoute(app);
registerFairsRoute(app);
registerMessagesRoute(app);
registerSellersRoute(app);
registerBoostRoute(app);
registerWebhookRoutes(app);
registerSafetyRoute(app);
registerUploadsRoute(app);
registerMeRoute(app);
registerAdvertsRoute(app);
registerAIDescriptionRoute(app);
registerListingDescriptionRoute(app);
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
  console.warn(`⚠️  Missing environment variable(s): ${missingEbayBrowseEnv.join(", ")} — eBay price data is off until these are set in backend/.env. Get them free at developer.ebay.com.`);
}

/* -------------------------------------------------------
   ⭐ DVSA MOT HISTORY API — OAuth2 client-credentials
   The old beta.check-mot.service.gov.uk API was decommissioned;
   the current API requires a bearer token from TOKEN_URL plus
   the x-api-key header. Token is cached until near expiry.
------------------------------------------------------- */
// The base URLs can be overridden so the lookup can be tested against a local stand-in.
const DVLA_URL =
  process.env.DVLA_API_URL ||
  "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";

// A government service that hangs must not hang the app with it.
const UPSTREAM_TIMEOUT_MS = 10_000;

// People type "AB12 CDE", "ab12-cde" and the like; both services want "AB12CDE".
// Anything with other characters is rejected rather than cleaned up, so it never reaches a URL.
function normaliseReg(input: unknown): string | null {
  if (typeof input !== "string" || !/^[A-Za-z0-9 -]{1,12}$/.test(input)) return null;
  const reg = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return reg.length >= 1 && reg.length <= 8 ? reg : null;
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

  // A request the server could not even read (bad JSON, a body over the limit) is the caller's mistake: 4xx, not 500.
  const given = Number((err as any)?.status ?? (err as any)?.statusCode);
  const status = Number.isInteger(given) && given >= 400 && given < 500 ? given : 500;

  if (status === 500) console.error("Unhandled error:", error.message);
  res.status(status).json({
    ok: false,
    error:
      status === 413
        ? "That request is too large."
        : status < 500
        ? "That request couldn't be read."
        : process.env.NODE_ENV === "production"
        ? "Something went wrong."
        : error.message
  });
});

/* -------------------------------------------------------
   START SERVER
------------------------------------------------------- */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 FlipPilot backend listening on http://0.0.0.0:${PORT}`);
  console.log(`Data folder: ${DATA_DIR}`);
});

logLaunchChecks();

if (!process.env.MARKETPLACE_PROMO_ENDS_AT || Number.isNaN(new Date(process.env.MARKETPLACE_PROMO_ENDS_AT).getTime())) {
  console.warn("⚠️  MARKETPLACE_PROMO_ENDS_AT is not set (or not a date): the free-listing launch offer has no end date and will run until you set one.");
}

// Delete data that has outlived its retention period (config/retention.ts): once
// shortly after start, then every six hours. A failed run is logged and tried
// again next time; it must never take the server down.
function retentionPass() {
  try {
    const removed = runRetention();
    const total = Object.values(removed).reduce((a, b) => a + b, 0);
    if (total > 0) console.log("Retention clean-up removed:", JSON.stringify(removed));
  } catch (err: any) {
    console.log("Retention clean-up failed:", err?.message || err);
  }
}
setTimeout(retentionPass, 30_000).unref();
setInterval(retentionPass, 6 * 60 * 60 * 1000).unref();
