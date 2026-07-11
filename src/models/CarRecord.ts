export interface CarRecord {
  /* ================================
     ⭐ CORE IDENTIFIERS
  ================================= */
  id: string;
  timestamp: string;

  /* ================================
     ⭐ BASIC VEHICLE INFO
  ================================= */
  make: string;
  model: string;
  year: number;
  variant?: string | null;          // e.g., “Sport”, “SE”, “LWB”
  bodyType?: string | null;         // e.g., “Hatchback”, “Van”, “SUV”

  /* ================================
     ⭐ REGISTRATION + VIN
  ================================= */
  registration?: string | null;     // UK reg plate
  vin?: string | null;

  /* ================================
     ⭐ IMAGES
  ================================= */
  images?: string[] | null;         // array of image URLs/base64
  mainImage?: string | null;        // primary image

  /* ================================
     ⭐ ENGINE + SPECS
  ================================= */
  mileage?: number | null;
  fuelType?: "Petrol" | "Diesel" | "Hybrid" | "Electric" | null;
  transmission?: "Manual" | "Automatic" | null;
  engineSize?: number | null;       // litres (e.g., 2.0)
  horsepower?: number | null;
  doors?: number | null;
  seats?: number | null;

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
    marketSpeed?: string | null;         // “Fast”, “Moderate”, “Slow”
    rarity?: string | null;              // “Common”, “Uncommon”, “Rare”
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
  } | null;

  /* ================================
     ⭐ USER INPUT
  ================================= */
  userNotes?: string | null;
  favourite?: boolean;
}
