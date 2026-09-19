import { Router } from "express";
import axios from "axios";
import { rateLimit } from "../middleware/rateLimit";
import fetchMarketData from "../market-backend/fetchMarketData";
import { buildFlipMeta } from "../market-backend/buildFlipMeta";

const router = Router();

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
   AI IMAGE IDENTIFIER — RESPONSES API

   One photo, two questions asked AT THE SAME TIME:
     1. "what is it, and how many are in the pack?" — a few words of answer, so
        it comes back fast, and it is all the price lookup needs;
     2. "describe it" — the longer text, which nothing waits for.
   The price lookup starts as soon as (1) is back, while (2) is still being
   written. Before, one long answer had to finish before prices even started.
-------------------------------------------------- */
async function askVision(
  prompt: string,
  base64: string,
  options: { maxTokens: number; timeoutMs: number }
) {
  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_output_tokens: options.maxTokens,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
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
    const res = await axios.post("https://api.openai.com/v1/responses", payload, {
      timeout: options.timeoutMs,
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const raw =
      res.data?.output?.[0]?.content?.[0]?.text?.trim() ||
      res.data?.output_text ||
      "";

    return extractJSON(raw);
  } catch (err: any) {
    console.error("search-image error:", err?.response?.status ?? err?.code ?? err?.message);
    return null;
  }
}

const IDENTIFY_PROMPT = `
You are a professional product recognition system.

The "title" you return is used verbatim to search eBay/Amazon/Google for
pricing comparables, so an over-confident brand/model guess directly causes
wrong pricing (e.g. guessing "JBL" on an unbranded speaker will price it
like a real JBL). Only name a specific brand or model in the title if it is
clearly visible (logo, printed name) in the image. If the brand/model is
not clearly visible, use a generic descriptive title instead (e.g.
"Portable Bluetooth Speaker", "Wireless Over-Ear Headphones").

If a size, volume, or weight is clearly printed on the item/packaging
(e.g. "500ml", "1L", "750g", "72g"), include it at the end of the title.
This matters a lot for cheap consumables (drinks, cleaning products,
toiletries, snacks) — without it, the price search can't tell a single
small bottle/packet from a 5L catering container or a 12-pack, and ends
up comparing against the wrong size entirely.

The same goes for the NUMBER OF UNITS in the pack ("20 lozenges", "36 tablets",
"4 pack", "24 tea bags"). If a count is printed, end the title with it AND
return it as packCount. Comparing a 20-lozenge box with a 72-lozenge one gives
a price several times too high, so do not guess: use null when no count is
visible.

Also say what condition it is in. "New" only if it is sealed, in retail
packaging or clearly unused; a loose item that has obviously been used is
"Good", "Fair" or "Poor". This decides whether it is priced against new or
second-hand listings.

Return ONLY this JSON, nothing else:
{"title": "...", "packCount": number or null, "condition": "New / Like New / Good / Fair / Poor", "category": "...", "confidence": number}
`;

const DESCRIBE_PROMPT = `
You are an expert reseller describing an item from a photo. Return ONLY this JSON:
{
  "description": "1 short sentence summary",
  "fullDescription": "2 sentences: what it is, notable details worth knowing when reselling",
  "condition": "New / Like New / Good / Fair / Poor",
  "conditionScore": number from 1 to 10,
  "origin": "Country or Unknown"
}
`;

/* --------------------------------------------------
   MAIN ROUTE — UPGRADED
-------------------------------------------------- */
router.post("/search-image", rateLimit(2), async (req, res) => {
  try {
    const { imageBase64, userId, deviceId } = req.body;

    if (!imageBase64 || imageBase64.length < 50) {
      return res.json({ error: "Invalid or missing image" });
    }

    const startedAt = Date.now();

    // Ask for the description straight away; nothing waits for it until the end.
    const describing = askVision(DESCRIBE_PROMPT, imageBase64, { maxTokens: 260, timeoutMs: 15000 });
    const identified = await askVision(IDENTIFY_PROMPT, imageBase64, { maxTokens: 120, timeoutMs: 12000 });
    const visionMs = Date.now() - startedAt;

    if (!identified || !identified.title) {
      return res.json({ error: "AI failed to analyse image" });
    }

    // Prices only need the title and pack size, so they start now.
    const packCount = Number(identified.packCount);
    const marketPromise = fetchMarketData(String(identified.title), {
      packCount: Number.isFinite(packCount) && packCount >= 1 ? Math.round(packCount) : null,
      // Sealed/new items are priced against new listings; anything else against used ones.
      condition: /^new$/i.test(String(identified.condition ?? "").trim()) ? "new" : "used"
    });

    const [details, market] = await Promise.all([describing, marketPromise]);

    const ai: any = {
      ...(details ?? {}),
      ...identified
    };
    ai.description = ai.description ?? "";
    ai.fullDescription = ai.fullDescription ?? ai.description;
    ai.condition = ai.condition ?? "Unknown";
    ai.keywords = Array.isArray(ai.keywords) ? ai.keywords : [];

    // Normalise fields
    ai.confidence = Number(ai.confidence) || 50;
    ai.conditionScore = Math.max(1, Math.min(10, Number(ai.conditionScore) || 5));
    ai.category = ai.category || "Unknown";
    ai.origin = ai.origin || "Unknown";

    const flipMeta = buildFlipMeta(market);
    console.log(
      `search-image: photo ${Math.round(imageBase64.length / 1024)}KB, vision ${visionMs}ms, prices ${
        Date.now() - startedAt - visionMs
      }ms`
    );

    const pricing = {
      recommendedBuyPrice: market.smartPrice,
      recommendedSellPrice: market.average ?? market.googlePriceMax,
      predictedProfit: flipMeta.predictedProfit
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
      ebayItems: market.ebayItems,
      googleItems: market.googleItems,
      flipScore: flipMeta.flipScore,
      flipPotential: flipMeta.flipPotential,
      sellSpeed: flipMeta.sellSpeed,
      rarity: flipMeta.rarity,
      insights: ai.fullDescription ?? ai.description ?? flipMeta.insights,
      image: market.image,
      title: ai.title,
      aiPriceMin: market.aiPriceMin,
      aiPriceMax: market.aiPriceMax,
      aiPriceConfidence: market.aiPriceConfidence,
      usage
    });
  } catch (err) {
    console.error("🔥 search-image error:", err);
    return res.json({ error: "Lookup failed" });
  }
});

export default router;
