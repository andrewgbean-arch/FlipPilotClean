import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useDealerAI } from "../../../src/features/dealer-ai/DealerAIContext";
import SupernovaCard from "@/components/dealer/SupernovaCard";
import DealerNeonHeader from "@/components/dealer/DealerNeonHeader";
type FinanceSuiteProps = {
  vehicle: any;   // or FlipRecord if you want strict typing
  buyer: any;
};
export default function FinanceSuiteV16({ vehicle, buyer }: FinanceSuiteProps) {

  const ai = useDealerAI();


  // V16 AI Outputs
  const approval = ai.financeApprovalAI(buyer, vehicle);
  const deposit = ai.depositOptimiser(buyer, vehicle);
  const apr = ai.aprSensitivity(vehicle, buyer);
  const stress = ai.paymentStressTest(buyer, vehicle);
  const lender = ai.lenderMatch(buyer, vehicle);
  const closing = ai.financeClosingScript(buyer, vehicle);
  const compliance = ai.financeComplianceCheck(buyer, vehicle);

  return (
    <ScrollView style={styles.container}>
      <DealerNeonHeader title="Finance Suite V16" subtitle="Advanced Finance Intelligence" />

      {/* Approval */}
      <SupernovaCard title="Finance Approval AI" glow>
        <Text style={styles.value}>{approval}</Text>
        <Text style={styles.desc}>AI‑predicted likelihood of finance approval.</Text>
      </SupernovaCard>

      {/* Deposit Optimiser */}
      <SupernovaCard title="Deposit Optimiser" glow>
        <Text style={styles.value}>£{deposit.recommendedDeposit}</Text>
        <Text style={styles.sub}>Risk Band: {deposit.riskBand}</Text>
        <Text style={styles.sub}>Monthly: £{deposit.monthly}</Text>
        <Text style={styles.desc}>{deposit.message}</Text>
      </SupernovaCard>

      {/* APR Sensitivity */}
      <SupernovaCard title="APR Sensitivity Model" glow>
        <Text style={styles.value}>{apr.apr}% APR</Text>
        <Text style={styles.sub}>Base APR: {apr.baseAPR}%</Text>
        <Text style={styles.sub}>Credit Impact: +{apr.creditImpact}%</Text>
        <Text style={styles.sub}>Fraud Impact: +{apr.fraudImpact}%</Text>
        <Text style={styles.sub}>Age Impact: +{apr.ageImpact}%</Text>
        <Text style={styles.desc}>{apr.message}</Text>
      </SupernovaCard>

      {/* Payment Stress Test */}
      <SupernovaCard title="Payment Stress Test" glow>
        <Text style={styles.value}>£{stress.monthly}/mo</Text>
        <Text style={styles.sub}>Affordability Score: {stress.affordability}</Text>
        <Text style={styles.sub}>
          Status:{" "}
          {stress.safeZone
            ? "Safe Zone"
            : stress.dangerZone
            ? "Danger Zone"
            : "Moderate Risk"}
        </Text>
        <Text style={styles.desc}>{stress.message}</Text>
      </SupernovaCard>

      {/* Lender Match */}
      <SupernovaCard title="Lender Match Engine" glow>
        <Text style={styles.value}>{lender}</Text>
        <Text style={styles.desc}>Best lender match based on buyer + vehicle profile.</Text>
      </SupernovaCard>

      {/* Closing Script */}
      <SupernovaCard title="Finance Closing Script" glow>
        <Text style={styles.desc}>{closing}</Text>
      </SupernovaCard>

      {/* Compliance */}
      <SupernovaCard title="FCA Compliance Check" glow>
        {compliance.map((c, i) => (
          <Text key={i} style={styles.warning}>⚠️ {c}</Text>
        ))}
      </SupernovaCard>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1128",
    paddingHorizontal: 16,
  },
  value: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFD700",
    marginBottom: 6,
  },
  sub: {
    fontSize: 16,
    color: "#ccc",
    marginBottom: 4,
  },
  desc: {
    fontSize: 14,
    color: "#aaa",
    marginTop: 8,
  },
  warning: {
    fontSize: 15,
    color: "#ff6666",
    marginBottom: 4,
  },
});
