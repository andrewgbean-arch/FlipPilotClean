import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { X } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import GoldFoil from "@/components/ui/GoldFoil";
import { parsePaidPrice } from "@/features/vehicles/utils/boughtStatus";
import { useTheme } from "@/styles/ThemeContext";

/**
 * "Did you buy it?" and, if so, "What did you pay?"
 *
 * Saving a scan only records what an item is worth. Profit totals count only what the person actually
 * bought, for what they actually paid (see features/vehicles/utils/boughtStatus.ts), so this is asked as a
 * scan is saved, and again from History for anything saved but never answered.
 *
 * `context` only changes the wording: "save" (asked as the scan is being saved: closing it saves nothing)
 * or "saved" (an item already in History).
 */
type Props = {
  visible: boolean;
  context: "save" | "saved";
  itemTitle: string;
  /** Offered as the starting point for what they paid: the buy price shown so far (an estimate or their plan). */
  suggestedPrice: number | null;
  /** When they already said they bought it, the price they gave: the sheet opens on that, to change it. */
  currentlyPaid?: number | null;
  onBought: (paid: number) => void;
  onNotBought: () => void;
  onClose: () => void;
};

const toField = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "" : Number.isInteger(n) ? String(n) : n.toFixed(2);

export default function BoughtSheet({
  visible,
  context,
  itemTitle,
  suggestedPrice,
  currentlyPaid = null,
  onBought,
  onNotBought,
  onClose,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const editing = currentlyPaid != null;
  // Opens on the right step straight away (not a flash of the first question when changing a price).
  const [step, setStep] = useState<"ask" | "price">(editing ? "price" : "ask");
  const [text, setText] = useState(editing ? toField(currentlyPaid) : toField(suggestedPrice));
  const [showError, setShowError] = useState(false);

  // Each time it opens: back to the first question (or straight to the price when changing one).
  useEffect(() => {
    if (!visible) return;
    setShowError(false);
    if (editing) {
      setStep("price");
      setText(toField(currentlyPaid));
    } else {
      setStep("ask");
      setText(toField(suggestedPrice));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const paid = parsePaidPrice(text);

  const confirm = () => {
    if (paid == null) {
      setShowError(true);
      return;
    }
    onBought(paid);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.backdrop}
      >
        {/* Tapping outside the sheet closes it (onRequestClose only covers Android's back button). */}
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.hairline,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.muted }]} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
              {step === "ask" ? "Did you buy it?" : "What did you pay?"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
              onPress={onClose}
            >
              <X size={22} color={theme.muted} />
            </Pressable>
          </View>

          <Text style={[styles.item, { color: theme.muted }]} numberOfLines={2}>
            {itemTitle}
          </Text>

          {step === "ask" ? (
            <>
              <Text style={[styles.body, { color: theme.text }]}>
                Only things you've bought count towards your profit, using what you actually paid.
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Yes, I bought it"
                onPress={() => setStep("price")}
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: theme.gold },
                  pressed && styles.pressed,
                ]}
              >
                <GoldFoil />
                <Text style={[styles.primaryText, { color: theme.black }]}>Yes, I bought it</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={context === "save" ? "No, just save it" : "No, I haven't bought it"}
                onPress={onNotBought}
                style={({ pressed }) => [
                  styles.secondary,
                  { borderColor: theme.hairline },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.secondaryText, { color: theme.text }]}>
                  {context === "save" ? "No, just save it" : "No, I haven't bought it"}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <View
                style={[
                  styles.field,
                  { backgroundColor: theme.background, borderColor: showError ? theme.danger : theme.hairline },
                ]}
              >
                <Text style={[styles.pound, { color: theme.muted }]}>£</Text>
                <TextInput
                  value={text}
                  onChangeText={(next) => {
                    setText(next);
                    setShowError(false);
                  }}
                  autoFocus
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={theme.muted}
                  selectTextOnFocus
                  returnKeyType="done"
                  onSubmitEditing={confirm}
                  accessibilityLabel="What you paid, in pounds"
                  style={[styles.input, { color: theme.text }]}
                />
              </View>
              <Text
                style={[styles.hint, { color: showError ? theme.danger : theme.muted }]}
                accessibilityLiveRegion="polite"
              >
                {showError ? "Enter an amount like 12.50." : "Enter 0 if it was free."}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={context === "save" ? "Save with this price" : "Confirm this price"}
                onPress={confirm}
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: theme.gold },
                  pressed && styles.pressed,
                ]}
              >
                <GoldFoil />
                <Text style={[styles.primaryText, { color: theme.black }]}>
                  {context === "save" ? "Save" : "Confirm"}
                </Text>
              </Pressable>

              {!editing ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  onPress={() => setStep("ask")}
                  style={({ pressed }) => [styles.secondary, { borderColor: theme.hairline }, pressed && styles.pressed]}
                >
                  <Text style={[styles.secondaryText, { color: theme.text }]}>Back</Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="I didn't buy it after all"
                  onPress={onNotBought}
                  style={({ pressed }) => [styles.secondary, { borderColor: theme.hairline }, pressed && styles.pressed]}
                >
                  <Text style={[styles.secondaryText, { color: theme.text }]}>I didn't buy it after all</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.6)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, opacity: 0.5, marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 20, fontWeight: "700" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
  item: { fontSize: 14, marginTop: 2 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 14, marginBottom: 6 },
  primary: {
    marginTop: 14,
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  primaryText: { fontSize: 16, fontWeight: "800" },
  secondary: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontSize: 15, fontWeight: "600" },
  field: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  pound: { fontSize: 28, fontWeight: "700", marginRight: 6 },
  input: { flex: 1, fontSize: 28, fontWeight: "700", paddingVertical: 12, fontVariant: ["tabular-nums"] },
  hint: { fontSize: 13, marginTop: 8 },
  pressed: { opacity: 0.7 },
});
