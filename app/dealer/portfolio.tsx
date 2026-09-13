import React from "react";
import { VehiclePortfolioBrainScreen } from "../../src/features/dealer-ai/screens/VehiclePortfolioBrainScreen";

export default function Portfolio() {
  const vehicles = [
    { risk: 4.8, reliability: 7.2, profit: 1800, investment: 6.1, depreciation: 900 },
    { risk: 3.1, reliability: 8.4, profit: 2400, investment: 7.3, depreciation: 700 },
    { risk: 5.2, reliability: 6.8, profit: 1200, investment: 5.4, depreciation: 1100 },
  ];

  const totalVehicles = vehicles.length;

  const avgRisk = vehicles.reduce((a, v) => a + v.risk, 0) / totalVehicles;
  const avgReliability = vehicles.reduce((a, v) => a + v.reliability, 0) / totalVehicles;
  const avgProfit = vehicles.reduce((a, v) => a + v.profit, 0) / totalVehicles;
  const avgInvestmentScore = vehicles.reduce((a, v) => a + v.investment, 0) / totalVehicles;
  const depreciation12 = vehicles.reduce((a, v) => a + v.depreciation, 0);

  const volatility =
    vehicles.reduce((a, v) => a + Math.abs(v.risk - avgRisk), 0) / totalVehicles;

  const diversification =
    vehicles.reduce((a, v) => a + Math.abs(v.reliability - avgReliability), 0) /
    totalVehicles;

  const portfolioScore =
    avgProfit * 0.4 +
    avgInvestmentScore * 0.3 +
    (10 - avgRisk) * 0.3;

  const portfolioBand =
    portfolioScore > 6 ? "HIGH" : portfolioScore > 3.5 ? "MEDIUM" : "LOW";

  const recommendation =
    portfolioBand === "HIGH"
      ? "Strong portfolio — expand aggressively."
      : portfolioBand === "MEDIUM"
      ? "Moderate portfolio — grow cautiously."
      : "Weak portfolio — reduce exposure.";

  const data = {
    totalVehicles,
    avgRisk,
    avgReliability,
    avgProfit,
    avgInvestmentScore,
    depreciation12,
    volatility,
    diversification,
    portfolioBand,
    recommendation,
  };

  return <VehiclePortfolioBrainScreen data={data} />;
}
