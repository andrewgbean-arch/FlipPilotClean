import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { rateLimit } from "./middleware/rateLimit";

import lookupRoute from "./routes/lookup";
import searchRoute from "./routes/search";

const app = express();

// --------------------------------------------------
// SECURITY MIDDLEWARE
// --------------------------------------------------

// Helmet → secure HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: false, // allow images
  })
);

// CORS → lock down to your app only
app.use(
  cors({
    origin: [
      "http://localhost:19006", // Expo local
      "http://localhost:3000",
      "https://your-production-domain.com",
    ],
    methods: ["GET", "POST"],
  })
);

// JSON body limit → prevents payload attacks
app.use(express.json({ limit: "2mb" }));

// Logging → useful for debugging + monitoring
app.use(morgan("dev"));

// --------------------------------------------------
// GLOBAL RATE LIMIT (light)
// --------------------------------------------------
app.use(rateLimit(20)); // 20 requests/min per IP per route

// --------------------------------------------------
// ROUTES
// --------------------------------------------------
app.use("/lookup", lookupRoute);
app.use("/search", searchRoute);

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------
app.get("/", (req, res) => {
  res.json({ status: "FlipPilot backend running" });
});

// --------------------------------------------------
// ERROR HANDLER (safety net)
// --------------------------------------------------
app.use((err: any, req: any, res: any, next: any) => {
  console.error("🔥 SERVER ERROR:", err);
  res.status(500).json({ error: "Internal server error" });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 FlipPilot backend running on port ${PORT}`);
});
