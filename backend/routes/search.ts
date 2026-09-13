import axios from "axios";
import { Router } from "express";
import fetchMarketData from "../market-backend/fetchMarketData";
import { buildFlipMeta } from "../market-backend/buildFlipMeta";
import { rateLimit } from "../middleware/rateLimit";



const router = Router();

/* --------------------------------------------------
   1. OpenFoodFacts
-------------------------------------------------- */
async function fetchOpenFoodFacts(barcode: string) {
  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
    const res = await axios.get(url);

    if (res.data.status !== 1) return null;

    const p = res.data.product;

    return {
      title: p.product_name ?? null,
      brand: p.brands ?? null,
      image: p.image_front_url ?? null,
      categories: p.categories ?? null,
      origin: p.countries ?? null,
      ingredients: p.ingredients_text ?? null,
    };
  } catch {
    return null;
  }
}

/* --------------------------------------------------
   2. AI Block (unchanged)
-------------------------------------------------- */
async function buildAiBlock(off: any, market: any) {
  const title = off?.title ?? "Unknown Item";
  const origin = off?.origin ?? "Unknown";
  const category = off?.categories?.split(",")[0]?.trim() || "Unknown";
  const ingredients = off?.ingredients ?? "";

  const prompt = `
You are an expert reseller and product describer.

Item title: ${title}
Origin: ${origin}
Category: ${category}
Ingredients: ${ingredients}
Retail price: ${market?.googlePriceMin} - ${market?.googlePriceMax}
Used price: ${market?.lowest} - ${market?.highest}

Return JSON with:
- title
- description
- fullDescription
- condition
- conditionScore
- keywords
- origin
- category
`;

  try {
    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return JSON.parse(res.data.choices?.[0]?.message?.content ?? "{}");
  } catch {
    return {
      title,
      description: "",
      fullDescription: "",
      condition: "Unknown",
      conditionScore: 0,
      keywords: [],
      origin,
      category,
    };
  }
}

/* --------------------------------------------------
   ⭐ 4. MAIN ROUTE — NOW USING UNIFIED ENGINE
-------------------------------------------------- */
router.get("/search", rateLimit(10), async (req, res) => {
  try {
    const barcode = req.query.q as string;
    if (!barcode) return res.json({ error: "Missing barcode" });

    const off = await fetchOpenFoodFacts(barcode);
    const searchQuery = off?.title ?? barcode;

    // ⭐ Unified pricing engine
    const market = await fetchMarketData(searchQuery);

    // AI block stays the same
    const ai = await buildAiBlock(off, market);

    // Flip meta stays the same
    const flipMeta = buildFlipMeta(market);

    const pricing = {
      recommendedBuyPrice: market.smartPrice,
      recommendedSellPrice: market.average ?? market.googlePriceMax,
      predictedProfit: flipMeta.predictedProfit,
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
      insights: flipMeta.insights,
      image: ai.image ?? market.image,
      title: ai.title,
      barcode,
      aiPriceMin: market.aiPriceMin,
      aiPriceMax: market.aiPriceMax,
      aiPriceConfidence: market.aiPriceConfidence,
    });
  } catch (err: any) {
    console.log("SEARCH ROUTE ERROR:", err?.message || err);
    return res.json({ error: "Lookup failed" });
  }
});

export default router;
