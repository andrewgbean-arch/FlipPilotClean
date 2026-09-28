import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { CheckCircle, CircleIcon } from "phosphor-react-native";

import { useTheme } from "@/styles/ThemeContext";
import { hasScannedBefore, hasVisitedMarketplace } from "@/utils/onboarding";
import type { FlipRecord } from "@/features/vehicles/models/FlipRecord";

/**
 * Four real things to try, ticked off from what has actually happened on this phone — not a
 * made-up progress bar. Disappears once every item is done, so it never lingers as clutter.
 */

type Item = { key: string; label: string; route: string; done: boolean };

export default function GettingStartedCard({ flips }: { flips: FlipRecord[] }) {
  const theme = useTheme();
  const [visitedMarketplace, setVisitedMarketplace] = useState(false);
  const [scanned, setScanned] = useState(false);

  // Re-checked every time Home is shown again (coming back from Marketplace or a scan, say), not
  // just when a flip is saved, so a tick appears as soon as it's true rather than waiting on that.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      hasVisitedMarketplace().then((v) => live && setVisitedMarketplace(v));
      hasScannedBefore().then((v) => live && setScanned(v));
      return () => {
        live = false;
      };
    }, [])
  );

  const items: Item[] = [
    // A price having been shown is the milestone — not whether that particular scan got saved.
    { key: "scan", label: "Scan something to see what it's worth", route: "/scan", done: scanned || flips.some((f) => !f.mot) },
    { key: "mot", label: "Check a car's MOT history", route: "/vehicles/mot-lookup", done: flips.some((f) => !!f.mot) },
    { key: "favourite", label: "Star a favourite", route: "/history", done: flips.some((f) => f.favourite) },
    { key: "market", label: "Have a look at the Marketplace", route: "/marketplace", done: visitedMarketplace },
  ];

  if (items.every((i) => i.done)) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
      <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
        Getting started
      </Text>
      {items.map((item, i) => (
        <Pressable
          key={item.key}
          accessibilityRole="button"
          accessibilityLabel={`${item.label}${item.done ? ", done" : ""}`}
          disabled={item.done}
          onPress={() => router.push(item.route as any)}
          style={({ pressed }) => [
            styles.row,
            i > 0 && { borderTopWidth: 1, borderTopColor: theme.hairline },
            pressed && !item.done && { opacity: 0.7 },
          ]}
        >
          {item.done ? (
            <CheckCircle size={20} weight="fill" color={theme.success} />
          ) : (
            <CircleIcon size={20} color={theme.muted} />
          )}
          <Text
            style={[
              styles.label,
              { color: item.done ? theme.muted : theme.text, textDecorationLine: item.done ? "line-through" : "none" },
            ]}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, marginHorizontal: 16, marginBottom: 16, overflow: "hidden" },
  title: { fontSize: 16, fontWeight: "700", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  label: { flex: 1, fontSize: 14 },
});
