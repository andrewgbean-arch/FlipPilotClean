import axios from "axios";
import { Router } from "express";
import fetchMarketData from "../market-backend/fetchMarketData";
import { buildFlipMeta } from "../market-backend/buildFlipMeta";
import { extractPackCount } from "../market-backend/bulkListingFilter";
import { getEbayAccessToken } from "../market-backend/ebayBrowseApi";
import { paidLookupBudget } from "../middleware/dailyBudget";
import { rateLimit } from "../middleware/rateLimit";
import { askVision, DESCRIBE_PROMPT, IDENTIFY_PROMPT } from "./searchImage";
import { buildAiBlock, fetchOpenFoodFacts } from "./search";

/* --------------------------------------------------
   The scan in two steps, so the phone has something to show quickly.

   STEP 1  "what is it?"   about half a second for a barcode, about two seconds
                           for a photo. The result screen opens straight away
                           with the name and picture.
   STEP 2  "what is it worth?"  the price lookups, while the result screen is
                           already on screen showing "Checking prices".

   The old single calls (/search and /search-image) still exist and do both.
-------------------------------------------------- */
const router = Router();

/* ---------------- barcode -> product ---------------- */

interface BarcodeIdentity {
  title: string;
  image: string | null;
  packCount: number | null;
  source: "openfoodfacts" | "ebay";
  off: any | null;
}

// A barcode never changes what it is, so remember it for the life of the server.
const identityCache = new Map<string, BarcodeIdentity | null>();
const IDENTITY_CACHE_MAX = 500;

// eBay knows the barcode of most things that are not food (games, tools,
// electronics, toys), which Open Food Facts does not.
async function ebayByBarcode(code: string): Promise<{ title: string; image: string | null } | null> {
  try {
    const token = await getEbayAccessToken();
    const res = await axios.get("https://api.ebay.com/buy/browse/v1/item_summary/search", {
      timeout: 3000,
      params: { gtin: code, limit: 5 },
      headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB" },
    });
    const items: any[] = res.data.itemSummaries ?? [];
    if (!items.length) return null;

    // Sellers pad titles ("NEW SEALED FREE P&P"); the shortest of the first few is
    // the cleanest name.
    const shortest = [...items].sort((a, b) => String(a.title).length - String(b.title).length)[0];
    return {
      title: String(shortest.title).trim(),
      image: shortest.image?.imageUrl ?? items[0].image?.imageUrl ?? null,
    };
  } catch (err: any) {
    console.log("eBay barcode lookup:", err?.response?.status ?? err?.code ?? err?.message);
    return null;
  }
}

export async function identifyBarcode(code: string): Promise<BarcodeIdentity | null> {
  if (identityCache.has(code)) return identityCache.get(code) ?? null;

  // Both at once: whichever knows the product answers.
  const [off, ebay] = await Promise.all([fetchOpenFoodFacts(code), ebayByBarcode(code)]);

  let identity: BarcodeIdentity | null = null;
  if (off?.title) {
    // "brands" often lists the manufacturer first ("Mars Wrigley Confectionery UK
    // Limited, Snickers"): take the shortest name that isn't a company.
    const brand =
      String(off.brand ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x && !/\b(ltd|limited|gmbh|sa\/nv|inc|plc|services|company|group)\b/i.test(x))
        .sort((x, y) => x.length - y.length)[0] ?? "";
    const name = String(off.title).trim();
    const title = [brand && !name.toLowerCase().includes(brand.toLowerCase()) ? brand : "", name, off.quantity ?? ""]
      .filter(Boolean)
      .join(" ");
    identity = {
      title,
      image: off.image ?? ebay?.image ?? null,
      packCount: extractPackCount(off.quantity ?? "") ?? extractPackCount(name),
      source: "openfoodfacts",
      off,
    };
  } else if (ebay) {
    identity = {
      title: ebay.title,
      image: ebay.image,
      packCount: extractPackCount(ebay.title),
      source: "ebay",
      off: null,
    };
  }

  if (identityCache.size >= IDENTITY_CACHE_MAX) {
    const oldest = identityCache.keys().next().value;
    if (oldest !== undefined) identityCache.delete(oldest);
  }
  // Only remember hits: a miss may be a slow service, worth asking again.
  if (identity) identityCache.set(code, identity);
  return identity;
}

router.get("/identify-barcode", rateLimit(30), paidLookupBudget, async (req, res) => {
  try {
    const code = String(req.query.q ?? "").replace(/\D/g, "");
    if (code.length < 6) return res.json({ error: "bad-barcode", message: "That doesn't look like a barcode. Try scanning it again." });

    const identity = await identifyBarcode(code);
    if (!identity) {
      return res.json({
        error: "unknown-barcode",
        message: "We don't recognise that barcode yet. Try the photo scan instead.",
      });
    }

    return res.json({
      ok: true,
      barcode: code,
      title: identity.title,
      image: identity.image,
      packCount: identity.packCount,
      source: identity.source,
    });
  } catch (err: any) {
    console.log("IDENTIFY BARCODE ERROR:", err?.message || err);
    return res.json({ error: "Lookup failed" });
  }
});

/* ---------------- photo -> product ---------------- */

router.post("/identify-image", rateLimit(6), paidLookupBudget, async (req, res) => {
  try {
    const { imageBase64 } = req.body ?? {};
    if (!imageBase64 || typeof imageBase64 !== "string" || imageBase64.length < 50) {
      return res.json({ error: "Invalid or missing image" });
    }

    const startedAt = Date.now();
    const identified = await askVision(IDENTIFY_PROMPT, imageBase64, { maxTokens: 120, timeoutMs: 12000 });
    if (!identified || !identified.title) {
      return res.json({ error: "AI failed to analyse image" });
    }
    console.log(`identify-image: photo ${Math.round(imageBase64.length / 1024)}KB, ${Date.now() - startedAt}ms`);

    const packCount = Number(identified.packCount);
    return res.json({
      ok: true,
      title: String(identified.title),
      packCount: Number.isFinite(packCount) && packCount >= 1 ? Math.round(packCount) : null,
      condition: identified.condition ?? null,
      category: identified.category ?? null,
      confidence: Number(identified.confidence) || 50,
    });
  } catch (err: any) {
    console.log("IDENTIFY IMAGE ERROR:", err?.message || err);
    return res.json({ error: "Lookup failed" });
  }
});

/* ---------------- the prices ---------------- */

const gradeOf = (condition: unknown) => {
  const c = String(condition ?? "");
  return /like new/i.test(c) ? "like new" : /poor/i.test(c) ? "poor" : /fair/i.test(c) ? "fair" : "good";
};

router.post("/price", rateLimit(30), paidLookupBudget, async (req, res) => {
  try {
    const { title, packCount, condition, barcode, imageBase64 } = req.body ?? {};
    if (!title || typeof title !== "string") return res.json({ error: "Missing title" });

    const startedAt = Date.now();
    const isNew = barcode ? true : /^new$/i.test(String(condition ?? "").trim());
    const count = Number(packCount);

    // The description is written while the prices are looked up.
    const identity = barcode ? identityCache.get(String(barcode)) ?? null : null;
    const describing: Promise<any> = imageBase64
      ? askVision(DESCRIBE_PROMPT, imageBase64, { maxTokens: 260, timeoutMs: 15000 })
      : identity?.off
      ? buildAiBlock(identity.off, null)
      : Promise.resolve(null);

    const [details, market] = await Promise.all([
      describing,
      fetchMarketData(title, {
        packCount: Number.isFinite(count) && count >= 1 ? Math.round(count) : null,
        condition: isNew ? "new" : "used",
        grade: gradeOf(condition),
      }),
    ]);

    const flipMeta = buildFlipMeta(market);
    console.log(`price: ${Date.now() - startedAt}ms for "${title.slice(0, 40)}"`);

    const ai: any = { ...(details ?? {}) };
    if (details) {
      ai.description = ai.description ?? "";
      ai.fullDescription = ai.fullDescription ?? ai.description;
      ai.conditionScore = Math.max(1, Math.min(10, Number(ai.conditionScore) || 5));
    }

    return res.json({
      ok: true,
      ai,
      market,
      pricing: {
        recommendedBuyPrice: market.smartPrice,
        recommendedSellPrice: market.average ?? market.googlePriceMax,
        predictedProfit: flipMeta.predictedProfit,
      },
      flipScore: flipMeta.flipScore,
      flipPotential: flipMeta.flipPotential,
      sellSpeed: flipMeta.sellSpeed,
      rarity: flipMeta.rarity,
      insights: ai.fullDescription ?? ai.description ?? flipMeta.insights,
      aiPriceMin: market.aiPriceMin,
      aiPriceMax: market.aiPriceMax,
      aiPriceConfidence: market.aiPriceConfidence,
    });
  } catch (err: any) {
    console.log("PRICE ERROR:", err?.message || err);
    return res.json({ error: "Lookup failed" });
  }
});

export default router;
