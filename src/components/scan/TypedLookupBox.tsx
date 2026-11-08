import { MagnifyingGlass } from "phosphor-react-native";
import { useEffect, useRef } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native";

import GoldFoil from "@/components/ui/GoldFoil";
import { useTheme } from "@/styles/ThemeContext";
import { TYPED_MAX, typedReady } from "@/utils/typedLookup";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  /** Called when Go (or the keyboard's search key) is pressed and enough has been typed. */
  onSubmit: () => void;
  /** True while a lookup is running: the box and Go are switched off so it cannot be sent twice. */
  disabled?: boolean;
  /** Changing this number puts the cursor in the box (used when the person arrives from Home's Make & Model tile). */
  focusSignal?: number;
  onFocus?: () => void;
  onBlur?: () => void;
  style?: StyleProp<ViewStyle>;
};

// A moment for the screen to finish arriving before the keyboard is asked for.
const FOCUS_DELAY_MS = 150;

/**
 * "Type make and model number": the third way to start a scan, for an item with no barcode that the camera cannot read
 * (or for a phone whose camera is off). It sits on the Scan screen and sends the same first step as a barcode or a photo.
 */
export default function TypedLookupBox({ value, onChangeText, onSubmit, disabled, focusSignal, onFocus, onBlur, style }: Props) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!focusSignal) return;
    const timer = setTimeout(() => inputRef.current?.focus(), FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [focusSignal]);

  const ready = typedReady(value) && !disabled;
  const submit = () => {
    if (!ready) return;
    Keyboard.dismiss();
    onSubmit();
  };

  return (
    <View style={[styles.row, style]}>
      <MagnifyingGlass size={20} color="rgba(255,255,255,0.7)" />
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder="Make and model number"
        placeholderTextColor="rgba(255,255,255,0.6)"
        maxFontSizeMultiplier={1.2}
        accessibilityLabel="Make and model number"
        accessibilityHint="Type the make and the model number, for example Sony WH-1000XM4, then press Go to check the price"
        returnKeyType="search"
        onSubmitEditing={submit}
        autoCorrect={false}
        spellCheck={false}
        autoCapitalize="words"
        maxLength={TYPED_MAX}
        editable={!disabled}
        onFocus={onFocus}
        onBlur={onBlur}
        selectionColor={theme.gold}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go, check the price"
        accessibilityState={{ disabled: !ready }}
        disabled={!ready}
        onPress={submit}
        style={[styles.go, { backgroundColor: theme.gold }, !ready && styles.goOff]}
      >
        <GoldFoil />
        <Text style={[styles.goLabel, { color: theme.black }]}>Go</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 14,
    paddingRight: 7,
    borderRadius: 14,
    backgroundColor: "rgba(10,17,40,0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  input: { flex: 1, minWidth: 0, paddingVertical: 10, fontSize: 16, color: "#FFFFFF" },
  go: { minWidth: 56, minHeight: 40, paddingHorizontal: 14, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  goOff: { opacity: 0.4 },
  goLabel: { fontSize: 16, fontWeight: "800" },
});
