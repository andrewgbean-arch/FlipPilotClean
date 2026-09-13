import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import axios from "axios";
import fs from "fs";
import path from "path";
import registerPublishListingRoute from "./routes/publishListing";
import registerPublishedListingsRoute from "./routes/publishedListings";
import registerMessagesRoute from "./routes/messages";
import registerAIDescriptionRoute from "./routes/aiDescription";
import searchRoute from "./routes/search";
import searchImageRoute from "./routes/searchImage";
import vehiclePhotoAnalysisRoute from "./routes/vehiclePhotoAnalysis";


import {
  getUser,
  incrementUsage,
  isOverLimit,
  isDeviceAllowed,
  lockDevice
} from "./userstore";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

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

registerPublishedListingsRoute(app);
registerPublishListingRoute(app);
registerMessagesRoute(app);
registerAIDescriptionRoute(app);
app.use(searchRoute);
app.use(searchImageRoute);
app.use(vehiclePhotoAnalysisRoute);

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

const missingMotEnv = motLookupEnv.filter((key) => !process.env[key]);
const missingDvlaEnv = dvlaLookupEnv.filter((key) => !process.env[key]);

if (missingMotEnv.length > 0) {
  console.warn(`⚠️  Missing environment variable(s): ${missingMotEnv.join(", ")} — MOT lookup disabled until these are set in backend/.env`);
}
if (missingDvlaEnv.length > 0) {
  console.warn(`⚠️  Missing environment variable(s): ${missingDvlaEnv.join(", ")} — DVLA lookup disabled until these are set in backend/.env`);
}

/* -------------------------------------------------------
   ⭐ DVSA MOT HISTORY API — OAuth2 client-credentials
   The old beta.check-mot.service.gov.uk API was decommissioned;
   the current API requires a bearer token from TOKEN_URL plus
   the x-api-key header. Token is cached until near expiry.
------------------------------------------------------- */
let motTokenCache: { token: string; expiresAt: number } | null = null;

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
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
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

  const res = await axios.get(
    `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${reg}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-api-key": process.env.API_KEY!
      },
      validateStatus: (status) => status === 200 || status === 404
    }
  );

  if (res.status === 404) return null;
  return res.data;
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
app.get("/vehicle", async (req, res) => {
  try {
    if (missingMotEnv.length > 0 && missingDvlaEnv.length > 0) {
      return res.status(503).json({
        ok: false,
        error: `Vehicle lookup is not configured — missing: ${[...missingMotEnv, ...missingDvlaEnv].join(", ")}`
      });
    }

    const reg = req.query.reg as string;
    if (!reg) return res.status(400).json({ ok: false, error: "Missing reg" });

    /* -----------------------------
       1. DVLA VEHICLE DATA (optional — skipped if not configured)
    ----------------------------- */
    let dvla: any = null;
    if (missingDvlaEnv.length === 0) {
      try {
        const dvlaRes = await axios.post(
          "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles",
          { registrationNumber: reg },
          {
            headers: {
              "x-api-key": process.env.DVLA_API_KEY!,
              "Content-Type": "application/json"
            }
          }
        );
        dvla = dvlaRes.data;
      } catch (err: any) {
        console.error("❌ DVLA LOOKUP ERROR:", err.response?.data || err.message);
      }
    }

    /* -----------------------------
       2. MOT HISTORY DATA (optional — skipped if not configured)
    ----------------------------- */
    let mot: any = null;
    let latestMot: any = null;
    if (missingMotEnv.length === 0) {
      mot = await fetchMotHistory(reg);
      latestMot = mot?.motTests?.[0] ?? null;
    }

    if (!dvla && !mot) {
      return res.status(404).json({ ok: false, error: `No vehicle data found for ${reg}` });
    }

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
    console.error("❌ VEHICLE MERGE ERROR:", err.response?.data || err.message);
    return res.status(500).json({
      ok: false,
      error: err.response?.data || err.message
    });
  }
});

/* -------------------------------------------------------
   DEVICE LOCK
------------------------------------------------------- */
app.post("/auth/device-lock", (req, res) => {
  const { userId, deviceId } = req.body;

  if (!userId || !deviceId) {
    return res.status(400).json({ ok: false, error: "Missing userId or deviceId" });
  }

  lockDevice(userId, deviceId);

  res.status(200).json({ ok: true, message: "Device locked" });
});

/* -------------------------------------------------------
   AI PRICE DETECTOR
------------------------------------------------------- */
app.post("/scan", async (req, res, next) => {
  try {
    const { userId, deviceId, barcode, imageBase64, store, location } = req.body;

    if (!userId || !deviceId) {
      return res.status(400).json({ ok: false, error: "Missing userId or deviceId" });
    }

    const user = getUser(userId);

    if (!isDeviceAllowed(userId, deviceId)) {
      return res.status(403).json({ ok: false, error: "Device not allowed" });
    }

    if (isOverLimit(userId)) {
      return res.status(429).json({ ok: false, error: "Usage limit reached" });
    }

    incrementUsage(userId, "vision");

    const product = {
      barcode: barcode ?? "N/A",
      title: "Sample Product",
      base_price: 2.99,
      category: "Grocery"
    };

    const fair_price = product.base_price * 1.25;
    const suggested_buy = product.base_price * 0.9;
    const suggested_sell = fair_price;
    const flip_score = Math.floor(Math.random() * 25) + 70;

    res.status(200).json({
      ok: true,
      product,
      ai: {
        fair_price,
        suggested_buy,
        suggested_sell,
        flip_score
      },
      image: imageBase64 ?? null,
      store,
      location
    });
  } catch (err) {
    console.error("❌ SCAN ERROR:", err);
    next(err);
  }
});

/* -------------------------------------------------------
   VAN JOBS
------------------------------------------------------- */
app.get("/jobs", (_req, res) => {
  const jobs = [
    {
      id: 1,
      title: "Deliver parcels to Torquay",
      pay: 42,
      distance_km: 8,
      time_window: "18:00 - 20:00",
      status: "open"
    },
    {
      id: 2,
      title: "Pick up returns from Paignton",
      pay: 35,
      distance_km: 5,
      time_window: "19:00 - 21:00",
      status: "open"
    }
  ];

  res.status(200).json({ ok: true, jobs });
});

/* -------------------------------------------------------
   ACCEPT JOB
------------------------------------------------------- */
app.post("/jobs/:id/accept", (req, res) => {
  const jobId = Number(req.params.id);

  res.status(200).json({
    ok: true,
    jobId,
    message: `Job ${jobId} accepted`,
    status: "accepted",
    timestamp: new Date().toISOString()
  });
});

/* -------------------------------------------------------
   ADMIN STATS
------------------------------------------------------- */
app.get("/stats", (_req, res) => {
  const storePath = path.join(__dirname, "data", "users.json");
  const raw = fs.readFileSync(storePath, "utf8");
  const users = JSON.parse(raw);

  const totalUsers = Object.keys(users).length;
  const totalBarcode = Object.values(users).reduce((a: number, u: any) => a + u.barcodeUses, 0);
  const totalVision = Object.values(users).reduce((a: number, u: any) => a + u.visionUses, 0);

  res.status(200).json({
    ok: true,
    totalUsers,
    totalBarcode,
    totalVision
  });
});
app.post("/car-listings", (req, res) => {
  const listing = req.body;

  const filePath = path.join(__dirname, "data", "car-listings.json");

  let existing = [];
  if (fs.existsSync(filePath)) {
    existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  existing.push({
    ...listing,
    id: existing.length + 1,
    createdAt: new Date().toISOString()
  });

  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));

  res.json({ ok: true, id: existing.length });
});

/* -------------------------------------------------------
   GLOBAL ERROR HANDLER
------------------------------------------------------- */
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const error = err instanceof Error ? err : new Error("Unknown error");

  res.status(500).json({
    ok: false,
    error: error.message
  });
});

/* -------------------------------------------------------
   START SERVER
------------------------------------------------------- */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 FlipPilot backend listening on http://0.0.0.0:${PORT}`);
});
