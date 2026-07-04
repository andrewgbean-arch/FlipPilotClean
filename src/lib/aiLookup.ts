const OPENAI_KEY = process.env.EXPO_PUBLIC_OPENAI_KEY;

// --- Types ---
export interface AiLookupResponse {
  title?: string;
  origin?: string;
  fullDescription?: string;

  category: string;
  condition: string;
  conditionScore: number;
  description: string;
  recommendedBuyPrice: number;
  recommendedSellPrice: number;
  predictedProfit: number;
  sellThroughRating: number;
  riskScore: number;
  flipDifficulty: number;
  confidence: number;
  keywords: string[];
}

// --- Utility: Safe JSON extraction + auto-repair ---
function extractJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
  }
  return null;
}

// --- Utility: Normalise category names ---
function normaliseCategory(raw: string) {
  if (!raw) return "Unknown";

  const t = raw.toLowerCase();

  if (t.includes("trainer") || t.includes("shoe") || t.includes("sneaker"))
    return "Footwear";

  if (t.includes("coat") || t.includes("jacket") || t.includes("hoodie"))
    return "Outerwear";

  if (t.includes("shirt") || t.includes("tee") || t.includes("t-shirt"))
    return "Tops";

  if (t.includes("jean") || t.includes("trouser") || t.includes("pant"))
    return "Bottoms";

  if (t.includes("bag") || t.includes("backpack"))
    return "Accessories";

  return raw.trim();
}

export default async function aiLookup(title: string, base64?: string): Promise<AiLookupResponse> {
  const prompt = `
You are FlipPilot AI Pro+. Analyse this product image and return structured flip data.

Product title: ${title}
Image (base64): ${base64 ? base64.substring(0, 10000) : "none"}

Return STRICT JSON ONLY with:
{
  "category": "...",
  "condition": "...",
  "conditionScore": number,
  "description": "...",
  "recommendedBuyPrice": number,
  "recommendedSellPrice": number,
  "predictedProfit": number,
  "sellThroughRating": number,
  "riskScore": number,
  "flipDifficulty": number,
  "confidence": number,
  "keywords": ["...", "..."]
}

Rules:
- JSON ONLY.
- No commentary.
- No markdown.
- No backticks.
- No explanations.
`;

  async function callModel() {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    });

    const json = await response.json();
    const text = json?.choices?.[0]?.message?.content?.trim?.() ?? "";
    return extractJson(text);
  }

  try {
    // First attempt
    let result = await callModel();

    // Retry if malformed
    if (!result) {
      console.log("AI Lookup Pro+: retrying due to malformed JSON");
      result = await callModel();
    }

    // Final fallback
    if (!result) {
      return {
        title: "Unknown Item",
        origin: "Unknown",
        fullDescription: "",

        category: "Unknown",
        condition: "Unknown",
        conditionScore: 0,
        description: "No description available",
        recommendedBuyPrice: 0,
        recommendedSellPrice: 0,
        predictedProfit: 0,
        sellThroughRating: 0,
        riskScore: 50,
        flipDifficulty: 5,
        confidence: 0,
        keywords: [],
      };
    }

    // Normalise category
    result.category = normaliseCategory(result.category);

    // Ensure all fields exist
    return {
      title: result.title ?? title ?? "Unknown Item",
      origin: result.origin ?? "Unknown",
      fullDescription: result.fullDescription ?? "",

      category: result.category ?? "Unknown",
      condition: result.condition ?? "Unknown",
      conditionScore: Number(result.conditionScore ?? 0),
      description: result.description ?? "",
      recommendedBuyPrice: Number(result.recommendedBuyPrice ?? 0),
      recommendedSellPrice: Number(result.recommendedSellPrice ?? 0),
      predictedProfit: Number(result.predictedProfit ?? 0),
      sellThroughRating: Number(result.sellThroughRating ?? 0),
      riskScore: Number(result.riskScore ?? 50),
      flipDifficulty: Number(result.flipDifficulty ?? 5),
      confidence: Number(result.confidence ?? 0),
      keywords: Array.isArray(result.keywords) ? result.keywords : [],
    };
  } catch (err) {
    console.log("AI Lookup Pro+ fatal error:", err);
    return {
      title: "Unknown Item",
      origin: "Unknown",
      fullDescription: "",

      category: "Unknown",
      condition: "Unknown",
      conditionScore: 0,
      description: "No description available",
      recommendedBuyPrice: 0,
      recommendedSellPrice: 0,
      predictedProfit: 0,
      sellThroughRating: 0,
      riskScore: 50,
      flipDifficulty: 5,
      confidence: 0,
      keywords: [],
    };
  }
}
