import axios from "axios";
import { Router } from "express";
import fetchMarketData from "../market-backend/fetchMarketData";



const router = Router();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* --------------------------------------------------
   1. Vision API (unchanged)
-------------------------------------------------- */
async function fetchVisionData(imageBase64: string) {
  try {
    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "Extract product title from this image." },
              {
                type: "input_image",
                image_url: `data:image/jpeg;base64,${imageBase64}`,
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return JSON.parse(res.data.choices?.[0]?.message?.content ?? "{}");
  } catch {
    return null;
  }
}

/* --------------------------------------------------
   2. OpenFoodFacts (unchanged)
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
   3. AI Block (unchanged)
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
          Authorization: `Bearer ${OPENAI_API_KEY}`,
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
   ⭐ 4. MAIN LOOKUP ROUTE — NOW USING UNIFIED ENGINE
-------------------------------------------------- */
router.post("/lookup", async (req, res) => {
  try {
    const { barcode, imageBase64 } = req.body;

    if (!barcode && !imageBase64) {
      return res.json({ error: "Missing barcode or image" });
    }

    // 1️⃣ Vision → extract title
    let vision = null;
    if (imageBase64) {
      vision = await fetchVisionData(imageBase64);
    }

    // 2️⃣ OFF → metadata
    const off = barcode ? await fetchOpenFoodFacts(barcode) : null;

    // 3️⃣ Determine search query
    const searchQuery =
      vision?.title ||
      off?.title ||
      barcode ||
      "Unknown Product";

    // 4️⃣ ⭐ Unified pricing engine
    const market = await fetchMarketData(searchQuery);

    // 5️⃣ AI block (unchanged)
    const ai = await buildAiBlock(off, market);

    // 6️⃣ Final response
    return res.json({
      title: ai.title ?? searchQuery,
      barcode,
      ai,
      market,
      ebayItems: market.ebayItems,
      googleItems: market.googleItems,
      image: ai.image ?? market.image ?? off?.image ?? null,
      aiPriceMin: market.aiPriceMin,
      aiPriceMax: market.aiPriceMax,
      aiPriceConfidence: market.aiPriceConfidence,
    });
  } catch (err: any) {
    console.log("LOOKUP ROUTE ERROR:", err?.message || err);
    return res.json({ error: "Lookup failed" });
  }
});

export default router;
