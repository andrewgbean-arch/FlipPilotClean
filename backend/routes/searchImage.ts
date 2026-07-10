import { Router } from "express";
import axios from "axios";
import { rateLimit } from "../middleware/rateLimit";

const router = Router();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* --------------------------------------------------
   BULLETPROOF JSON EXTRACTOR
-------------------------------------------------- */
function extractJSON(text: string) {
  if (!text) return null;

  text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(text);
  } catch {}

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {}
  }

  return null;
}

/* --------------------------------------------------
   AI IMAGE IDENTIFIER — NEW RESPONSES API
-------------------------------------------------- */
async function identifyImage(base64: string) {
  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.2,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `
You are a professional product recognition system.

Return ONLY valid JSON with:
{
  "title": "Short product title",
  "description": "1–2 sentence summary",
  "fullDescription": "4–6 sentence detailed description",
  "condition": "New / Like New / Good / Fair / Poor",
  "conditionScore": number,
  "category": "Category",
  "origin": "Country or Unknown",
  "keywords": ["k1", "k2"],
  "confidence": number
}
            `
          },
          {
            type: "input_image",
            image_url: base64.startsWith("data:")
              ? base64
              : `data:image/jpeg;base64,${base64}`
          }
        ]
      }
    ]
  };

  try {
    const res = await axios.post(
      "https://api.openai.com/v1/responses",
      payload,
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const raw =
      res.data?.output?.[0]?.content?.[0]?.text?.trim() ||
      res.data?.output_text ||
      "";

  return extractJSON(raw);
} catch (err: any) {
  console.error("search-image error:", err);
  return null; // FIXED
}
}

/* --------------------------------------------------
   MAIN ROUTE — UPGRADED
-------------------------------------------------- */
router.post("/search-image", rateLimit(2), async (req, res) => {
  try {
    const { imageBase64, userId, deviceId } = req.body;

    if (!imageBase64 || imageBase64.length < 50) {
      return res.json({ error: "Invalid or missing image" });
    }

    const ai = await identifyImage(imageBase64);

    if (!ai) {
      return res.json({ error: "AI failed to analyse image" });
    }

    // Normalise fields
    ai.confidence = Number(ai.confidence) || 50;
    ai.conditionScore = Math.max(1, Math.min(10, Number(ai.conditionScore) || 5));
    ai.category = ai.category || "Unknown";
    ai.origin = ai.origin || "Unknown";

    // No barcode → no market data
    const market = {
      googlePriceMin: null,
      googlePriceMax: null,
      average: null,
      lowest: null,
      highest: null,
      smartPrice: null,
      soldCount: null,
      demandScore: null,
      items: []
    };

    const pricing = {
      recommendedBuyPrice: null,
      recommendedSellPrice: null,
      predictedProfit: null
    };

    const usage = {
      userId: userId ?? "unknown-user",
      deviceId: deviceId ?? "unknown-device",
      dailyUses: 1,
      dailyLimit: 20,
      monthlyUses: 1
    };

    return res.json({
      ai,
      market,
      pricing,
      ebayItems: [],
      flipScore: 50,
      flipPotential: "Medium",
      sellSpeed: "Unknown",
      rarity: "Unknown",
      insights: ai.fullDescription ?? ai.description ?? "",
      image: null,
      title: ai.title,
      usage
    });
  } catch (err) {
    console.error("🔥 search-image error:", err);
    return res.json({ error: "Lookup failed" });
  }
});

export default router;
