import { ScrollView, View, Text } from "react-native";
import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { useUserSettings } from "@/features/settings/UserSettingsContext";

import FinanceSuiteSummaryCard from "@/components/dealer/FinanceSuiteSummaryCard";
import { DealerGridButton } from "@/components/dealer/DealerGridButton";

/* -------------------------------------------------------
   REAL ENGINE IMPORTS
------------------------------------------------------- */

import MarketHeatEngine from "@/components/dealer/engines/MarketHeatEngine";
import RiskRadar from "@/components/dealer/engines/RiskRadar";
import ProfitConsistency from "@/components/dealer/engines/ProfitConsistency";
import MotHealthIndex from "@/components/dealer/engines/MotHealthIndex";
import FlipTimeAnalyzer from "@/components/dealer/engines/FlipTimeAnalyzer";
import PriceEfficiency from "@/components/dealer/engines/PriceEfficiency";
import SmartAlerts from "@/components/dealer/engines/SmartAlerts";
import BusinessScore from "@/components/dealer/engines/BusinessScore";

/* -------------------------------------------------------
   MAIN SCREEN
------------------------------------------------------- */

export default function DealerTools() {
  const theme = useTheme();
  const { vehicles } = useVehicleHistory();
  const { isDealer } = useUserSettings();

  const activeVehicle: FlipRecord | null =
    vehicles.length > 0
      ? [...vehicles].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
      : null;

  if (!isDealer) {
    return (
      <View style={{ padding: 20 }}>
        <Text style={{ color: theme.white, fontSize: 22, fontWeight: "700" }}>
          Dealer Mode is OFF
        </Text>
        <Text style={{ color: theme.muted, marginTop: 10 }}>
          Turn it on in Settings to access Dealer Tools.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.black }}
      contentContainerStyle={{ padding: 16 }}
    >
      {/* HEADER */}
      <Text
        style={{
          fontSize: 32,
          fontWeight: "800",
          color: theme.goldDeep,
          marginBottom: 12,
          textShadowColor: theme.goldSoftGlow,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
        }}
      >
        Dealer Intelligence Suite
      </Text>

      <Text style={{ color: theme.muted, marginBottom: 20 }}>
        Dealership‑grade analytics based on your FlipPilot vehicle history.
      </Text>

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

      {/* ⭐ FinanceSuite SummaryCard */}
      {activeVehicle && (
        <FinanceSuiteSummaryCard vehicle={activeVehicle} buyer={{}} />
      )}

      {/* 1. MARKET HEAT ENGINE */}
      <DealerCard title="Market Heat Engine" theme={theme}>
        <MarketHeatEngine vehicles={vehicles} theme={theme} />
      </DealerCard>

      {/* 2. RISK RADAR */}
      <DealerCard title="Risk Radar" theme={theme}>
        <RiskRadar vehicles={vehicles} theme={theme} />
      </DealerCard>

      {/* 3. PROFIT CONSISTENCY SCORE */}
      <DealerCard title="Profit Consistency Score" theme={theme}>
        <ProfitConsistency vehicles={vehicles} theme={theme} />
      </DealerCard>

      {/* 4. MOT HEALTH INDEX */}
      <DealerCard title="MOT Health Index" theme={theme}>
        <MotHealthIndex vehicles={vehicles} theme={theme} />
      </DealerCard>

      {/* 5. FLIP TIME ANALYZER */}
      <DealerCard title="Flip Time Analyzer" theme={theme}>
        <FlipTimeAnalyzer vehicles={vehicles} theme={theme} />
      </DealerCard>

      {/* 6. PRICE EFFICIENCY SCORE */}
      <DealerCard title="Price Efficiency Score" theme={theme}>
        <PriceEfficiency vehicles={vehicles} theme={theme} />
      </DealerCard>

      {/* 7. SMART ALERTS */}
      <DealerCard title="Smart Alerts" theme={theme}>
        <SmartAlerts vehicles={vehicles} theme={theme} />
      </DealerCard>

      {/* 8. FLIPPILOT BUSINESS SCORE */}
      <DealerCard title="FlipPilot Business Score" theme={theme}>
        <BusinessScore vehicles={vehicles} theme={theme} />
      </DealerCard>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

/* -------------------------------------------------------
   WRAPPER CARD — FULLY TYPED
------------------------------------------------------- */

type DealerCardProps = {
  title: string;
  children: React.ReactNode;
  theme: any;
};

function DealerCard({ title, children, theme }: DealerCardProps) {
  return (
    <View
      style={{
        backgroundColor: theme.card,
        padding: 16,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
        marginBottom: 20,
      }}
    >
      <Text style={{ color: theme.white, fontSize: 20, fontWeight: "700" }}>
        {title}
      </Text>
      <View style={{ marginTop: 10 }}>{children}</View>
    </View>
  );
}
