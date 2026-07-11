import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(morgan("dev"));

// Health check
app.get("/", (_req, res) => {
  res.json({ ok: true, message: "FlipPilot backend running" });
});

/* -------------------------------------------------------
   AI PRICE DETECTOR — /scan
------------------------------------------------------- */
app.post("/scan", async (req, res) => {
  try {
    const { barcode, imageBase64, store, location } = req.body;

    // Mock product lookup (replace later with real DB or API)
    const product = {
      barcode: barcode ?? "N/A",
      title: "Sample Product",
      base_price: 2.99,
      category: "Grocery"
    };

    // Mock AI price logic (replace with OpenAI later)
    const fair_price = product.base_price * 1.25;
    const suggested_buy = product.base_price * 0.9;
    const suggested_sell = fair_price;
    const flip_score = Math.floor(Math.random() * 25) + 70; // 70–95

    res.json({
      ok: true,
      product,
      ai: {
        fair_price,
        suggested_buy,
        suggested_sell,
        flip_score
      },
      image: imageBase64 ?? null
    });
  } catch (err) {
    console.error("SCAN ERROR:", err);
    res.status(500).json({ ok: false, error: "Scan failed" });
  }
});

/* -------------------------------------------------------
   VAN JOBS — /jobs
------------------------------------------------------- */
app.get("/jobs", (req, res) => {
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

  res.json({ ok: true, jobs });
});

/* -------------------------------------------------------
   ACCEPT JOB — /jobs/:id/accept
------------------------------------------------------- */
app.post("/jobs/:id/accept", (req, res) => {
  const jobId = Number(req.params.id);

  res.json({
    ok: true,
    jobId,
    message: `Job ${jobId} accepted`,
    status: "accepted",
    timestamp: new Date().toISOString()
  });
});

/* -------------------------------------------------------
   START SERVER
------------------------------------------------------- */
app.listen(PORT, () => {
  console.log(`FlipPilot backend listening on http://localhost:${PORT}`);
});
