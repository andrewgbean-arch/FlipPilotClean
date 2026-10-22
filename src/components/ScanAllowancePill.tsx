import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { router, useFocusEffect } from "expo-router";

import { useTheme } from "@/styles/useTheme";
import { useAccount } from "@/lib/account";
import { fetchScanAllowance, type ScanAllowance } from "@/lib/credits";
import { needsSignUp, scanAllowanceIsEmpty, scanAllowanceWords } from "@/lib/scanAllowance";

/**
 * How many scans the person has left, so running out is never a surprise: "87 free scans left", "Pro: unlimited scans", or an
 * invitation to sign in (signing up is how you scan). Tapping it opens the person's scans (or the sign-in screen). Refreshed
 * each time the screen is shown, and hidden whenever there is nothing true to say (limits off in development, or the server
 * can't be reached).
 */
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
  const empty = scanAllowanceIsEmpty(allowance);
  const signUp = needsSignUp(allowance);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={signUp ? `${words}. Opens the sign-in screen.` : `${words}. Opens your scans.`}
      onPress={() => router.push(signUp ? "/sign-in" : "/credits")}
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
