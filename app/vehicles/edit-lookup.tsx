import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

export default function EditLookupScreen() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const theme = useTheme();

  const { vehicles } = useVehicleHistory();

  const normalized = query.trim().toLowerCase();

  // 🔥 Fuzzy + partial matching
  const suggestions = vehicles.filter((v) => {
    const mot = v.mot || {};

    const reg = mot.reg?.toLowerCase() || "";
    const make = mot.make?.toLowerCase() || "";
    const model = mot.model?.toLowerCase() || "";
    const year = mot.year?.toString() || "";

    return (
      reg.includes(normalized) ||
      make.includes(normalized) ||
      model.includes(normalized) ||
      year.includes(normalized)
    );
  });

  const lookup = () => {
    if (!normalized) return;

    const vehicle = suggestions[0];
    if (!vehicle) return;

    router.push(`/vehicles/edit/${vehicle.id}`);
  };

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: theme.black }}>
      <Text style={{ color: theme.white, fontSize: 24, fontWeight: "800", marginBottom: 20 }}>
        Edit Flip Lookup
      </Text>

      {/* 🔥 Auto-uppercase REG */}
      <TextInput
        placeholder="Enter reg, make, model or year"
        placeholderTextColor={theme.muted}
        value={query}
        onChangeText={(t) => setQuery(t.toUpperCase())}
        style={{
          backgroundColor: theme.card,
          color: theme.white,
          padding: 14,
          borderRadius: theme.radius.lg,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
        }}
      />

      {/* 🔥 Suggestions */}
      {normalized.length > 0 && (
        <FlatList
          data={suggestions}
          keyExtractor={(item) => String(item.id)}
          style={{ maxHeight: 200, marginBottom: 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/vehicles/edit/${item.id}`)}
              style={{
                padding: 12,
                backgroundColor: theme.card,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: theme.goldSoftGlow,
                marginBottom: 8,
              }}
            >
              <Text style={{ color: theme.white, fontWeight: "700" }}>
                {item.mot?.reg || "NO REG"} — {item.mot?.make} {item.mot?.model} {item.mot?.year}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={{ color: theme.muted, marginTop: 10 }}>
              No matching vehicles found.
            </Text>
          }
        />
      )}

      {/* 🔥 Lookup button */}
      <TouchableOpacity
        onPress={lookup}
        style={{
          backgroundColor: theme.goldDeep,
          padding: 14,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
        }}
      >
        <Text style={{ textAlign: "center", color: theme.black, fontWeight: "700", fontSize: 18 }}>
          Find Flip
        </Text>
      </TouchableOpacity>
    </View>
  );
}

