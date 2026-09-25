import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { router, useFocusEffect } from "expo-router";

import { useTheme } from "@/styles/useTheme";
import { useAccount } from "@/lib/account";
import { fetchScanAllowance, type ScanAllowance } from "@/lib/credits";

/**
 * How many scans the person has left, so running out is never a surprise: "3 free scans left", then
 * their credits once the free ones are gone. Tapping it opens the credits screen. Refreshed each time
 * the screen is shown, and hidden whenever there is nothing true to say (limits off in development, or
 * the server can't be reached).
 */
export function scanAllowanceWords(a: ScanAllowance): string {
  if (a.freeLeft > 0) return `${a.freeLeft} free scan${a.freeLeft === 1 ? "" : "s"} left`;
  if (a.signedIn && a.credits > 0) return `${a.credits} credit${a.credits === 1 ? "" : "s"} left`;
  return "No scans left";
}

export default function ScanAllowancePill({ style }: { style?: object }) {
  const theme = useTheme();
  const account = useAccount();
  const [allowance, setAllowance] = useState<ScanAllowance | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      fetchScanAllowance().then((a) => live && setAllowance(a));
      return () => {
        live = false;
      };
    }, [account.email])
  );

  if (!allowance?.metering) return null;
  const words = scanAllowanceWords(allowance);
  const empty = allowance.freeLeft <= 0 && !(allowance.signedIn && allowance.credits > 0);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${words}. Opens your scan credits.`}
      onPress={() => router.push("/credits")}
      style={[styles.pill, { backgroundColor: theme.card, borderColor: empty ? theme.danger : theme.goldDeep }, style]}
    >
      <Text style={[styles.text, { color: empty ? theme.danger : theme.text }]}>{words}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  text: { fontSize: 12, fontWeight: "700" },
});
