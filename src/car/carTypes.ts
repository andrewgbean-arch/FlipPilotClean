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
  confidence: number;
  status: "undervalued" | "fair" | "overpriced";
  lastUpdated: string;
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
  salePrice?: number;
  expectedSalePrice?: number;

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

 // ⭐ Favourite flag (THIS is the missing field)
  favourite?: boolean;
}
