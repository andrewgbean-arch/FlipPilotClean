export function calculateFlipScore(listing: any) {
  const { vehicle, price, score } = listing;

  // Base score from your existing FlipPilot score
  let base = score ?? 50;

  // Age penalty
  const age = new Date().getFullYear() - (vehicle?.year ?? 2000);
  const agePenalty = Math.min(age * 1.2, 20);

  // Mileage penalty
  const mileagePenalty =
    vehicle?.mileage > 120000 ? 15 :
    vehicle?.mileage > 90000 ? 10 :
    vehicle?.mileage > 60000 ? 5 : 0;

  // Price attractiveness
  const priceBoost =
    price < 1500 ? 15 :
    price < 3000 ? 10 :
    price < 5000 ? 5 : 0;

  // MOT status
  const motBoost = vehicle?.taxStatus === "Valid" ? 5 : -10;

  // Final score
  const finalScore = Math.max(
    0,
    Math.min(100, base - agePenalty - mileagePenalty + priceBoost + motBoost)
  );

  return {
    flipScore: finalScore,
    riskScore: 100 - finalScore,
    recommendation:
      finalScore >= 75 ? "Buy" :
      finalScore >= 55 ? "Consider" :
      "Avoid",
    profitEstimate: Math.round((finalScore / 100) * 1200),
    sellTimeEstimate:
      finalScore >= 75 ? "Fast (1–7 days)" :
      finalScore >= 55 ? "Medium (1–3 weeks)" :
      "Slow (1–2 months)"
  };
}
