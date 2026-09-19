import axios from "axios";
import { Router } from "express";
import fetchMarketData from "../market-backend/fetchMarketData";
import { buildFlipMeta } from "../market-backend/buildFlipMeta";
import { rateLimit } from "../middleware/rateLimit";
import { extractPackCount } from "../market-backend/bulkListingFilter";



const router = Router();

/* --------------------------------------------------
   1. OpenFoodFacts
-------------------------------------------------- */
async function fetchOpenFoodFacts(barcode: string) {
  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
    const res = await axios.get(url, { timeout: 4000 });

    if (res.data.status !== 1) return null;

    const p = res.data.product;

    return {
      title: p.product_name ?? null,
      brand: p.brands ?? null,
      image: p.image_front_url ?? null,
      categories: p.categories ?? null,
      origin: p.countries ?? null,
      ingredients: p.ingredients_text ?? null,
      // e.g. "20 lozenges", "500 ml": how much is in this pack.
      quantity: p.quantity ?? null,
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
        max_tokens: 450,
      },
      {
        timeout: 10000,
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

    // The pack size on the product record ("20 lozenges") is what the prices
    // have to be compared against.
    const packCount = extractPackCount(off?.quantity ?? "") ?? extractPackCount(off?.title ?? "");

    // The description does not need the prices, so write it while they are
    // being looked up instead of after (this used to run one after the other).
    const [market, ai] = await Promise.all([
      fetchMarketData(searchQuery, { packCount }),
      buildAiBlock(off, null),
    ]);

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
