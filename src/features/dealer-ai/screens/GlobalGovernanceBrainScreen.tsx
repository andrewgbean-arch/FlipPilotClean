import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface GovernanceBrain {
  regionIntel: {
    region: string;
    totalLeads: number;
    avgFlipScore: number;
    pressure: number;
    stability: string;
    economicsImpact: {
      globalInflation: number;
      shippingCostIndex: number;
      commodityPrices: number;
      energyCost: number;
    };
  }[];

  supplyIntel: {
    oem: string;
    globalDemand: number;
    supplyCapacity: number;
    supplyStress: string;
    economicsImpact: {
      inflation: number;
      shippingCostIndex: number;
      commodityPrices: number;
      energyCost: number;
    };
    recommendation: string;
  }[];

  stressIntel: {
    avgPressure: number;
    supplyStressCount: number;
    globalStress: number;
    band: string;
    recommendation: string;
  };

  stockStrategy: {
    region: string;
    ratio: number;
    strategy: string;
    economicsImpact: {
      globalInflation: number;
      shippingCostIndex: number;
      commodityPrices: number;
      energyCost: number;
    };
  }[];

  governanceSummary?: {
    score: number;
    riskBand: string;
    notes: string;
  };
}

interface Props {
  data: GovernanceBrain;
}

export const GlobalGovernanceBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🧠 Global Governance Brain</Text>

      {/* REGION INTEL */}
      <Text style={styles.sectionTitle}>Regional Governance Intel</Text>
      {data.regionIntel.map((r, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.region}>{r.region}</Text>
          <Text style={styles.label}>Total Leads: {r.totalLeads}</Text>
          <Text style={styles.label}>Avg Flip Score: {r.avgFlipScore}</Text>
          <Text style={styles.label}>Pressure: {r.pressure}</Text>
          <Text style={styles.label}>Stability: {r.stability}</Text>
        </View>
      ))}

      {/* SUPPLY INTEL */}
      <Text style={styles.sectionTitle}>Supply Governance Intel</Text>
      {data.supplyIntel.map((s, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.region}>{s.oem}</Text>
          <Text style={styles.label}>Global Demand: {s.globalDemand}</Text>
          <Text style={styles.label}>Supply Capacity: {s.supplyCapacity}</Text>
          <Text style={styles.label}>Supply Stress: {s.supplyStress}</Text>

          <Text style={styles.sectionTitle}>Economics Impact</Text>
          <Text style={styles.label}>Inflation: {s.economicsImpact.inflation}</Text>
          <Text style={styles.label}>
            Shipping Cost Index: {s.economicsImpact.shippingCostIndex}
          </Text>
          <Text style={styles.label}>
            Commodity Prices: {s.economicsImpact.commodityPrices}
          </Text>
          <Text style={styles.label}>Energy Cost: {s.economicsImpact.energyCost}</Text>

          <Text style={styles.sectionTitle}>Recommendation</Text>
          <Text style={styles.notes}>{s.recommendation}</Text>
        </View>
      ))}

      {/* STRESS INTEL */}
      <Text style={styles.sectionTitle}>Global Stress Overview</Text>
      <View style={styles.card}>
        <Text style={styles.label}>
          Avg Pressure: {data.stressIntel.avgPressure.toFixed(1)}
        </Text>
        <Text style={styles.label}>
          Supply Stress Count: {data.stressIntel.supplyStressCount}
        </Text>
        <Text style={styles.label}>
          Global Stress Score: {data.stressIntel.globalStress.toFixed(1)}
        </Text>
        <Text style={styles.label}>Band: {data.stressIntel.band}</Text>
        <Text style={styles.notes}>{data.stressIntel.recommendation}</Text>
      </View>

      {/* STOCK STRATEGY */}
      <Text style={styles.sectionTitle}>Stock Strategy Governance</Text>
      {data.stockStrategy.map((s, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.region}>{s.region}</Text>
          <Text style={styles.label}>Ratio: {s.ratio.toFixed(2)}</Text>
          <Text style={styles.notes}>{s.strategy}</Text>
        </View>
      ))}

      {/* SUMMARY */}
      {data.governanceSummary && (
        <>
          <Text style={styles.sectionTitle}>Governance Summary</Text>
          <View style={styles.card}>
            <Text style={styles.label}>
              Score: {data.governanceSummary.score.toFixed(1)}
            </Text>
            <Text style={styles.label}>
              Risk Band: {data.governanceSummary.riskBand}
            </Text>
            <Text style={styles.notes}>{data.governanceSummary.notes}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 26, fontWeight: "bold", marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: "700", marginVertical: 12 },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 3,
  },
  region: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },
  label: { fontSize: 16, marginBottom: 4 },
  notes: { fontSize: 16, fontStyle: "italic", color: "#444" },
});

