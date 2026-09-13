import axios from "axios";

console.log("VISION.TS LOADED");

/* --------------------------------------------------
   ⭐ BULLETPROOF JSON EXTRACTOR
-------------------------------------------------- */
function extractJSON(text: string) {
  if (!text) return null;

  // Remove markdown fences
  text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  // Direct parse attempt
  try {
    return JSON.parse(text);
  } catch {}

  // Fallback: extract first valid JSON block
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
   ⭐ SAFE NORMALISERS
-------------------------------------------------- */
function safeNumber(n: any, fallback: number) {
  const num = Number(n);
  return isNaN(num) ? fallback : num;
}

function clamp(num: number, min: number, max: number) {
  return Math.max(min, Math.min(max, num));
}

/* --------------------------------------------------
   ⭐ MAIN VISION FUNCTION — OPENAI RESPONSES API
-------------------------------------------------- */
export default async function runVision(imageBase64: string) {
  const apiKey = process.env.OPENAI_API_KEY;

  const attempt = async () => {
    try {
      const response = await axios.post(
        "https://api.openai.com/v1/responses",
        {
          model: "gpt-4o-mini",
          temperature: 0.2,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `
You are a professional product recognition system used by resellers.

Return ONLY valid JSON with this structure:

{
  "title": "Exact product name with brand and model",
  "category": "Product category",
  "origin": "Country or 'Unknown'",
  "confidence": number,
  "description": "1–2 sentence summary",
  "fullDescription": "4–6 sentence detailed description",
  "condition": "New / Like New / Good / Fair / Poor",
  "conditionScore": number,
  "market": {
    "retailPrice": number | null,
    "usedPrice": number | null,
    "sellThroughRating": number,
    "demand": "High / Medium / Low",
    "riskScore": number,
    "flipDifficulty": number
  },
  "recommendedBuyPrice": number,
  "recommendedSellPrice": number,
  "predictedProfit": number,
  "keywords": ["keyword1", "keyword2"]
}

Rules:
- ONLY return JSON.
- NO markdown.
- NO commentary.
- If unsure, guess.
                  `,
                },
                {
                  type: "input_image",
                  image_url: imageBase64.startsWith("data:")
                    ? imageBase64
                    : `data:image/jpeg;base64,${imageBase64}`,
                },
              ],
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const raw =
        response.data?.output?.[0]?.content?.[0]?.text?.trim() ||
        response.data?.output_text ||
        "";

      const parsed = extractJSON(raw);
      if (!parsed) return null;

      /* --------------------------------------------------
         ⭐ NORMALISE FIELDS
      -------------------------------------------------- */
      parsed.confidence = clamp(safeNumber(parsed.confidence, 50), 0, 100);
      parsed.conditionScore = clamp(
        safeNumber(parsed.conditionScore, 5),
        1,
        10
      );

      parsed.title = parsed.title || "Unknown Item";
      parsed.category = parsed.category || "Unknown";
      parsed.origin = parsed.origin || "Unknown";

      if (!parsed.market) {
        parsed.market = {
          retailPrice: null,
          usedPrice: null,
          sellThroughRating: 0,
          demand: "Low",
          riskScore: 50,
          flipDifficulty: 50,
        };
      }

      return parsed;
    } catch (err: any) {
      console.error("🔥 OPENAI ERROR:", err.response?.data || err.message || err);
      return null;
    }
  };

  /* --------------------------------------------------
     ⭐ RETRY LOGIC (3 attempts)
  -------------------------------------------------- */
  for (let i = 0; i < 3; i++) {
    const parsed = await attempt();
    if (parsed) return parsed;
  }

  console.log("❌ AI Lookup: All retries failed — returning fallback.");

  /* --------------------------------------------------
     ⭐ FALLBACK RESPONSE
  -------------------------------------------------- */
  return {
    title: "Unknown Item",
    category: "Unknown",
    origin: "Unknown",
    confidence: 0,
    description: "",
    fullDescription: "",
    condition: "Unknown",
    conditionScore: 0,
    market: {
      retailPrice: null,
      usedPrice: null,
      sellThroughRating: 0,
      demand: "Low",
      riskScore: 50,
      flipDifficulty: 50,
    },
    recommendedBuyPrice: 0,
    recommendedSellPrice: 0,
    predictedProfit: 0,
    keywords: [],
  };
}
