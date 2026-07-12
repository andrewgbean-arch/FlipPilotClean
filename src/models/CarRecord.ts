export interface CarRecord {
  /* ================================
     ⭐ CORE IDENTIFIERS
  ================================= */
  id: string;
  timestamp: string;                 // ISO string
  lastUpdated?: string | null;       // for sync + AI refresh

  /* ================================
     ⭐ BASIC VEHICLE INFO
  ================================= */
  make: string;
  model: string;
  year: number;
  variant?: string | null;           // “Sport”, “SE”, “LWB”
  bodyType?: string | null;          // “Hatchback”, “Van”, “SUV”
  colour?: string | null;

  /* ================================
     ⭐ REGISTRATION + VIN
  ================================= */
  registration?: string | null;      // UK reg plate
  vin?: string | null;
  dvlaVerified?: boolean | null;     // DVLA lookup success flag

  /* ================================
     ⭐ IMAGES
  ================================= */
  images?: string[] | null;          // array of image URLs/base64
  mainImage?: string | null;         // primary image
  thumbnail?: string | null;         // small preview

  /* ================================
     ⭐ ENGINE + SPECS
  ================================= */
  mileage?: number | null;
  fuelType?: "Petrol" | "Diesel" | "Hybrid" | "Electric" | null;
  transmission?: "Manual" | "Automatic" | null;
  engineSize?: number | null;        // litres (e.g., 2.0)
  horsepower?: number | null;
  torque?: number | null;            // Nm
  doors?: number | null;
  seats?: number | null;
  drivetrain?: "FWD" | "RWD" | "AWD" | null;

  /* ================================
     ⭐ MOT HISTORY
  ================================= */
  mot?: {
    expiry?: string | null;
    lastTestDate?: string | null;
    advisories?: string[] | null;
    failures?: string[] | null;
    history?: {
      date: string;
      result: "PASS" | "FAIL";
      mileage: number | null;
      notes?: string | null;
    }[] | null;
  } | null;

  /* ================================
     ⭐ MARKET DATA
  ================================= */
  market?: {
    priceMin?: number | null;
    priceMax?: number | null;
    priceAverage?: number | null;
    priceConfidence?: number | null;     // 0–1
    listingsFound?: number | null;
    marketSpeed?: "Fast" | "Moderate" | "Slow" | null;
    rarity?: "Common" | "Uncommon" | "Rare" | "Very Rare" | null;
    region?: string | null;              // e.g., “South West”
  } | null;

  /* ================================
     ⭐ VALUATION (AI + Pro)
  ================================= */
  valuation?: {
    estimatedValue?: number | null;      // main valuation
    highEstimate?: number | null;
    lowEstimate?: number | null;
    confidence?: number | null;          // 0–1
    dealScore?: number | null;           // 0–100
    proValuation?: boolean | null;       // Pro mode flag

    // NEW: AI insights
    insights?: string[] | null;          // “This model sells faster in summer”
    riskFactors?: string[] | null;       // “High mileage”, “Short MOT”
    recommendedBuy?: number | null;
    recommendedSell?: number | null;
  } | null;

  /* ================================
     ⭐ SELLER INFO
  ================================= */
  seller?: {
    name?: string | null;
    phone?: string | null;
    location?: string | null;
    listingUrl?: string | null;
    source?: string | null;              // “AutoTrader”, “eBay Motors”, etc.
    verified?: boolean | null;           // future feature
  } | null;

  /* ================================
     ⭐ USER INPUT
  ================================= */
  userNotes?: string | null;
  favourite?: boolean;

  /* ================================
     ⭐ FLIPPILOT INTERNAL
  ================================= */
  tags?: string[] | null;               // “ULEZ”, “Project Car”, “Quick Flip”
  archived?: boolean | null;            // soft delete
}

