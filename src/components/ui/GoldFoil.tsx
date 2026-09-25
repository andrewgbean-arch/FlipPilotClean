import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * The gold-foil face of a main button: put it as the FIRST child inside a button that has `overflow: "hidden"`
 * and its own corner radius, and the label and icon sit on top of it. It paints a metallic gold gradient with a
 * light top edge and a darker bottom edge, so every main button looks like the same piece of gold.
 * It takes no touches (the button underneath does), and if it ever fails to draw, the button's plain gold
 * background shows instead.
 */
export const FOIL_COLORS = ["#FFF3B0", "#FFD700", "#C5A100", "#F7E27A", "#D9B300"] as const;
export const FOIL_STOPS = [0, 0.28, 0.55, 0.78, 1] as const;

export default function GoldFoil() {
  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={FOIL_COLORS as unknown as [string, string, ...string[]]}
        locations={FOIL_STOPS as unknown as [number, number, ...number[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.topEdge} />
      <View pointerEvents="none" style={styles.bottomEdge} />
    </>
  );
}

const styles = StyleSheet.create({
  topEdge: { position: "absolute", top: 0, left: 0, right: 0, height: 1.5, backgroundColor: "rgba(255,255,255,0.7)" },
  bottomEdge: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2, backgroundColor: "rgba(120,90,0,0.5)" },
});
