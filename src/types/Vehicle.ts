export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  priceRetail: number;
  priceTrade: number;
  marketHeat: number;
  riskScore: number;
  condition: string;
  mot: {
    expiry: string;
    advisories: string[];
    historyScore: number;
    history: Array<{ year: number; result: string; advisories: string[] }>;
  };
  serviceHistory: Array<{ date: string; type: string; cost: number }>;
  predictedRepairs: Array<{ component: string; likelihood: number; cost: number }>;
  depreciationCurve: number[];
  finance: {
    apr: number;
    depositMin: number;
    lenderTier: string;
  };
  buyerPersona: string[];
  sellerPsychology: string[];
  supernovaScore: number;
  flipDifficulty: number;
  valuationConfidence: number;
  photoQuality: number;
  auctionDelta: number;
  image: string;
  status: string;
}
