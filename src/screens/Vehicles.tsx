import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useTheme } from "@/context/ThemeContext";

export default function VehiclesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { vehicles, toggleFavourite } = useVehicleHistory();

  const [search, setSearch] = useState("");
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);
  const [showHighScoreOnly, setShowHighScoreOnly] = useState(false);

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
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [vehicles, search, showFavouritesOnly, showHighScoreOnly]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: 16 }}
    >
      <Text style={[styles.heading, { color: theme.goldDeep }]}>
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
          padding: 10,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
          marginBottom: 10,
        }}
      />

      {/* FILTERS */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
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
      </View>

      {filtered.length === 0 ? (
        <Text
          style={{ color: theme.muted, textAlign: "center", marginTop: 40 }}
        >
          No flips found. Add your first flip to get started.
        </Text>
      ) : (
        filtered.map((v) => {
          const score = v.flipScore ?? 0;

          return (
            <TouchableOpacity
              key={v.id}
              onPress={() => router.push(`/VehicleDetails?id=${v.id}`)}
              style={{
                backgroundColor: theme.card,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: theme.goldSoftGlow,
                padding: 14,
                marginBottom: 12,
              }}
            >
              {/* TOP ROW: TITLE + FAVOURITE */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{
                    color: theme.white,
                    fontSize: 18,
                    fontWeight: "600",
                  }}
                >
                  {v.title}
                </Text>

                <TouchableOpacity onPress={() => toggleFavourite(v.id)}>
                  <Text style={{ fontSize: 24 }}>
                    {v.favourite ? "⭐" : "☆"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* FLIPSCORE BADGE */}
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

              {/* PROFIT PREVIEW */}
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 4 }}>
                <Text style={{ color: theme.muted, fontSize: 13 }}>
                  Buy: £{v.buyPrice}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 13 }}>
                  Sell: £{v.sellPrice}
                </Text>
              </View>

              <Text style={{ color: theme.muted, fontSize: 13 }}>
                Rarity: {v.rarity ?? "Unknown"} • Condition:{" "}
                {v.ai?.condition ?? "Unknown"} • Speed:{" "}
                {v.sellSpeed ?? "Unknown"}
              </Text>
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

const styles = StyleSheet.create({
  heading: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 12,
  },
});
