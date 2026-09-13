export type MotAiResult = {
  healthScore: number;          // 0–100
  riskLevel: "low" | "medium" | "high";
  predictedPassChance: number;  // %
  nextTestRisk: string;         // human-readable
  advisorySeverity: number;     // 0–100
  failureSeverity: number;      // 0–100
  mileageRisk: number;          // 0–100
  verdict: string;              // AI-style summary
};

export function motAiEngine(mot: any, history: any[]): MotAiResult {
  // --- SAFETY GUARDS ---
  const advisories = Array.isArray(mot?.advisories) ? mot.advisories.length : 0;
  const failures   = Array.isArray(mot?.failures)   ? mot.failures.length   : 0;

  const lastMileageEntry = history?.length ? history[history.length - 1] : null;
  const mileage = lastMileageEntry?.mileage ?? 0;

  // --- MILEAGE RISK ---
  const mileageRisk =
    mileage > 180000 ? 95 :
    mileage > 150000 ? 85 :
    mileage > 120000 ? 70 :
    mileage > 90000  ? 50 :
    mileage > 60000  ? 30 :
    mileage > 30000  ? 15 : 5;

  // --- ADVISORY / FAILURE SEVERITY ---
  const advisorySeverity = Math.min(advisories * 10, 100);
  const failureSeverity  = Math.min(failures * 22, 100);

  // --- HEALTH SCORE ---
  const baseHealth =
    100 -
    advisorySeverity * 0.35 -
    failureSeverity * 0.65 -
    mileageRisk * 0.25;

  const healthScore = Math.max(0, Math.min(100, Math.round(baseHealth)));

  // --- PASS CHANCE ---
  const predictedPassChance =
    healthScore >= 90 ? 97 :
    healthScore >= 75 ? 90 :
    healthScore >= 60 ? 78 :
    healthScore >= 45 ? 62 :
    healthScore >= 30 ? 45 : 25;

  // --- RISK LEVEL ---
  const riskLevel =
    healthScore >= 70 ? "low" :
    healthScore >= 45 ? "medium" : "high";

  // --- NEXT TEST RISK ---
  const nextTestRisk =
    riskLevel === "low"
      ? "Strong chance of passing next MOT with no major issues."
      : riskLevel === "medium"
      ? "Moderate risk — advisories or wear may cause MOT complications."
      : "High risk — failures or severe wear likely to cause MOT failure.";

  // --- AI VERDICT ---
  const verdict =
    riskLevel === "low"
      ? "Vehicle MOT condition is healthy. No critical issues detected."
      : riskLevel === "medium"
      ? "Vehicle shows signs of wear. Advisories should be addressed soon."
      : "Vehicle MOT condition is poor. Failures or severe advisories detected.";

  return {
    healthScore,
    riskLevel,
    predictedPassChance,
    nextTestRisk,
    advisorySeverity,
    failureSeverity,
    mileageRisk,
    verdict,
  };
}
