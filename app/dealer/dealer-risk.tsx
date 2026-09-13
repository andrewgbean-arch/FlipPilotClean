import React, { useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextStyle,
} from "react-native";

import { useTheme } from "@/styles/ThemeContext";
import { useDealerAI } from "@/features/dealer-ai/DealerAIContext";
import { useLocalSearchParams, router } from "expo-router";

import DealerNeonHeader from "@/components/dealer/DealerNeonHeader";
import DealerFab from "@/components/dealer/DealerFab";
import SupernovaCard from "@/components/dealer/SupernovaCard";
import DealerSectionGlow from "@/components/dealer/DealerSectionGlow";
import { DealerGridButton } from "@/components/dealer/DealerGridButton";

import FinanceSuiteSummaryCard from "@/components/dealer/FinanceSuiteSummaryCard";
import RiskScoreCard from "@/components/dealer/RiskScoreCard";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

/* ⭐ RiskHub Engine */
import { riskEngine } from "@/features/dealer-ai/RiskEngine";

/* ⭐ Risk band colours */
const riskColor = (band: "Low" | "Medium" | "High", theme: any) => {
  switch (band) {
    case "Low":
      return theme.success;
    case "Medium":
      return theme.warning;
    case "High":
      return theme.danger;
    default:
      return theme.secondary;
  }
};

export default function DealerRiskScreen() {
  const theme = useTheme();
  const ai = useDealerAI();

  const { id } = useLocalSearchParams();
  const { vehicles, dealerMode, setDealerMode, setFlashTrigger } =
    useVehicleHistory();

  /* ⭐ Auto‑activate Dealer Mode */
  useEffect(() => {
    if (!dealerMode && vehicles.length > 0) {
      setDealerMode(true);
      setFlashTrigger(Date.now());
    }
  }, [dealerMode, vehicles.length]);

  /* ⭐ Bulletproof vehicle lookup */
  const vehicle = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return null;
    if (!id) return vehicles[0];

    const found = vehicles.find(v => String(v.id) === String(id));
    return found ?? vehicles[0];
  }, [vehicles, id]);

  /* ⭐ Fallback guard */
  if (!vehicle) {
    return (
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 26, fontWeight: "900", color: theme.text }}>
          Loading vehicle…
        </Text>
      </View>
    );
  }

  /* ⭐ Buyer defaults */
  const buyer: any = {
    income: 2800,
    expenses: 1400,
    deposit: 500,
    creditScore: 620,
    riskScore: 0.3,
  };

  /* ⭐ RiskHub Intelligence */
  const risk = riskEngine.totalRisk(vehicle, buyer, ai);

  /* ⭐ Existing AI Risk Intelligence */
  const fraud = ai.fraudRisk(vehicle);
  const odo = ai.odometerTamperRisk(vehicle);
  const auction = ai.auctionPriceHint(vehicle, []);
  const wholesale = ai.wholesaleRecommendation(vehicle);
  const condition = ai.conditionScore(vehicle);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* ⭐ Dealer OS Navigation Grid */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 20,
        }}
      >
        <DealerGridButton
          label="Dashboard"
          icon="📊"
          route="/dealer/DealerDashboardV11"
        />

        <DealerGridButton
          label="Stock Hub"
          icon="🚗"
          route="/dealer/dealer-stock"
        />

        <DealerGridButton
          label="Finance Hub"
          icon="💳"
          route="/dealer/dealer-finance"
        />

        <DealerGridButton
          label="CRM Hub"
          icon="👥"
          route="/dealer/DealerCRMIntelligence"
        />

        <DealerGridButton
          label="Marketing Hub"
          icon="📣"
          route="/dealer/DealerMarketingHub"
        />

        <DealerGridButton
          label="Risk Hub"
          icon="⚠️"
          route="/dealer/dealer-risk"
        />

        <DealerGridButton
          label="Sales Hub"
          icon="💰"
          route="/dealer/dealer-sales"
        />
      </View>
      {/* ⭐ INTELLIGENCE SECTION */}
<Text
  style={{
    color: theme.goldDeep,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 10,
    marginBottom: 12,
    textShadowColor: theme.goldSoftGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  }}
>
  Intelligence
</Text>

<View
  style={{
    height: 2,
    backgroundColor: theme.goldSoftGlow,
    marginBottom: 16,
    borderRadius: 2,
    shadowColor: theme.goldDeep,
    shadowOpacity: 0.4,
    shadowRadius: 6,
  }}
/>

<DealerGridButton
  label="Predictive Engine"
  icon="🔮"
  route="/dealer/DealerPredictiveEngine"
/>

<DealerGridButton
  label="Performance Hub"
  icon="📊"
  route="/dealer/DealerPerformanceHub"
/>


      {/* ⭐ Premium Dealer Header */}
      <DealerNeonHeader
        title="Dealer Risk Hub"
        subtitle="AI‑Powered Risk Intelligence"
      />
      <ScrollView style={{ padding: 20 }}>
        {/* ⭐ SECTION: RiskHub Summary */}
        <DealerSectionGlow title="RiskHub Summary" />

        {/* FinanceSuite Summary */}
        <FinanceSuiteSummaryCard vehicle={vehicle} buyer={buyer} />

        {/* Risk Score Summary */}
        <RiskScoreCard risk={risk} theme={theme} />

        {/* Risk‑Weighted Match Score */}
        <SupernovaCard title="Risk‑Weighted Match Score" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Risk‑Weighted Match Score
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, marginTop: 6 }}>
            {Math.round((100 - risk.totalRisk) * 0.9)} / 100
          </Text>
        </SupernovaCard>

        {/* Deal Recommendation */}
        <SupernovaCard title="Deal Recommendation" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Deal Recommendation
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, marginTop: 6 }}>
            {risk.band === "Low"
              ? "Strong low‑risk deal — proceed confidently."
              : risk.band === "Medium"
              ? "Moderate risk — proceed with caution."
              : "High risk — avoid unless necessary."}
          </Text>
        </SupernovaCard>
        {/* ⭐ SECTION: Risk Heatmap */}
        <DealerSectionGlow title="Risk Heatmap" />

        <SupernovaCard title="Risk Heatmap" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Risk Heatmap
          </Text>

          <View style={{ marginTop: 10 }}>
            {/* MOT Risk */}
            <Text style={{ color: theme.secondary }}>
              🔧 MOT Risk: {risk.motRisk}%
            </Text>
            <View
              style={{
                height: 6,
                backgroundColor: riskColor(
                  risk.motRisk < 30 ? "Low" : risk.motRisk < 60 ? "Medium" : "High",
                  theme
                ),
                borderRadius: 4,
                marginBottom: 10,
              }}
            />

            {/* Finance Risk */}
            <Text style={{ color: theme.secondary }}>
              💳 Finance Risk: {risk.financeRisk}%
            </Text>
            <View
              style={{
                height: 6,
                backgroundColor: riskColor(
                  risk.financeRisk < 30 ? "Low" : risk.financeRisk < 60 ? "Medium" : "High",
                  theme
                ),
                borderRadius: 4,
                marginBottom: 10,
              }}
            />

            {/* Affordability Risk */}
            <Text style={{ color: theme.secondary }}>
              💰 Affordability Risk: {risk.affordabilityRisk}%
            </Text>
            <View
              style={{
                height: 6,
                backgroundColor: riskColor(
                  risk.affordabilityRisk < 30
                    ? "Low"
                    : risk.affordabilityRisk < 60
                    ? "Medium"
                    : "High",
                  theme
                ),
                borderRadius: 4,
                marginBottom: 10,
              }}
            />

            {/* Buyer Risk */}
            <Text style={{ color: theme.secondary }}>
              👤 Buyer Risk: {risk.buyerRisk}%
            </Text>
            <View
              style={{
                height: 6,
                backgroundColor: riskColor(
                  risk.buyerRisk < 30 ? "Low" : risk.buyerRisk < 60 ? "Medium" : "High",
                  theme
                ),
                borderRadius: 4,
              }}
            />
          </View>
        </SupernovaCard>

        {/* ⭐ SECTION: Buyer Profile */}
        <DealerSectionGlow title="Buyer Profile" />

        <SupernovaCard title="Buyer Risk Profile" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Buyer Risk Profile
          </Text>

          <Text style={{ color: theme.secondary, marginTop: 6 }}>
            Credit Score: {buyer.creditScore}
          </Text>

          <Text style={{ color: theme.secondary }}>
            Deposit Strength: £{buyer.deposit}
          </Text>

          <Text style={{ color: theme.secondary }}>
            Monthly Surplus: £{buyer.income - buyer.expenses}
          </Text>

          <Text style={{ color: theme.secondary }}>
            Behavioural Risk: {Math.round(buyer.riskScore * 100)}%
          </Text>
        </SupernovaCard>

        {/* MatchEngine Overlay */}
        <SupernovaCard title="MatchEngine Risk Overlay" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            MatchEngine Risk Overlay
          </Text>

          <Text style={{ color: theme.secondary, marginTop: 6 }}>
            Effective Match Score: {Math.round((100 - risk.totalRisk) * 0.75)}
          </Text>

          <Text style={{ color: theme.muted }}>
            (Match score reduced by risk factors)
          </Text>
        </SupernovaCard>

        {/* ⭐ SECTION: Vehicle Intelligence */}
        <DealerSectionGlow title="Vehicle Intelligence" />

        {/* Fraud Risk */}
        <SupernovaCard title="Fraud Risk" glow>
          <Text
            style={{
              color: theme.text,
              fontWeight: "800",
              fontSize: 18,
              marginBottom: 6,
            }}
          >
            Fraud Risk
          </Text>
          <Text
            style={{
              color: theme.secondary,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {fraud}% risk detected
          </Text>
        </SupernovaCard>

        {/* Odometer Risk */}
        <SupernovaCard title="Odometer Tamper Risk" glow>
          <Text
            style={{
              color: theme.text,
              fontWeight: "800",
              fontSize: 18,
              marginBottom: 6,
            }}
          >
            Odometer Tamper Risk
          </Text>
          <Text
            style={{
              color: theme.secondary,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {odo}% likelihood of tampering
          </Text>
        </SupernovaCard>

        {/* Auction Price Hint */}
        <SupernovaCard title="Auction Price Hint" glow>
          <Text
            style={{
              color: theme.text,
              fontWeight: "800",
              fontSize: 18,
              marginBottom: 6,
            }}
          >
            Auction Price Hint
          </Text>
          <Text
            style={{
              color: theme.secondary,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            Estimated auction value: £{auction}
          </Text>
        </SupernovaCard>

        {/* Wholesale Recommendation */}
        <SupernovaCard title="Wholesale Recommendation" glow>
          <Text
            style={{
              color: theme.text,
              fontWeight: "800",
              fontSize: 18,
              marginBottom: 6,
            }}
          >
            Wholesale Recommendation
          </Text>
          <Text
            style={{
              color: theme.secondary,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {wholesale}
          </Text>
        </SupernovaCard>

        {/* Condition Score */}
        <SupernovaCard title="Condition Score" glow>
          <Text
            style={{
              color: theme.text,
              fontWeight: "800",
              fontSize: 18,
              marginBottom: 6,
            }}
          >
            Condition Score
          </Text>
          <Text
            style={{
              color: theme.secondary,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {condition}/100 overall condition rating
          </Text>
        </SupernovaCard>
        {/* ⭐ SECTION: Underwriting Engine V9 */}
        <DealerSectionGlow title="Underwriting Engine V9" />

        {/* Lender Compatibility Score */}
        <SupernovaCard title="Lender Compatibility Score" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Lender Compatibility Score
          </Text>

          <Text style={{ color: theme.secondary, marginTop: 6 }}>
            {Math.round(
              (buyer.creditScore / 850) * 40 +
                (100 - risk.totalRisk) * 0.6
            )}{" "}
            / 100
          </Text>

          <Text style={{ color: theme.muted }}>
            Higher score = more lenders likely to approve
          </Text>
        </SupernovaCard>

        {/* Buyer Rules Check */}
        <SupernovaCard title="Buyer Rules Check" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Buyer Rules Check
          </Text>

          <Text style={{ color: theme.secondary, marginTop: 6 }}>
            Credit Score: {buyer.creditScore < 580 ? "❌ Too Low" : "✔ Acceptable"}
          </Text>

          <Text style={{ color: theme.secondary }}>
            Deposit: {buyer.deposit < 300 ? "❌ Weak" : "✔ Strong"}
          </Text>

          <Text style={{ color: theme.secondary }}>
            Surplus: {buyer.income - buyer.expenses < 400 ? "❌ Insufficient" : "✔ Healthy"}
          </Text>
        </SupernovaCard>

        {/* Vehicle Rules Check */}
        <SupernovaCard title="Vehicle Rules Check" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Vehicle Rules Check
          </Text>

          <Text style={{ color: theme.secondary, marginTop: 6 }}>
            Fraud Risk: {fraud > 40 ? "❌ High" : "✔ OK"}
          </Text>

          <Text style={{ color: theme.secondary }}>
            Odometer: {odo > 35 ? "❌ Suspicious" : "✔ Clean"}
          </Text>

          <Text style={{ color: theme.secondary }}>
            Condition: {condition < 50 ? "❌ Poor" : "✔ Acceptable"}
          </Text>
        </SupernovaCard>

        {/* Affordability Rules Check */}
        <SupernovaCard title="Affordability Rules Check" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Affordability Rules Check
          </Text>

          <Text style={{ color: theme.secondary, marginTop: 6 }}>
            Monthly Surplus: £{buyer.income - buyer.expenses}
          </Text>

          <Text style={{ color: theme.secondary }}>
            Risk‑Adjusted Surplus: £
            {Math.round(
              (buyer.income - buyer.expenses) *
                (1 - risk.totalRisk / 200)
            )}
          </Text>

          <Text style={{ color: theme.secondary }}>
            Status:{" "}
            {buyer.income - buyer.expenses < 350 ? "❌ Fail" : "✔ Pass"}
          </Text>
        </SupernovaCard>

        {/* Auto‑Decision Engine */}
        <SupernovaCard title="Auto‑Decision Engine" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Auto‑Decision Engine
          </Text>

          <Text style={{ color: theme.secondary, marginTop: 6 }}>
            {risk.totalRisk < 25 && buyer.creditScore > 650
              ? "AUTO‑APPROVE ✔"
              : risk.totalRisk > 70 || fraud > 45 || odo > 45
              ? "AUTO‑DECLINE ❌"
              : "Manual Review Required"}
          </Text>
        </SupernovaCard>

        {/* Underwriting Alerts */}
        <SupernovaCard title="Underwriting Alerts" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Underwriting Alerts
          </Text>

          {risk.totalRisk > 70 && (
            <Text style={{ color: theme.danger }}>• Extreme total risk</Text>
          )}

          {fraud > 40 && (
            <Text style={{ color: theme.danger }}>• Fraud suspicion detected</Text>
          )}

          {odo > 40 && (
            <Text style={{ color: theme.danger }}>• Odometer anomaly</Text>
          )}

          {condition < 40 && (
            <Text style={{ color: theme.danger }}>• Vehicle condition too low</Text>
          )}
        </SupernovaCard>

        {/* Advanced Deal Structuring (V9) */}
        <SupernovaCard title="Advanced Deal Structuring (V9)" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Advanced Deal Structuring (V9)
          </Text>

          <Text style={{ color: theme.secondary, marginTop: 6 }}>
            Recommended Deposit: £
            {buyer.deposit + (risk.totalRisk > 50 ? 400 : 200)}
          </Text>

          <Text style={{ color: theme.secondary }}>
            Recommended Term: {risk.totalRisk > 60 ? "36 months" : "48 months"}
          </Text>

          <Text style={{ color: theme.secondary }}>
            Risk‑Adjusted Price: £
            {Math.round((auction + 1500) * (1 - risk.totalRisk / 180))}
          </Text>
        </SupernovaCard>

        {/* Underwriting Summary (V9) */}
        <SupernovaCard title="Underwriting Summary (V9)" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Underwriting Summary (V9)
          </Text>

          <Text style={{ color: theme.secondary, marginTop: 6 }}>
            Final Decision:
            {risk.totalRisk < 25
              ? " APPROVE ✔"
              : risk.totalRisk < 60
              ? " CONDITIONAL APPROVAL ⚠"
              : " DECLINE ❌"}
          </Text>

          <Text style={{ color: theme.secondary }}>
            Lender Compatibility:{" "}
            {Math.round(
              (buyer.creditScore / 850) * 40 +
                (100 - risk.totalRisk) * 0.6
            )}{" "}
            / 100
          </Text>

          <Text style={{ color: theme.secondary }}>
            Auto‑Decision:{" "}
            {risk.totalRisk < 25 && buyer.creditScore > 650
              ? "AUTO‑APPROVE"
              : risk.totalRisk > 70
              ? "AUTO‑DECLINE"
              : "Manual Review"}
          </Text>
        </SupernovaCard>
        {/* ⭐ SECTION: CRM Intelligence */}
        <DealerSectionGlow title="CRM Intelligence" />

        {/* Deal Timeline */}
        <SupernovaCard title="Deal Timeline" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Deal Timeline
          </Text>

          {buyer.timeline?.length > 0 ? (
            buyer.timeline.map((event: string, i: number) => (
              <Text key={i} style={{ color: theme.secondary, marginTop: 6 }}>
                • {event}
              </Text>
            ))
          ) : (
            <Text style={{ color: theme.secondary, marginTop: 6 }}>
              No deal events recorded.
            </Text>
          )}
        </SupernovaCard>

        {/* Buyer Notes */}
        <SupernovaCard title="Buyer Notes" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Buyer Notes
          </Text>

          {buyer.notes?.length > 0 ? (
            buyer.notes.map((n: string, i: number) => (
              <Text key={i} style={{ color: theme.secondary, marginTop: 6 }}>
                • {n}
              </Text>
            ))
          ) : (
            <Text style={{ color: theme.secondary, marginTop: 6 }}>
              No notes added.
            </Text>
          )}
        </SupernovaCard>

        {/* Lead Status */}
        <SupernovaCard title="Lead Status" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Lead Status
          </Text>

          <Text style={{ color: theme.secondary, marginTop: 6 }}>
            {risk.totalRisk < 30
              ? "🔥 Hot Lead — High Approval Likelihood"
              : risk.totalRisk < 60
              ? "⚠ Warm Lead — Conditional Approval Likely"
              : "❄ Cold Lead — High Risk"}
          </Text>
        </SupernovaCard>

        {/* Buyer CRM Summary */}
        <SupernovaCard title="Buyer CRM Summary" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Buyer CRM Summary
          </Text>

          <Text style={{ color: theme.secondary, marginTop: 6 }}>
            Engagement Level: {buyer.engagement ?? "Medium"}
          </Text>

          <Text style={{ color: theme.secondary }}>
            Contact Attempts: {buyer.contactAttempts ?? 2}
          </Text>

          <Text style={{ color: theme.secondary }}>
            Last Interaction: {buyer.lastInteraction ?? "Unknown"}
          </Text>
        </SupernovaCard>

        {/* Engagement Score */}
        <SupernovaCard title="Engagement Score" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Engagement Score
          </Text>

          <Text style={{ color: theme.secondary, marginTop: 6 }}>
            {Math.round(
              (buyer.contactAttempts ?? 2) * 12 +
                (buyer.engagement === "High"
                  ? 30
                  : buyer.engagement === "Medium"
                  ? 20
                  : 10)
            )}{" "}
            / 100
          </Text>

          <Text style={{ color: theme.muted }}>
            Higher score = more likely to convert
          </Text>
        </SupernovaCard>

        {/* Behavioural CRM Insights */}
        <SupernovaCard title="Behavioural CRM Insights" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Behavioural CRM Insights
          </Text>

          <Text style={{ color: theme.secondary, marginTop: 6 }}>
            Missed Payment Likelihood: {Math.round(buyer.riskScore * 40)}%
          </Text>

          <Text style={{ color: theme.secondary }}>
            Default Likelihood: {Math.round(buyer.riskScore * 25)}%
          </Text>
        </SupernovaCard>

        {/* Follow‑Up Recommendations */}
        <SupernovaCard title="Follow‑Up Recommendations" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Follow‑Up Recommendations
          </Text>

          <Text style={{ color: theme.secondary, marginTop: 6 }}>
            {risk.totalRisk < 40
              ? "✔ Call within 24 hours — high conversion likelihood"
              : risk.totalRisk < 60
              ? "⚠ Send conditional approval offer"
              : "❌ Avoid aggressive follow‑up — high risk"}
          </Text>
          </SupernovaCard>
                  {/* ⭐ SECTION: StockHub V2 — Bulk Intelligence */}
        <DealerSectionGlow title="StockHub V2 — Bulk Intelligence" />

        {/* Bulk Price Adjustments */}
        <SupernovaCard title="Bulk Price Adjustments" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Bulk Price Adjustments
          </Text>

          {vehicles.map(v => {
            const price = v.price ?? 0;
            const newPrice = Math.round(price * 0.97);

            return (
              <Text key={v.id} style={{ color: theme.secondary, marginTop: 6 }}>
                {v.title}: £{price} → £{newPrice}
              </Text>
            );
          })}
        </SupernovaCard>

        {/* Bulk Risk Check */}
        <SupernovaCard title="Bulk Risk Check" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Bulk Risk Check
          </Text>

          {vehicles.map(v => {
            const r = riskEngine.totalRisk(v, buyer, ai);

            return (
              <Text key={v.id} style={{ color: theme.secondary, marginTop: 6 }}>
                {v.title}: {r.totalRisk}% risk ({r.band})
              </Text>
            );
          })}
        </SupernovaCard>

        {/* Bulk Wholesale Recommendations */}
        <SupernovaCard title="Bulk Wholesale Recommendations" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Bulk Wholesale Recommendations
          </Text>

          {vehicles.map(v => {
            const rec = ai.wholesaleRecommendation(v);

            return (
              <Text key={v.id} style={{ color: theme.secondary, marginTop: 6 }}>
                {v.title}: {rec}
              </Text>
            );
          })}
        </SupernovaCard>

        {/* Bulk MOT Checks */}
        <SupernovaCard title="Bulk MOT Checks" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Bulk MOT Checks
          </Text>

          {vehicles.map(v => {
            const r = riskEngine.totalRisk(v, buyer, ai);

            return (
              <Text key={v.id} style={{ color: theme.secondary, marginTop: 6 }}>
                {v.title}: MOT Risk {r.motRisk}%
              </Text>
            );
          })}
        </SupernovaCard>

        {/* Bulk Condition Scores */}
        <SupernovaCard title="Bulk Condition Scores" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Bulk Condition Scores
          </Text>

          {vehicles.map(v => {
            const score = ai.conditionScore(v);

            return (
              <Text key={v.id} style={{ color: theme.secondary, marginTop: 6 }}>
                {v.title}: {score}/100 condition
              </Text>
            );
          })}
        </SupernovaCard>

        {/* Bulk Tagging */}
        <SupernovaCard title="Bulk Tagging" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Bulk Tagging
          </Text>

          {vehicles.map(v => {
            const tag =
              riskEngine.totalRisk(v, buyer, ai).totalRisk > 60
                ? "High‑Risk"
                : "Retail‑Ready";

            return (
              <Text key={v.id} style={{ color: theme.secondary, marginTop: 6 }}>
                {v.title}: {tag}
              </Text>
            );
          })}
        </SupernovaCard>

        {/* Bulk Export Preview */}
        <SupernovaCard title="Bulk Export Preview" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Bulk Export Preview
          </Text>

          {vehicles.map(v => {
            const r = riskEngine.totalRisk(v, buyer, ai);

            return (
              <Text key={v.id} style={{ color: theme.secondary, marginTop: 6 }}>
                {v.title}: £{v.price} • {r.totalRisk}% risk • {ai.conditionScore(v)}/100 condition
              </Text>
            );
          })}
        </SupernovaCard>

        {/* ⭐ SECTION: StockHub V2 — Advanced Intelligence */}
        <DealerSectionGlow title="StockHub V2 — Advanced Intelligence" />

        {/* Bulk Profitability Analysis */}
        <SupernovaCard title="Bulk Profitability Analysis" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Bulk Profitability Analysis
          </Text>

          {vehicles.map(v => {
            const price = v.price ?? 0;
            const auctionVal = ai.auctionPriceHint(v, []);
            const profit = price - auctionVal;

            return (
              <Text key={v.id} style={{ color: theme.secondary, marginTop: 6 }}>
                {v.title}: {profit >= 0 ? "✔ Profit £" + profit : "❌ Loss £" + profit}
              </Text>
            );
          })}
        </SupernovaCard>

        {/* Bulk Retail Margin */}
        <SupernovaCard title="Bulk Retail Margin" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Bulk Retail Margin
          </Text>

          {vehicles.map(v => {
            const price = v.price ?? 0;
            const retailMargin = Math.round(price * 0.12);

            return (
              <Text key={v.id} style={{ color: theme.secondary, marginTop: 6 }}>
                {v.title}: Retail Margin £{retailMargin}
              </Text>
            );
          })}
        </SupernovaCard>

        {/* Bulk Auction Delta */}
        <SupernovaCard title="Bulk Auction Delta" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Bulk Auction Delta
          </Text>

          {vehicles.map(v => {
            const price = v.price ?? 0;
            const auctionVal = ai.auctionPriceHint(v, []);
            const delta = price - auctionVal;

            return (
              <Text key={v.id} style={{ color: theme.secondary, marginTop: 6 }}>
                {v.title}: Δ £{delta}
              </Text>
            );
          })}
        </SupernovaCard>

        {/* Bulk Suitability Score */}
        <SupernovaCard title="Bulk Suitability Score" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Bulk Suitability Score
          </Text>

          {vehicles.map(v => {
            const r = riskEngine.totalRisk(v, buyer, ai);
            const score = Math.round((100 - r.totalRisk) * 0.85);

            return (
              <Text key={v.id} style={{ color: theme.secondary, marginTop: 6 }}>
                {v.title}: {score}/100 suitability
              </Text>
            );
          })}
        </SupernovaCard>

        {/* Bulk Risk‑Adjusted Pricing */}
        <SupernovaCard title="Bulk Risk‑Adjusted Pricing" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Bulk Risk‑Adjusted Pricing
          </Text>

          {vehicles.map(v => {
            const price = v.price ?? 0;
            const r = riskEngine.totalRisk(v, buyer, ai);
            const adjusted = Math.round(price * (1 - r.totalRisk / 200));

            return (
              <Text key={v.id} style={{ color: theme.secondary, marginTop: 6 }}>
                {v.title}: £{price} → £{adjusted}
              </Text>
            );
          })}
        </SupernovaCard>

        {/* Bulk Deal Strength Score */}
        <SupernovaCard title="Bulk Deal Strength Score" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Bulk Deal Strength Score
          </Text>

          {vehicles.map(v => {
            const r = riskEngine.totalRisk(v, buyer, ai);
            const strength = Math.round((100 - r.totalRisk) * 0.92);

            return (
              <Text key={v.id} style={{ color: theme.secondary, marginTop: 6 }}>
                {v.title}: {strength}/100 deal strength
              </Text>
            );
          })}
        </SupernovaCard>
        {/* ⭐ SECTION: Visual Risk Indicators */}
        <DealerSectionGlow title="Visual Risk Indicators" />

        {/* Animated Risk Bar */}
        <SupernovaCard title="Animated Risk Bar" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Animated Risk Bar
          </Text>

          <View style={{ marginTop: 10 }}>
            <View
              style={{
                height: 10,
                width: `${risk.totalRisk}%`,
                backgroundColor: riskColor(risk.band, theme),
                borderRadius: 6,
              }}
            />
          </View>

          <Text style={{ color: theme.secondary, marginTop: 6 }}>
            {risk.totalRisk}% total risk
          </Text>
        </SupernovaCard>

        {/* Risk Trend */}
        <SupernovaCard title="Risk Trend" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Risk Trend
          </Text>

          <Text style={{ color: theme.secondary, marginTop: 6 }}>
            {risk.totalRisk < 30
              ? "📉 Downward trend — improving"
              : risk.totalRisk < 60
              ? "➡ Stable trend — watch closely"
              : "📈 Upward trend — worsening"}
          </Text>
        </SupernovaCard>

        {/* Final spacing */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <DealerFab vehicleId={vehicle.id} />
    </View>
  );
}

