export interface FlipRecord {
  id: string;
  title: string;

  /* ================================
     ⭐ BASIC PRICES
  ================================= */
  buyPrice?: number | null;
  sellPrice?: number | null;

  /* ================================
     ⭐ IMAGES
  ================================= */
  images?: string[] | null;

  /* ================================
     ⭐ FAVOURITE
  ================================= */
  favourite?: boolean;

  /* ================================
     ⭐ USER NOTES
  ================================= */
  notes?: string | null;

  /* ================================
     ⭐ AI PRICE BLOCK (simple)
  ================================= */
  aiPrice?: {
    recommendedSellPrice?: number | null;
    riskLevel?: "low" | "medium" | "high" | null;
  } | null;

  /* ================================
     ⭐ MOT BLOCK
  ================================= */
  mot?: {
    motStatus?: string | null;
  } | null;

  /* ================================
     ⭐ AI BLOCK (backend)
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
     ⭐ MARKET BLOCK
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
     ⭐ PRICING BLOCK
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
     ⭐ FALLBACK FIELDS
  ================================= */
  aiPriceMin?: number | null;
  aiPriceMax?: number | null;
  aiPriceConfidence?: number | null;

  /* ================================
     ⭐ AI PRO TIPS
  ================================= */
  proTips?: string[] | null;
}
