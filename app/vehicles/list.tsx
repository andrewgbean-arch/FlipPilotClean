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

export default function VehiclesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { vehicles, toggleFavourite } = useVehicleHistory();

  const [search, setSearch] = useState("");
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);
  const [showHighScoreOnly, setShowHighScoreOnly] = useState(false);
  const [showUndervaluedOnly, setShowUndervaluedOnly] = useState(false);

  const filtered = useMemo(() => {
    return vehicles
      .filter((v) =>
        v.title.toLowerCase().includes(search.toLowerCase().trim())
      )
      .filter((v) => (showFavouritesOnly ? v.favourite : true))
      .filter((v) => {
        const score = v.flipScore ?? 0;
        return showHighScoreOnly ? score >= 75 : true;
      })
      .filter((v) => {
        if (!showUndervaluedOnly) return true;
        return (v.valuation ?? 0) > (v.buyPrice ?? 0);
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [
    vehicles,
    search,
    showFavouritesOnly,
    showHighScoreOnly,
    showUndervaluedOnly,
  ]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.black }}
      contentContainerStyle={{ padding: 16 }}
    >
      {/* HEADER */}
      <Text
        style={{
          fontSize: 28,
          fontWeight: "800",
          color: theme.goldDeep,
          marginBottom: 12,
          textShadowColor: theme.goldSoftGlow,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
        }}
      >
        Your Flips
      </Text>

      {/* SEARCH */}
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by title..."
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

      {/* FILTERS */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <FilterChip
          label="Favourites"
          active={showFavouritesOnly}
          onPress={() => setShowFavouritesOnly((p) => !p)}
          theme={theme}
        />
        <FilterChip
          label="High Score (75+)"
          active={showHighScoreOnly}
          onPress={() => setShowHighScoreOnly((p) => !p)}
          theme={theme}
        />
        <FilterChip
          label="Undervalued"
          active={showUndervaluedOnly}
          onPress={() => setShowUndervaluedOnly((p) => !p)}
          theme={theme}
        />
      </View>

      {/* EMPTY STATE */}
      {filtered.length === 0 ? (
        <Text
          style={{ color: theme.muted, textAlign: "center", marginTop: 40 }}
        >
          No flips found. Add your first flip to get started.
        </Text>
      ) : (
        filtered.map((v, index) => {
          const score = v.flipScore ?? 0;

          const profit =
            (v.sellPrice ?? v.valuation ?? 0) - (v.buyPrice ?? 0);

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

          // ⭐ MOT expiry logic
          const motExpiry = v.mot?.motExpiry ?? v.mot?.expiryDate ?? null;

          let expiryDays: number | null = null;
          let isExpired = false;
          let isExpiringSoon = false;

          if (motExpiry) {
            const expiryDate = new Date(motExpiry);
            const now = new Date();

            expiryDays = Math.ceil(
              (expiryDate.getTime() - now.getTime()) / 86400000
            );

            isExpired = expiryDate < now;
            isExpiringSoon = !isExpired && expiryDays <= 30;
          }

          // ⭐ MOT health
          const issues =
            (v.mot?.advisories?.length ?? 0) +
            (v.mot?.failures?.length ?? 0);

          const motHealth = Math.max(0, 100 - issues * 10);

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
                shadowColor: theme.goldDeep,
                shadowOpacity: 0.25,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              {/* TOP ROW */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text
                    style={{
                      color: theme.white,
                      fontSize: 18,
                      fontWeight: "700",
                    }}
                  >
                    {v.title}
                  </Text>

                  {v.mot?.reg && (
                    <Text
                      style={{
                        color: theme.muted,
                        fontSize: 13,
                        marginTop: 2,
                      }}
                    >
                      Reg: {v.mot.reg}
                    </Text>
                  )}

                  {motExpiry && (
                    <Text
                      style={{
                        color: isExpired
                          ? "#FF4444"
                          : isExpiringSoon
                          ? "#FFA500"
                          : theme.accent,
                        fontSize: 13,
                        marginTop: 2,
                      }}
                    >
                      MOT: {motExpiry}
                      {expiryDays != null &&
                        ` • ${
                          expiryDays > 0
                            ? `in ${expiryDays} days`
                            : `expired ${Math.abs(expiryDays)} days ago`
                        }`}
                    </Text>
                  )}

                  <Text
                    style={{
                      color:
                        motHealth > 80
                          ? "#7CFC00"
                          : motHealth > 60
                          ? "#FFA500"
                          : "#FF4444",
                      fontSize: 13,
                      marginTop: 2,
                    }}
                  >
                    MOT Health: {motHealth}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", gap: 8 }}>
                  {isBestFlip && (
                    <Text style={{ fontSize: 16, color: theme.accent }}>
                      🔥 Best Flip
                    </Text>
                  )}
                  <TouchableOpacity onPress={() => toggleFavourite(v.id)}>
                    <Text style={{ fontSize: 24 }}>
                      {v.favourite ? "⭐" : "☆"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* IMAGE + DETAILS */}
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
                  {/* FLIPSCORE */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 8,
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: theme.radius.full,
                        backgroundColor:
                          score > 75
                            ? theme.goldDeep
                            : score > 50
                            ? "#FFD966"
                            : "#FF6666",
                      }}
                    >
                      <Text
                        style={{
                          color: score > 50 ? theme.black : theme.white,
                          fontWeight: "700",
                        }}
                      >
                        {score}/100
                      </Text>
                    </View>

                    <Text style={{ color: theme.muted, fontSize: 12 }}>
                      FlipScore
                    </Text>
                  </View>

                  {/* VALUATION */}
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

                  {/* PROFIT */}
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

                  {/* ROI */}
                  <Text style={{ color: theme.muted, marginBottom: 4 }}>
                    ROI: {(roi * 100).toFixed(1)}%
                  </Text>

                  {/* PROFIT PER DAY */}
                  <Text style={{ color: theme.muted, marginBottom: 4 }}>
                    Profit/day: £{profitPerDay.toFixed(2)}
                  </Text>

                  {/* AI CONFIDENCE */}
                  {v.aiValuation?.confidence != null && (
                    <Text style={{ color: theme.muted, marginBottom: 4 }}>
                      AI Confidence: {v.aiValuation.confidence}%
                    </Text>
                  )}

                  {/* SUGGESTED LISTING */}
                  {v.valuation != null && (
                    <Text style={{ color: theme.muted, marginBottom: 4 }}>
                      Suggested Listing: £{Math.round(v.valuation * 1.05)}
                    </Text>
                  )}

                  {/* BUY / SELL */}
                  <View
                    style={{ flexDirection: "row", gap: 12, marginBottom: 4 }}
                  >
                    <Text style={{ color: theme.muted, fontSize: 13 }}>
                      Buy: £{v.buyPrice ?? 0}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: 13 }}>
                      Sell: £{v.sellPrice ?? 0}
                    </Text>
                  </View>

                  {/* EXTRA DETAILS */}
                  <Text style={{ color: theme.muted, fontSize: 13 }}>
                    Rarity: {v.rarity ?? "Unknown"} • Condition:{" "}
                    {v.ai?.condition ?? "Unknown"} • Speed:{" "}
                    {v.sellSpeed ?? "Unknown"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  theme,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: any;
}) {
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
