import { Router } from "express";
import axios from "axios";
import { rateLimit } from "../middleware/rateLimit";

const router = Router();

/* --------------------------------------------------
   BULLETPROOF JSON EXTRACTOR (same pattern as searchImage.ts)
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
   AI VEHICLE CONDITION INSPECTOR — real OpenAI vision call
-------------------------------------------------- */
async function inspectVehiclePhoto(base64: string) {
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
You are a professional vehicle inspector examining a photo of a car for a reseller/dealer.

Return ONLY valid JSON with this structure:
{
  "condition": "Excellent" | "Good" | "Fair" | "Poor",
  "damage": "short description of any visible damage, or 'No visible damage'",
  "rust": "short description of any visible rust, or 'No rust visible'",
  "cleanliness": "Clean" | "Needs cleaning",
  "valueImpact": number (estimated £ impact on resale value from visible condition issues, 0 if none),
  "summary": "1-2 sentence overall assessment"
}

Rules:
- ONLY return JSON.
- NO markdown, NO commentary.
- Base every field strictly on what is visible in the photo.
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

  const res = await axios.post("https://api.openai.com/v1/responses", payload, {
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
}

/* --------------------------------------------------
   MAIN ROUTE
-------------------------------------------------- */
router.post("/vehicle-photo-analysis", rateLimit(5), async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64 || imageBase64.length < 50) {
      return res.json({ ok: false, error: "Invalid or missing image" });
    }

    const result = await inspectVehiclePhoto(imageBase64);

    if (!result) {
      return res.json({ ok: false, error: "AI failed to analyse photo" });
    }

    return res.json({
      ok: true,
      condition: result.condition ?? "Unknown",
      damage: result.damage ?? "No visible damage",
      rust: result.rust ?? "No rust visible",
      cleanliness: result.cleanliness ?? "Clean",
      valueImpact: Number(result.valueImpact) || 0,
      summary: result.summary ?? ""
    });
  } catch (err: any) {
    console.error("🔥 vehicle-photo-analysis error:", err.response?.data || err.message || err);
    return res.json({ ok: false, error: "Photo analysis failed" });
  }
});

export default router;
