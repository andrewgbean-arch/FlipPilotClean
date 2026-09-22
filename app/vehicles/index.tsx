import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Barcode,
  Camera,
  CaretRight,
  ChartLineUp,
  ClipboardText,
  Garage,
  Plus,
  Storefront,
  UploadSimple,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/ThemeContext";

/* SMALL LOCAL COMPONENTS */
function SectionTitle({ children }: { children: string }) {
  const theme = useTheme();

  return (
    <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

// A tappable row with an icon, a title, a second line and a chevron.
function MenuRow({
  Icon,
  title,
  subtitle,
  onPress,
  divider,
}: {
  Icon: PhosphorIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  divider?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        divider && { borderTopWidth: 1, borderTopColor: theme.hairline },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: theme.background }]}>
        <Icon size={22} color={theme.text} />
      </View>

      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.rowSubtitle, { color: theme.muted }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>

      <CaretRight size={16} color={theme.muted} />
    </Pressable>
  );
}

export default function VehiclesHome() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const card = { backgroundColor: theme.card, borderColor: theme.hairline };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        {/* The native header already says "Vehicles". */}
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Manage, track and enhance your fleet.
        </Text>

        {/* ADD NEW VEHICLE */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add new vehicle"
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.gold },
            pressed && styles.pressed,
          ]}
          onPress={() => router.push("/vehicles/new")}
        >
          <Plus size={20} color={theme.black} weight="bold" />
          <Text style={[styles.primaryLabel, { color: theme.black }]}>Add new vehicle</Text>
        </Pressable>

        {/* QUICK ACTIONS */}
        <SectionTitle>Quick actions</SectionTitle>
        <View style={[styles.group, card]}>
          <MenuRow
            Icon={Garage}
            title="Your flips"
            subtitle="Search and filter your saved vehicles"
            onPress={() => router.push("/vehicles/list")}
          />
          <MenuRow
            Icon={Barcode}
            title="Scan barcode"
            subtitle="Scan an item to see what it is worth"
            onPress={() => router.push("/scan")}
            divider
          />
        </View>

        {/* TOOLS */}
        <SectionTitle>Tools</SectionTitle>
        <View style={[styles.group, card]}>
          <MenuRow
            Icon={ClipboardText}
            title="MOT checker"
            subtitle="Look up a vehicle by registration"
            onPress={() => router.push("/vehicles/mot-lookup")}
          />
          <MenuRow
            Icon={Storefront}
            title="Browse listings"
            subtitle="See what is for sale in the marketplace"
            onPress={() => router.push("/marketplace")}
            divider
          />
          <MenuRow
            Icon={UploadSimple}
            title="Publish a flip"
            subtitle="List one of your flips in the marketplace"
            onPress={() => router.push("/marketplace/PublishFlip")}
            divider
          />
          <MenuRow
            Icon={Camera}
            title="Quick add (AI)"
            subtitle="Create a new flip or edit an existing one"
            onPress={() => router.push("/vehicles/create")}
            divider
          />
          <MenuRow
            Icon={ChartLineUp}
            title="Analytics"
            subtitle="Profit and performance at a glance"
            onPress={() => router.push("/vehicles/analytics/overview")}
            divider
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },

  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 16 },

  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryLabel: { fontSize: 16, fontWeight: "700" },

  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 24, marginBottom: 12 },

  group: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowSubtitle: { fontSize: 13, lineHeight: 18, marginTop: 2 },

  pressed: { opacity: 0.7 },
});
