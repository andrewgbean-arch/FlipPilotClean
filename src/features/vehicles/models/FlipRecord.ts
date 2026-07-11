export interface FlipRecord {
  /* ================================
     ⭐ CORE IDENTIFIERS
  ================================= */
  id: string;
  timestamp: string;

  /* ================================
     ⭐ BASIC DISPLAY INFO
  ================================= */
  title: string;
  favourite: boolean;

  /* ================================
     ⭐ IMAGES (Phase 1)
  ================================= */
  images: string[];

  /* ================================
     ⭐ PRICES
  ================================= */
  buyPrice: number;
  sellPrice: number;

  /* ================================
     ⭐ FLIP METRICS
  ================================= */
  flipScore: number;
  aiPriceConfidence: number;
  rarity: string;
  sellSpeed: string;

  /* ================================
     ⭐ AI ANALYSIS
  ================================= */
  ai: {
    condition: string;
    description?: string | null;
  };

  /* ================================
     ⭐ MARKET ANALYSIS
  ================================= */
  market: {
    demandScore: number;
  };

  /* ================================
     ⭐ MOT DATA (Phase 2)
  ================================= */
  mot?: {
    reg?: string | null;
    motStatus?: string | null;
    taxStatus?: string | null;
    mileage?: number | null;
    motExpiry?: string | null;
    advisories?: string[] | null;

    // ⭐ Phase‑6 additions (required for AddFlip + EditFlip + VehicleDetails)
    make?: string | null;
    model?: string | null;
    year?: number | null;
  } | null;

  /* ================================
     ⭐ AI PRICE ENGINE (Phase 6)
  ================================= */
  aiPrice?: {
    recommendedSellPrice: number;          // AI suggested sell price
    confidence: number;                    // 0–100
    riskLevel: "low" | "medium" | "high";  // risk classification
    notes: string;                          // explanation of the AI decision
  } | null;

  /* ================================
     ⭐ PRO TIPS (Phase 5+)
  ================================= */
  proTips?: string[] | null;
}

