import { View, Text, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { useState } from "react";

export default function EditVehicle() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { vehicles, updateVehicle } = useVehicleHistory();

  const vehicle = vehicles.find((v) => String(v.id) === String(id));

  /* ---------------------------------------------
     ⭐ Vehicle not found
  --------------------------------------------- */
  if (!vehicle) {
    return (
      <View style={{ padding: 20 }}>
        <Text style={{ color: theme.white, fontSize: 22, fontWeight: "700" }}>
          Vehicle not found
        </Text>
        <Text style={{ color: theme.muted, marginTop: 10 }}>
          This vehicle no longer exists in your history.
        </Text>
      </View>
    );
  }

  return (
    <EditVehicleForm vehicle={vehicle} updateVehicle={updateVehicle} router={router} theme={theme} />
  );
}

function EditVehicleForm({
  vehicle,
  updateVehicle,
  router,
  theme,
}: {
  vehicle: FlipRecord;
  updateVehicle: (id: string, data: Partial<FlipRecord>) => void;
  router: ReturnType<typeof useRouter>;
  theme: any;
}) {
  // ⭐ Local editable state
  const [mileage, setMileage] = useState(String(vehicle.mileage ?? ""));
  const [buyPrice, setBuyPrice] = useState(String(vehicle.buyPrice ?? ""));
  const [valuation, setValuation] = useState(String(vehicle.valuation ?? ""));
  const [flipScore, setFlipScore] = useState(String(vehicle.flipScore ?? ""));
  const [motExpiry, setMotExpiry] = useState(
    vehicle.mot?.motExpiry ?? vehicle.mot?.expiryDate ?? ""
  );
  const [notes, setNotes] = useState(vehicle.notes ?? "");

  const handleSave = () => {
    updateVehicle(vehicle.id, {
      mileage: Number(mileage),
      buyPrice: Number(buyPrice),
      valuation: Number(valuation),
      flipScore: Number(flipScore),
      mot: {
        ...vehicle.mot,
        motExpiry: motExpiry,
      },
      notes,
    });

    router.back();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.black }}
      contentContainerStyle={{ padding: 16 }}
    >
      {/* HEADER */}
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={{ color: theme.goldDeep, marginBottom: 10 }}>
          ← Back to Vehicle
        </Text>
      </TouchableOpacity>

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
        Edit Vehicle #{vehicle.id}
      </Text>

      {/* FORM */}
      <EditField
        label="Mileage"
        value={mileage}
        onChange={setMileage}
        theme={theme}
        keyboard="numeric"
      />

      <EditField
        label="Buy Price"
        value={buyPrice}
        onChange={setBuyPrice}
        theme={theme}
        keyboard="numeric"
      />

      <EditField
        label="Valuation"
        value={valuation}
        onChange={setValuation}
        theme={theme}
        keyboard="numeric"
      />

      <EditField
        label="Flip Score"
        value={flipScore}
        onChange={setFlipScore}
        theme={theme}
        keyboard="numeric"
      />

      <EditField
        label="MOT Expiry (YYYY-MM-DD)"
        value={motExpiry}
        onChange={setMotExpiry}
        theme={theme}
      />

      <EditField
        label="Notes"
        value={notes}
        onChange={setNotes}
        theme={theme}
        multiline
      />

      {/* SAVE BUTTON */}
      <TouchableOpacity
        style={{
          backgroundColor: theme.goldDeep,
          padding: 16,
          borderRadius: theme.radius.md,
          marginTop: 20,
        }}
        onPress={handleSave}
      >
        <Text
          style={{
            color: theme.black,
            fontWeight: "700",
            textAlign: "center",
            fontSize: 18,
          }}
        >
          Save Changes
        </Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

/* -------------------------------------------------------
   EDIT FIELD COMPONENT
------------------------------------------------------- */

function EditField({
  label,
  value,
  onChange,
  theme,
  keyboard,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  theme: any;
  keyboard?: any;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color: theme.white, marginBottom: 6, fontWeight: "600" }}>
        {label}
      </Text>

      <TextInput
        style={{
          backgroundColor: theme.card,
          color: theme.white,
          padding: 12,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
          minHeight: multiline ? 100 : undefined,
        }}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        multiline={multiline}
        placeholderTextColor={theme.muted}
      />
    </View>
  );
}
