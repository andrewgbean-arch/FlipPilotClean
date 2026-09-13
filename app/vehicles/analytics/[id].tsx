import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { useRouter } from "expo-router";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useTheme } from "@/styles/ThemeContext";

export default function AnalyticsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const { vehicles } = useVehicleHistory();

  return <AnalyticsScreenContent vehicles={vehicles} router={router} theme={theme} />;
}

function AnalyticsScreenContent({
  vehicles,
  router,
  theme,
}: {
  vehicles: ReturnType<typeof useVehicleHistory>["vehicles"];
  router: ReturnType<typeof useRouter>;
  theme: any;
}) {
  // ⭐ Original screen logic
  const [search, setSearch] = useState("");
  const [showUndervaluedOnly, setShowUndervaluedOnly] = useState(false);

  const [sortMode, setSortMode] = useState<
    "recent" | "valuation" | "profit" | "roi" | "score"
  >("recent");

  const filtered = useMemo(() => {
    let list = vehicles
      .filter((v) =>
        v.title.toLowerCase().includes(search.toLowerCase().trim())
      )
      .filter((v) => {
        if (!showUndervaluedOnly) return true;
        return (v.valuation ?? 0) > (v.buyPrice ?? 0);
      });

    list = [...list].sort((a, b) => {
      const profitA = (a.sellPrice ?? a.valuation ?? 0) - (a.buyPrice ?? 0);
      const profitB = (b.sellPrice ?? b.valuation ?? 0) - (b.buyPrice ?? 0);

      const roiA = a.buyPrice ? profitA / a.buyPrice : 0;
      const roiB = b.buyPrice ? profitB / b.buyPrice : 0;

      switch (sortMode) {
        case "valuation":
          return (b.valuation ?? 0) - (a.valuation ?? 0);
        case "profit":
          return profitB - profitA;
        case "roi":
          return roiB - roiA;
        case "score":
          return (b.flipScore ?? 0) - (a.flipScore ?? 0);
        default:
          return b.timestamp.localeCompare(a.timestamp);
      }
    });

    return list;
  }, [vehicles, search, showUndervaluedOnly, sortMode]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.black }}
      contentContainerStyle={{ padding: 16 }}
    >
      <Text
        style={{
          fontSize: 28,
          fontWeight: "800",
          color: theme.goldDeep,
          marginBottom: 12,
        }}
      >
        Analytics
      </Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search flips..."
        placeholderTextColor={theme.muted}
        style={{
          backgroundColor: theme.card,
          color: theme.white,
          padding: 12,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
          marginBottom: 14,
        }}
      />

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <FilterChip
          label="Undervalued"
          active={showUndervaluedOnly}
          onPress={() => setShowUndervaluedOnly((p) => !p)}
          theme={theme}
        />
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <SortChip
          label="Recent"
          mode="recent"
          active={sortMode}
          setActive={setSortMode}
          theme={theme}
        />
        <SortChip
          label="Valuation"
          mode="valuation"
          active={sortMode}
          setActive={setSortMode}
          theme={theme}
        />
        <SortChip
          label="Profit"
          mode="profit"
          active={sortMode}
          setActive={setSortMode}
          theme={theme}
        />
        <SortChip
          label="ROI"
          mode="roi"
          active={sortMode}
          setActive={setSortMode}
          theme={theme}
        />
        <SortChip
          label="FlipScore"
          mode="score"
          active={sortMode}
          setActive={setSortMode}
          theme={theme}
        />
      </View>

      {filtered.map((v, index) => {
        const profit = (v.sellPrice ?? v.valuation ?? 0) - (v.buyPrice ?? 0);
        const roi = v.buyPrice ? profit / v.buyPrice : 0;

        const profitPerDay = v.timestamp
          ? profit /
            Math.max(
              1,
              (Date.now() - new Date(v.timestamp).getTime()) / 86400000
            )
          : 0;

        const thumbnail =
          v.images && v.images.length > 0
            ? v.images[0]
            : "https://placehold.co/120x80/000000/FFFFFF";

        const isBestFlip = index < Math.ceil(filtered.length * 0.1);

        return (
          <TouchableOpacity
            key={v.id}
            onPress={() => router.push(`/vehicles/overview/${v.id}`)}
            style={{
              backgroundColor: theme.card,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.goldSoftGlow,
              padding: 14,
              marginBottom: 14,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  color: theme.white,
                  fontSize: 18,
                  fontWeight: "700",
                }}
              >
                {v.title}
              </Text>

              {isBestFlip && (
                <Text style={{ color: theme.accent, fontSize: 16 }}>
                  🔥 Best Flip
                </Text>
              )}
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <Image
                source={{ uri: thumbnail }}
                style={{
                  width: 120,
                  height: 80,
                  borderRadius: theme.radius.md,
                  borderWidth: 2,
                  borderColor: theme.goldDeep,
                }}
              />

              <View style={{ flex: 1 }}>
                {v.valuation != null && (
                  <Text
                    style={{
                      color: theme.accent,
                      fontSize: 14,
                      fontWeight: "700",
                      marginBottom: 4,
                    }}
                  >
                    Valuation: £{v.valuation}
                  </Text>
                )}

                <Text
                  style={{
                    color: profit >= 0 ? "#7CFC00" : "#FF4444",
                    fontSize: 14,
                    fontWeight: "700",
                    marginBottom: 4,
                  }}
                >
                  Profit: £{profit}
                </Text>

                <Text style={{ color: theme.muted, marginBottom: 4 }}>
                  ROI: {(roi * 100).toFixed(1)}%
                </Text>

                <Text style={{ color: theme.muted, marginBottom: 4 }}>
                  Profit/day: £{profitPerDay.toFixed(2)}
                </Text>

                {v.aiValuation?.confidence != null && (
                  <Text style={{ color: theme.muted, marginBottom: 4 }}>
                    AI Confidence: {v.aiValuation.confidence}%
                  </Text>
                )}

                {v.valuation != null && (
                  <Text style={{ color: theme.muted, marginBottom: 4 }}>
                    Suggested Listing: £{Math.round(v.valuation * 1.05)}
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// -----------------------------
// ⭐ FIXED TYPES FOR FILTER CHIP
// -----------------------------
interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: any;
}

function FilterChip({ label, active, onPress, theme }: FilterChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
        backgroundColor: active ? theme.goldSoftGlow : theme.card,
      }}
    >
      <Text
        style={{
          color: active ? theme.black : theme.white,
          fontSize: 13,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// -----------------------------
// ⭐ FIXED TYPES FOR SORT CHIP
// -----------------------------
type SortMode = "recent" | "valuation" | "profit" | "roi" | "score";

interface SortChipProps {
  label: string;
  mode: SortMode;
  active: SortMode;
  setActive: React.Dispatch<React.SetStateAction<SortMode>>;
  theme: any;
}

function SortChip({ label, mode, active, setActive, theme }: SortChipProps) {
  return (
    <TouchableOpacity
      onPress={() => setActive(mode)}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
        backgroundColor: active === mode ? theme.goldSoftGlow : theme.card,
      }}
    >
      <Text
        style={{
          color: active === mode ? theme.black : theme.white,
          fontSize: 13,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}


