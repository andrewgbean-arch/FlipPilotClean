export type CarCondition = "poor" | "fair" | "good" | "excellent";

/* ⭐ MOT DATA — now includes make/model/year */
export interface MotData {
  make?: string;
  model?: string;
  year?: number;
  expiry?: string;
  mileageHistory?: { date: string; mileage: number }[];
  advisories?: string[];
  failures?: string[];
  lastChecked?: string;
}

/* ⭐ AI SUMMARY — upgraded to match AI Pro Engine */
export interface AiSummary {
  summary?: string;
  riskLevel?: "low" | "medium" | "high";
  recommendedSalePrice?: number;
  demandScore?: number;
  lastUpdated?: string;

  // AI Pro fields
  buyerProfile?: string;
  recommendedRepairs?: string[];
  saleStrategy?: string;
  profitForecast?: number;
  difficulty?: number;
  verdict?: string;
}

/* ⭐ VALUATION — strict fields for AI + analytics */
export interface Valuation {
  estimatedValue: number;
  status: "undervalued" | "fair" | "overpriced";
  confidence: number;
  tradeInPrice: number;
  privateSalePrice: number;
  lastUpdated: string;

  // ⭐ NEW INTELLIGENCE FIELDS
  recommendedSalePrice?: number;
  marketTrend?: number;   // 0–100
  demandLevel?: number;   // 0–100
}


/* ⭐ MAIN CAR RECORD */
export interface CarRecord {
  id: string;

  // Core details
  make: string;
  model: string;
  year: number;
  mileage: number;
  reg: string;

  // Money
  purchasePrice: number;

  // ⭐ SOLD FLIP FIELDS
  sold: boolean;                 // has the flip been completed?
  salePrice: number | null;      // final sale price
  soldDate: string | null;       // ISO date of sale
  profit: number | null;         // salePrice - purchasePrice
  roi: number | null;            // (profit / purchasePrice) * 100

  // Optional future fields
  expectedSalePrice?: number | null;


  // Condition + notes
  condition: CarCondition;
  notes?: string;

  // Images
  imageUri?: string;

  // MOT
  mot?: MotData;

  // Valuation
  valuation?: Valuation;

  // AI Summary
  aiSummary?: AiSummary;

  // Analytics
  analytics?: {
    roi?: number;
    profit?: number;
    flipScore?: number;
    updatedAt?: string;
  };

  // System
  createdAt: string;

  // ⭐ Favourite flag
  favourite?: boolean;
}
