import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { BASE_URL } from "@/utils/api";

export default function MotLookupScreen() {
  const [reg, setReg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const theme = useTheme();

  const { addVehicle } = useVehicleHistory();

  /* ---------------------------------------------
     ⭐ MOT Lookup Logic
  --------------------------------------------- */
  const lookup = async () => {
    // The DVLA and DVSA services want the plate without spaces.
    const plate = reg.replace(/\s+/g, "").toUpperCase();
    if (!plate || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${BASE_URL}/vehicle?reg=${encodeURIComponent(plate)}`);
      const data = await res.json();

      if (!res.ok || !data.ok) {
        // The server sends a string for its own errors but can pass a DVSA error object through.
        setError(
          res.status === 503
            ? "Vehicle lookup isn't available right now. Try again later."
            : typeof data?.error === "string"
            ? data.error
            : "No vehicle found for that registration."
        );
        return;
      }

      const v = data.vehicle ?? {};

      const newVehicle = addVehicle({
        title: `${v.make ?? ""} ${v.model ?? ""}`.trim() || plate,
        buyPrice: null,
        sellPrice: null,
        mot: {
          reg: plate,
          make: v.make ?? null,
          model: v.model ?? null,
          year: v.year ?? null,
          colour: v.colour ?? null,
          taxStatus: v.taxStatus ?? null,
          motExpiry: v.motExpiry ?? null,
          expiryDate: v.motExpiry ?? null,
          mileage: v.mileage ?? null,
          advisories: v.advisories?.map((a: any) => a.text ?? String(a)) ?? [],
          failures: v.failures?.map((f: any) => f.text ?? String(f)) ?? [],
          mileageHistory: v.mileage != null && v.lastMotDate
            ? [{ date: v.lastMotDate, mileage: v.mileage }]
            : [],
        },
      });

      router.push(`/mot/${newVehicle.id}`);
    } catch (e) {
      console.log("MOT lookup failed:", e);
      setError("Couldn't reach the lookup service. Try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------------
     ⭐ MAIN RENDER
  --------------------------------------------- */
  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: theme.black }}>
      <Text style={{ color: theme.white, fontSize: 24, fontWeight: "800", marginBottom: 20 }}>
        MOT Lookup
      </Text>

      <TextInput
        placeholder="Enter reg (e.g. AB12CDE)"
        placeholderTextColor={theme.muted}
        value={reg}
        onChangeText={setReg}
        style={{
          backgroundColor: theme.card,
          color: theme.white,
          padding: 14,
          borderRadius: theme.radius.lg,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
        }}
      />

      <TouchableOpacity
        onPress={lookup}
        disabled={loading}
        style={{
          backgroundColor: theme.goldDeep,
          padding: 14,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color={theme.black} />
        ) : (
          <Text style={{ textAlign: "center", color: theme.black, fontWeight: "700", fontSize: 18 }}>
            Lookup MOT
          </Text>
        )}
      </TouchableOpacity>

      {error && (
        <Text style={{ color: theme.danger, marginTop: 16, textAlign: "center" }}>
          {error}
        </Text>
      )}
    </View>
  );
}
