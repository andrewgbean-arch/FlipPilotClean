export type CarCondition = "poor" | "fair" | "good" | "excellent";

export interface CarRecord {
  id: string;

  // Core details
  make: string;
  model: string;
  year: number;
  mileage: number;
  reg: string; // ⭐ REQUIRED for DVLA MOT lookup

  // Money
  purchasePrice: number;
  salePrice?: number;
  expectedSalePrice?: number;

  // Condition + notes
  condition: CarCondition;
  notes?: string;

  // Deluxe: Images
  imageUri?: string; // camera/gallery

  // Deluxe: MOT history
  mot?: {
    expiry?: string;
    mileageHistory?: { date: string; mileage: number }[];
    advisories?: string[];
    failures?: string[];
    lastChecked?: string;
  };

  // Deluxe: Market valuation
  valuation?: {
    estimatedValue?: number;
    confidence?: number; // 0–1
    status?: "undervalued" | "fair" | "overpriced";
    lastUpdated?: string;
  };

  // Deluxe: AI Flip Summary
  aiSummary?: {
    summary?: string;
    riskLevel?: "low" | "medium" | "high";
    recommendedSalePrice?: number;
    demandScore?: number; // 0–100
    lastUpdated?: string;
  };

  // Deluxe: Analytics
  analytics?: {
    roi?: number;
    profit?: number;
    flipScore?: number;
    updatedAt?: string;
  };

  // System
  createdAt: string;
}
