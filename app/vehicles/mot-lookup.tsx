import { useState } from "react";
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
import { useRouter } from "expo-router";
import {
  CalendarCheck,
  Gauge,
  ShieldWarning,
  Warning,
  WarningCircle,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { BASE_URL } from "@/utils/api";

// One line of the "what you will see" list: an icon, a name and a short explanation.
function InfoRow({
  Icon,
  label,
  text,
  divider,
}: {
  Icon: PhosphorIcon;
  label: string;
  text: string;
  divider?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}. ${text}`}
      style={[styles.infoRow, divider && { borderTopWidth: 1, borderTopColor: theme.hairline }]}
    >
      <View style={[styles.infoIcon, { backgroundColor: theme.background }]}>
        <Icon size={20} color={theme.muted} />
      </View>

      <View style={styles.infoText}>
        <Text style={[styles.infoLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.infoBody, { color: theme.muted }]}>{text}</Text>
      </View>
    </View>
  );
}

export default function MotLookupScreen() {
  const [reg, setReg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { addVehicle } = useVehicleHistory();

  /* ---------------------------------------------
     MOT Lookup Logic
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

  // Nothing to look up until a plate has been typed (the same test lookup() makes).
  const blank = reg.replace(/\s+/g, "").length === 0;
  const unavailable = loading || blank;

  /* ---------------------------------------------
     MAIN RENDER
  --------------------------------------------- */
  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: theme.text }]} accessibilityRole="header">
          MOT lookup
        </Text>
        <Text style={[styles.pageSub, { color: theme.muted }]}>
          Enter a registration to check its MOT. The vehicle is added to your flips.
        </Text>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
          <Text style={[styles.label, { color: theme.muted }]}>Registration</Text>
          <TextInput
            accessibilityLabel="Registration"
            placeholder="Enter reg (e.g. AB12CDE)"
            placeholderTextColor={theme.muted}
            selectionColor={theme.gold}
            autoCapitalize="characters"
            autoCorrect={false}
            value={reg}
            onChangeText={setReg}
            style={[
              styles.input,
              {
                backgroundColor: theme.background,
                color: theme.text,
                borderColor: theme.hairline,
              },
            ]}
          />

          {error ? (
            <View style={styles.errorRow} accessibilityLiveRegion="polite">
              <WarningCircle size={16} weight="fill" color={theme.danger} />
              <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
          What you will see
        </Text>
        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
          <InfoRow
            Icon={CalendarCheck}
            label="MOT expiry"
            text="When the current MOT runs out, and whether it is still valid."
          />
          <InfoRow
            Icon={Gauge}
            label="Mileage"
            text="The odometer reading recorded at the latest test."
            divider
          />
          <InfoRow
            Icon={Warning}
            label="Advisories"
            text="Items noted at the last test that may need attention."
            divider
          />
          <InfoRow
            Icon={ShieldWarning}
            label="Failures"
            text="Anything that failed the last test."
            divider
          />
        </View>
      </ScrollView>

      {/* LOOKUP */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.background,
            borderTopColor: theme.hairline,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={loading ? "Looking up MOT" : "Look up MOT"}
          accessibilityState={{ busy: loading, disabled: unavailable }}
          onPress={lookup}
          disabled={unavailable}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.gold, opacity: unavailable && !loading ? 0.4 : 1 },
            loading && styles.loadingButton,
            pressed && styles.pressed,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={theme.black} />
          ) : (
            <Text style={[styles.primaryLabel, { color: theme.black }]}>Look up MOT</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  pageTitle: { fontSize: 28, fontWeight: "700" },
  pageSub: { fontSize: 14, lineHeight: 20, marginTop: 4 },

  card: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 0,
    fontSize: 16,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 10,
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18 },

  /* WHAT YOU WILL SEE */
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 24, marginBottom: 12 },
  group: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  infoRow: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: { flex: 1, gap: 2 },
  infoLabel: { fontSize: 16, fontWeight: "600" },
  infoBody: { fontSize: 13, lineHeight: 18 },

  /* LOOKUP */
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  // While a lookup is running the button stays gold but is slightly dimmed.
  loadingButton: { opacity: 0.7 },
  primaryLabel: { fontSize: 16, fontWeight: "700" },

  pressed: { opacity: 0.7 },
});
