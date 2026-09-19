import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { CaretRight, PencilSimple, PlusCircle } from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";

import { useTheme } from "@/styles/ThemeContext";

// A tappable card: an icon in a circle, a title, a one-line description and a chevron.
function OptionCard({
  Icon,
  iconColor,
  title,
  description,
  onPress,
}: {
  Icon: PhosphorIcon;
  iconColor: string;
  title: string;
  description: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.hairline },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: theme.background, borderColor: theme.hairline }]}>
        <Icon size={24} color={iconColor} />
      </View>

      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.cardDescription, { color: theme.muted }]}>{description}</Text>
      </View>

      <CaretRight size={16} color={theme.muted} />
    </Pressable>
  );
}

export default function CreateVehicleMenu() {
  const theme = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
        Create a vehicle flip
      </Text>
      <Text style={[styles.subtitle, { color: theme.muted }]}>
        Add a new flip, or change one you have already saved.
      </Text>

      <View style={styles.options}>
        <OptionCard
          Icon={PlusCircle}
          iconColor={theme.gold}
          title="Add new flip"
          description="Enter the vehicle, its prices and how it should sell."
          onPress={() => router.push("/vehicles/create/new")}
        />

        <OptionCard
          Icon={PencilSimple}
          iconColor={theme.muted}
          title="Edit existing flip"
          description="Find a saved flip and update its details."
          onPress={() => router.push("/vehicles/edit-lookup")}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  options: { marginTop: 24, gap: 12 },
  card: {
    minHeight: 76,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1, minWidth: 0, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cardDescription: { fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.75 },
});
