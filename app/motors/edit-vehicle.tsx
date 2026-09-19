import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Car, Warning } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { daysUntilDate } from "@/features/vehicles/utils/motDates";

type AppTheme = ReturnType<typeof useTheme>;

const NUMBERS_ERROR = "Mileage, buy price and valuation need to be numbers.";
const EXPIRY_ERROR = "Enter the MOT expiry as YYYY-MM-DD, for example 2026-11-04.";

// A blank box means "not set" (null), not zero. Undefined means it isn't a number.
function readNumber(text: string): number | null | undefined {
  const cleaned = text.replace(/[,£\s]/g, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

export default function EditVehicle() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { vehicles, updateVehicle, loaded, loadError } = useVehicleHistory();

  const vehicle = vehicles.find((v) => String(v.id) === String(id));

  /* ---------------------------------------------
     Vehicle not found
  --------------------------------------------- */
  if (!vehicle) {
    // Saved vehicles are read from storage after launch; do not call one
    // missing before that has finished.
    if (!loaded) {
      return (
        <View style={[styles.flex, styles.center, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.muted} />
          <Text style={[styles.stateBody, { color: theme.muted }]}>Loading your vehicle</Text>
        </View>
      );
    }

    return (
      <View style={[styles.flex, styles.center, { backgroundColor: theme.background }]}>
        <View
          style={[styles.stateIcon, { backgroundColor: theme.card, borderColor: theme.hairline }]}
        >
          {loadError ? (
            <Warning size={30} color={theme.warning} />
          ) : (
            <Car size={30} color={theme.muted} />
          )}
        </View>
        <Text style={[styles.stateTitle, { color: theme.text }]} accessibilityRole="header">
          {loadError ? "Couldn't load your vehicles" : "Vehicle not found"}
        </Text>
        <Text style={[styles.stateBody, { color: theme.muted }]}>
          {loadError ?? "This vehicle no longer exists in your history."}
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
  theme: AppTheme;
}) {
  const insets = useSafeAreaInsets();

  // Local editable state
  const [mileage, setMileage] = useState(String(vehicle.mileage ?? ""));
  const [buyPrice, setBuyPrice] = useState(String(vehicle.buyPrice ?? ""));
  const [valuation, setValuation] = useState(String(vehicle.valuation ?? ""));
  const [motExpiry, setMotExpiry] = useState(
    vehicle.mot?.motExpiry ?? vehicle.mot?.expiryDate ?? ""
  );
  const [notes, setNotes] = useState(vehicle.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const newMileage = readNumber(mileage);
    const newBuyPrice = readNumber(buyPrice);
    const newValuation = readNumber(valuation);
    if (
      newMileage === undefined ||
      newBuyPrice === undefined ||
      newValuation === undefined
    ) {
      setError(NUMBERS_ERROR);
      return;
    }

    const expiry = motExpiry.trim();
    if (expiry !== "" && daysUntilDate(expiry) === null) {
      setError(EXPIRY_ERROR);
      return;
    }

    setError(null);

    // The flip score is recalculated from these values when the vehicle is
    // saved, so it is not an editable field.
    updateVehicle(vehicle.id, {
      mileage: newMileage,
      buyPrice: newBuyPrice,
      valuation: newValuation,
      mot: {
        ...vehicle.mot,
        motExpiry: expiry || null,
        expiryDate: expiry || null,
        mileage: newMileage ?? vehicle.mot?.mileage ?? null,
      },
      notes,
    });

    router.back();
  };

  // The one error message is shown under the field it is about. A number
  // problem is outlined on every box that still isn't a number and worded once,
  // under the first of them.
  const numbersProblem = error === NUMBERS_ERROR;
  const mileageBad = numbersProblem && readNumber(mileage) === undefined;
  const buyBad = numbersProblem && readNumber(buyPrice) === undefined;
  const valuationBad = numbersProblem && readNumber(valuation) === undefined;

  const expiryText = motExpiry.trim();
  const expiryBad =
    error === EXPIRY_ERROR && expiryText !== "" && daysUntilDate(expiryText) === null;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <Text
          style={[styles.title, { color: theme.text }]}
          numberOfLines={2}
          accessibilityRole="header"
        >
          {vehicle.title}
        </Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Update the details for this vehicle.
        </Text>

        {/* FORM */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
          <EditField
            label="Mileage"
            value={mileage}
            onChange={setMileage}
            theme={theme}
            keyboard="numeric"
            invalid={mileageBad}
            error={mileageBad ? NUMBERS_ERROR : null}
          />

          <EditField
            label="Buy price"
            value={buyPrice}
            onChange={setBuyPrice}
            theme={theme}
            keyboard="numeric"
            prefix="£"
            invalid={buyBad}
            error={buyBad && !mileageBad ? NUMBERS_ERROR : null}
          />

          <EditField
            label="Valuation"
            value={valuation}
            onChange={setValuation}
            theme={theme}
            keyboard="numeric"
            prefix="£"
            invalid={valuationBad}
            error={valuationBad && !mileageBad && !buyBad ? NUMBERS_ERROR : null}
          />

          <EditField
            label="MOT expiry (YYYY-MM-DD)"
            value={motExpiry}
            onChange={setMotExpiry}
            theme={theme}
            placeholder="2026-11-04"
            invalid={expiryBad}
            error={expiryBad ? EXPIRY_ERROR : null}
          />

          <EditField
            label="Notes"
            value={notes}
            onChange={setNotes}
            theme={theme}
            multiline
          />
        </View>

        {/* SAVE BUTTON */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save changes"
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.gold },
            pressed && styles.pressed,
          ]}
          onPress={handleSave}
        >
          <Text style={[styles.primaryLabel, { color: theme.black }]}>Save changes</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* -------------------------------------------------------
   EDIT FIELD COMPONENT
------------------------------------------------------- */

// A label over a 48pt input, with its error (if any) directly underneath.
function EditField({
  label,
  value,
  onChange,
  theme,
  keyboard,
  multiline,
  placeholder,
  prefix,
  error,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  theme: AppTheme;
  keyboard?: "default" | "numeric";
  multiline?: boolean;
  placeholder?: string;
  prefix?: string;
  error?: string | null;
  invalid?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  const borderColor = error || invalid ? theme.danger : focused ? theme.gold : theme.hairline;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>

      <View
        style={[
          styles.inputBox,
          multiline ? styles.inputBoxMulti : styles.inputBoxSingle,
          { backgroundColor: theme.background, borderColor },
        ]}
      >
        {prefix ? <Text style={[styles.prefix, { color: theme.muted }]}>{prefix}</Text> : null}

        <TextInput
          style={[
            styles.input,
            multiline ? styles.inputMulti : styles.inputSingle,
            keyboard === "numeric" && styles.tabular,
            { color: theme.text },
          ]}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboard}
          multiline={multiline}
          placeholder={placeholder}
          placeholderTextColor={theme.muted}
          accessibilityLabel={prefix === "£" ? `${label} in pounds` : label}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>

      {error ? (
        <Text style={[styles.error, { color: theme.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },

  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  stateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  stateTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  stateBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },

  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 14, marginTop: 2 },

  card: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },

  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600" },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputBoxSingle: { height: 48 },
  inputBoxMulti: { minHeight: 112, alignItems: "flex-start" },
  prefix: { fontSize: 16, marginRight: 6 },
  input: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontSize: 16,
  },
  inputSingle: { height: "100%" },
  inputMulti: {
    paddingVertical: 12,
    minHeight: 110,
    textAlignVertical: "top",
  },
  tabular: { fontVariant: ["tabular-nums"] },
  error: { fontSize: 13, lineHeight: 18 },

  primaryButton: {
    minHeight: 52,
    marginTop: 24,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: { fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.75 },
});
