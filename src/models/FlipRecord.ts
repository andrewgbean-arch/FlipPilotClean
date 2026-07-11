export interface FlipRecord {
  id: string;
  title: string;
  barcode: string | null;
  image: string | null;

  // ⭐ CATEGORY (top-level for recommendations)
  category?: string | null;

  // ⭐ USER PRICING (manual input)
  buyPrice?: number | null;
  sellPrice?: number | null;
  profit?: number | null;
  roi?: number | null;

  favourite: boolean;
  timestamp: string;

  /* ================================
     ⭐ AI BLOCK (from backend)
  ================================= */
  ai?: {
    title?: string;
    description?: string;
    fullDescription?: string;
    condition?: string;
    conditionScore?: number | null;
    category?: string | null;
    keywords?: string[] | null;
    origin?: string | null;
  } | null;

  /* ================================
     ⭐ MARKET BLOCK (real + AI fallback)
  ================================= */
  market?: {
    googlePriceMin?: number | null;
    googlePriceMax?: number | null;

    lowest?: number | null;
    highest?: number | null;
    average?: number | null;

    smartPrice?: number | null;
    soldCount?: number | null;
    demandScore?: number | null;

    aiPriceMin?: number | null;
    aiPriceMax?: number | null;
    aiPriceConfidence?: number | null;
  } | null;

  /* ================================
     ⭐ PRICING BLOCK (recommended)
  ================================= */
  pricing?: {
    recommendedBuyPrice?: number | null;
    recommendedSellPrice?: number | null;
    predictedProfit?: number | null;
  } | null;

  /* ================================
     ⭐ FLIP META
  ================================= */
  flipScore?: number | null;
  flipPotential?: string | null;
  sellSpeed?: string | null;
  rarity?: string | null;
  insights?: string | null;

  /* ================================
     ⭐ TOP‑LEVEL FALLBACK FIELDS
     (used when market block is missing)
  ================================= */
  aiPriceMin?: number | null;
  aiPriceMax?: number | null;
  aiPriceConfidence?: number | null;

  /* ================================
     ⭐ AI PRO TIPS (generated locally)
  ================================= */
  proTips?: string[] | null;
}
