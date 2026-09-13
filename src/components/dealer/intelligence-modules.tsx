import React from "react";
import { Text, View } from "react-native";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

/* -------------------------------------------------------
   ⭐ Market Heat Engine
------------------------------------------------------- */
export function MarketHeatEngine({
  vehicles,
  theme,
}: {
  vehicles: FlipRecord[];
  theme: any;
}) {
  const total = vehicles.length;
  const hot = vehicles.filter(v => (v.flipScore ?? 0) >= 80).length;
  const cold = vehicles.filter(v => (v.flipScore ?? 0) < 50).length;

  if (total === 0)
    return <Text style={{ color: theme.muted }}>No flips yet. Market heat unavailable.</Text>;

  return (
    <>
      <Text style={{ color: theme.white }}>Hot flips (score ≥ 80): {hot}</Text>
      <Text style={{ color: theme.white }}>Cold flips (score {"<"} 50): {cold}</Text>
      <Text style={{ color: theme.muted, marginTop: 6 }}>
        More hot than cold = strong market. More cold than hot = tighten your buying criteria.
      </Text>
    </>
  );
}

/* -------------------------------------------------------
   ⭐ Risk Radar
------------------------------------------------------- */
export function RiskRadar({
  vehicles,
  theme,
}: {
  vehicles: FlipRecord[];
  theme: any;
}) {
  const motRisk = vehicles.filter(v => {
    const expiry = v.mot?.motExpiry ?? v.mot?.expiryDate;
    if (!expiry) return false;
    const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
    return days <= 30;
  }).length;

  const highMileage = vehicles.filter(v => (v.mileage ?? 0) >= 120000).length;

  return (
    <>
      <Text style={{ color: theme.white }}>MOT risk vehicles (≤ 30 days): {motRisk}</Text>
      <Text style={{ color: theme.white }}>High mileage stock (≥ 120k): {highMileage}</Text>
      <Text style={{ color: theme.muted, marginTop: 6 }}>
        Focus on MOT‑risk and high‑mileage units first when planning stock rotation.
      </Text>
    </>
  );
}

/* -------------------------------------------------------
   ⭐ Profit Consistency
------------------------------------------------------- */
export function ProfitConsistency({
  vehicles,
  theme,
}: {
  vehicles: FlipRecord[];
  theme: any;
}) {
  if (vehicles.length === 0)
    return <Text style={{ color: theme.muted }}>No flips yet. Consistency score unavailable.</Text>;

  const monthly: Record<string, number> = {};

  vehicles.forEach(v => {
    const month = new Date(v.timestamp).toLocaleString("en-GB", {
      year: "numeric",
      month: "short",
    });
    const profit = (v.sellPrice ?? v.valuation ?? 0) - (v.buyPrice ?? 0);
    monthly[month] = (monthly[month] ?? 0) + profit;
  });

  const profits = Object.values(monthly);
  if (profits.length === 0)
    return <Text style={{ color: theme.muted }}>No monthly profit data.</Text>;

  const avg = profits.reduce((s, p) => s + p, 0) / profits.length;
  const variance = profits.reduce((s, p) => s + (p - avg) ** 2, 0) / profits.length;
  const stdDev = Math.sqrt(variance);

  const consistency =
    avg === 0 ? 0 : Math.max(0, Math.min(100, Math.round(100 - (stdDev / Math.max(avg, 1)) * 100)));

  return (
    <>
      <Text style={{ color: theme.white }}>Profit consistency score: {consistency}/100</Text>
      <Text style={{ color: theme.muted, marginTop: 6 }}>
        Higher score = more predictable profit month‑to‑month.
      </Text>
    </>
  );
}

/* -------------------------------------------------------
   ⭐ MOT Health Index
------------------------------------------------------- */
export function MotHealthIndex({
  vehicles,
  theme,
}: {
  vehicles: FlipRecord[];
  theme: any;
}) {
  const withMot = vehicles.filter(v => v.mot).length;
  const motRisk = vehicles.filter(v => {
    const expiry = v.mot?.motExpiry ?? v.mot?.expiryDate;
    if (!expiry) return false;
    const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
    return days <= 30;
  }).length;

  if (withMot === 0)
    return <Text style={{ color: theme.muted }}>No MOT data available.</Text>;

  const healthy = withMot - motRisk;
  const index = Math.round((healthy / withMot) * 100);

  return (
    <>
      <Text style={{ color: theme.white }}>MOT health index: {index}/100</Text>
      <Text style={{ color: theme.white }}>Vehicles with MOT data: {withMot}</Text>
      <Text style={{ color: theme.white }}>MOT‑risk vehicles (≤ 30 days): {motRisk}</Text>
      <Text style={{ color: theme.muted, marginTop: 6 }}>
        Aim to keep MOT health above 80 for a strong, low‑risk stock profile.
      </Text>
    </>
  );
}

/* -------------------------------------------------------
   ⭐ Flip Time Analyzer
------------------------------------------------------- */
export function FlipTimeAnalyzer({
  vehicles,
  theme,
}: {
  vehicles: FlipRecord[];
  theme: any;
}) {
  const completed = vehicles.filter(v => v.sellDate);
  if (completed.length === 0)
    return <Text style={{ color: theme.muted }}>No completed flips yet.</Text>;

  const daysList = completed.map(v => {
    const buy = v.buyDate ? new Date(v.buyDate) : new Date(v.timestamp);
    const sell = new Date(v.sellDate ?? v.timestamp ?? Date.now());
    return Math.max(1, Math.ceil((sell.getTime() - buy.getTime()) / 86400000));
  });

  const avgDays = daysList.reduce((s, d) => s + d, 0) / daysList.length;

  return (
    <>
      <Text style={{ color: theme.white }}>Average flip time: {Math.round(avgDays)} days</Text>
      <Text style={{ color: theme.muted, marginTop: 6 }}>
        Shorter flip times = faster cashflow and lower holding risk.
      </Text>
    </>
  );
}

/* -------------------------------------------------------
   ⭐ Price Efficiency
------------------------------------------------------- */
export function PriceEfficiency({
  vehicles,
  theme,
}: {
  vehicles: FlipRecord[];
  theme: any;
}) {
  const withValuation = vehicles.filter(v => v.valuation && v.buyPrice);
  if (withValuation.length === 0)
    return <Text style={{ color: theme.muted }}>No valuation data available.</Text>;

  const diffs = withValuation.map(v => {
    const valuation = v.valuation ?? 0;
    const buy = v.buyPrice ?? 0;
    return valuation === 0 ? 0 : (valuation - buy) / valuation;
  });

  const avgEff = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  const score = Math.max(0, Math.min(100, Math.round(avgEff * 100)));

  return (
    <>
      <Text style={{ color: theme.white }}>Price efficiency score: {score}/100</Text>
      <Text style={{ color: theme.muted, marginTop: 6 }}>
        Higher score = buying well below valuation on average.
      </Text>
    </>
  );
}

/* -------------------------------------------------------
   ⭐ Smart Alerts
------------------------------------------------------- */
export function SmartAlerts({
  vehicles,
  theme,
}: {
  vehicles: FlipRecord[];
  theme: any;
}) {
  const motRisk = vehicles.filter(v => {
    const expiry = v.mot?.motExpiry ?? v.mot?.expiryDate;
    if (!expiry) return false;
    const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
    return days <= 14;
  });

  const undervalued = vehicles.filter(v => {
    const valuation = v.valuation ?? 0;
    const buy = v.buyPrice ?? 0;
    return valuation - buy >= 1500;
  });

  const fastFlips = vehicles.filter(v => {
    if (!v.sellDate) return false;
    const buy = v.buyDate ? new Date(v.buyDate) : new Date(v.timestamp);
    const sell = new Date(v.sellDate);
    const days = Math.max(1, Math.ceil((sell.getTime() - buy.getTime()) / 86400000));
    return days <= 14;
  });

  if (motRisk.length === 0 && undervalued.length === 0 && fastFlips.length === 0)
    return <Text style={{ color: theme.muted }}>No active alerts.</Text>;

  return (
    <View style={{ gap: 8 }}>
      {motRisk.length > 0 && (
        <Text style={{ color: "#FFD966" }}>
          • {motRisk.length} vehicles with MOT expiring within 14 days.
        </Text>
      )}
      {undervalued.length > 0 && (
        <Text style={{ color: theme.goldDeep }}>
          • {undervalued.length} undervalued vehicles (≥ £1500 below valuation).
        </Text>
      )}
      {fastFlips.length > 0 && (
        <Text style={{ color: "#66FF99" }}>
          • {fastFlips.length} fast‑moving flips (sold within 14 days).
        </Text>
      )}
    </View>
  );
}

/* -------------------------------------------------------
   ⭐ Business Score
------------------------------------------------------- */
export function BusinessScore({
  vehicles,
  theme,
}: {
  vehicles: FlipRecord[];
  theme: any;
}) {
  if (vehicles.length === 0)
    return <Text style={{ color: theme.muted }}>No data yet. Business score unavailable.</Text>;

  const totalProfit = vehicles.reduce(
    (s, v) => s + ((v.sellPrice ?? v.valuation ?? 0) - (v.buyPrice ?? 0)),
    0
  );

  const completed = vehicles.filter(v => v.sellDate).length;

  const avgScore =
    vehicles.length === 0
      ? 0
      : vehicles.reduce((s, v) => s + (v.flipScore ?? 0), 0) / vehicles.length;

  const profitScore = totalProfit <= 0 ? 0 : Math.min(100, Math.round(totalProfit / 1000));
  const volumeScore = Math.min(100, completed * 5);
  const qualityScore = Math.min(100, Math.round(avgScore));

  const overall = Math.round(profitScore * 0.4 + volumeScore * 0.3 + qualityScore * 0.3);

  return (
    <>
      <Text style={{ color: theme.white }}>FlipPilot Business Score: {overall}/100</Text>
      <Text style={{ color: theme.white, marginTop: 6 }}>Profit score: {profitScore}/100</Text>
      <Text style={{ color: theme.white }}>Volume score: {volumeScore}/100</Text>
      <Text style={{ color: theme.white }}>Quality score: {qualityScore}/100</Text>
      <Text style={{ color: theme.muted, marginTop: 6 }}>
        Use this as your dealership performance pulse over time.
      </Text>
    </>
  );
}
