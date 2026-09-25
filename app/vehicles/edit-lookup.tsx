import { useState } from "react";
import GoldFoil from "@/components/ui/GoldFoil";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  CaretRight,
  CarSimple,
  MagnifyingGlass,
  MagnifyingGlassMinus,
  Package,
  WarningCircle,
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

export default function EditLookupScreen() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { vehicles, loaded, loadError } = useVehicleHistory();

  const normalized = query.trim().toLowerCase();
  // Plates are saved with or without a space, so compare them with spaces removed.
  const compact = normalized.replace(/\s+/g, "");

  // Fuzzy + partial matching
  const suggestions = vehicles.filter((v) => {
    const mot = v.mot || {};

    const reg = mot.reg?.toLowerCase().replace(/\s+/g, "") || "";
    const make = mot.make?.toLowerCase() || "";
    const model = mot.model?.toLowerCase() || "";
    const year = mot.year?.toString() || "";
    const title = v.title?.toLowerCase() || "";

    return (
      reg.includes(compact) ||
      make.includes(normalized) ||
      model.includes(normalized) ||
      year.includes(normalized) ||
      title.includes(normalized)
    );
  });

  const lookup = () => {
    if (!normalized) return;

    const vehicle = suggestions[0];
    if (!vehicle) return;

    router.push(`/vehicles/edit/${vehicle.id}`);
  };

  const hasQuery = normalized.length > 0;
  const canFind = hasQuery && suggestions.length > 0;

  // What to show while nothing has been typed yet.
  const emptyState = !loaded
    ? null
    : loadError
    ? {
        Icon: WarningCircle,
        color: theme.warning,
        title: "Couldn't load your flips",
        body: loadError,
      }
    : vehicles.length === 0
    ? {
        Icon: Package,
        color: theme.muted,
        title: "No flips to edit yet",
        body: "Add a vehicle or scan an item and it will show up here.",
      }
    : {
        Icon: MagnifyingGlass,
        color: theme.muted,
        title: "Search your flips",
        body: "Type a registration, make, model or year to see the flips that match.",
      };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Text style={[styles.pageTitle, { color: theme.text }]} accessibilityRole="header">
          Find a flip to edit
        </Text>
        <Text style={[styles.pageSub, { color: theme.muted }]}>
          Search by registration, make, model, year or title.
        </Text>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
          <Text style={[styles.label, { color: theme.muted }]}>Search your flips</Text>
          <TextInput
            accessibilityLabel="Search your flips"
            placeholder="Enter reg, make, model or year"
            placeholderTextColor={theme.muted}
            selectionColor={theme.gold}
            autoCapitalize="characters"
            autoCorrect={false}
            value={query}
            onChangeText={(t) => setQuery(t.toUpperCase())}
            style={[
              styles.input,
              {
                backgroundColor: theme.background,
                color: theme.text,
                borderColor: theme.hairline,
              },
            ]}
          />
        </View>
      </View>

      {hasQuery ? (
        <FlatList
          data={suggestions}
          keyExtractor={(item) => String(item.id)}
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            suggestions.length > 0 ? (
              <Text style={[styles.resultsNote, { color: theme.muted }]}>
                {suggestions.length} {suggestions.length === 1 ? "match" : "matches"}. Tap one, or
                use Find flip to open the first.
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            const reg = item.mot?.reg || "";
            const detail = [item.mot?.make, item.mot?.model, item.mot?.year]
              .filter(Boolean)
              .join(" ");
            const primary = reg || item.title;
            const secondary = reg ? detail || item.title : "";
            const RowIcon = reg ? CarSimple : Package;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${primary}${secondary ? `, ${secondary}` : ""}`}
                onPress={() => router.push(`/vehicles/edit/${item.id}`)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: theme.card, borderColor: theme.hairline },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: theme.background }]}>
                  <RowIcon size={22} color={theme.muted} />
                </View>

                <View style={styles.rowText}>
                  <Text style={[styles.rowPrimary, { color: theme.text }]} numberOfLines={1}>
                    {primary}
                  </Text>
                  {secondary ? (
                    <Text style={[styles.rowSecondary, { color: theme.muted }]} numberOfLines={1}>
                      {secondary}
                    </Text>
                  ) : null}
                </View>

                <CaretRight size={18} color={theme.muted} />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyInList}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: theme.card, borderColor: theme.hairline },
                ]}
              >
                <MagnifyingGlassMinus size={30} color={theme.muted} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                No matching vehicles found
              </Text>
              <Text style={[styles.emptyBody, { color: theme.muted }]}>
                Check the registration, or try a make, model or year.
              </Text>
            </View>
          }
        />
      ) : (
        <View style={styles.emptyBox}>
          {emptyState ? (
            <>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: theme.card, borderColor: theme.hairline },
                ]}
              >
                <emptyState.Icon size={30} color={emptyState.color} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>{emptyState.title}</Text>
              <Text style={[styles.emptyBody, { color: theme.muted }]}>{emptyState.body}</Text>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={theme.muted} />
              <Text style={[styles.emptyBody, { color: theme.muted, marginTop: 16 }]}>
                Loading your flips
              </Text>
            </>
          )}
        </View>
      )}

      {/* FIND */}
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
          accessibilityLabel="Find flip"
          accessibilityState={{ disabled: !canFind }}
          disabled={!canFind}
          onPress={lookup}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.gold, overflow: "hidden", opacity: canFind ? 1 : 0.4 },
            pressed && styles.pressed,
          ]}
        >
          <GoldFoil />
          <Text style={[styles.primaryLabel, { color: theme.black }]}>Find flip</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  pageTitle: { fontSize: 28, fontWeight: "700" },
  pageSub: { fontSize: 14, marginTop: 4 },

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

  /* RESULTS */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  separator: { height: 8 },
  resultsNote: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  row: {
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 2 },
  rowPrimary: { fontSize: 16, fontWeight: "600" },
  rowSecondary: { fontSize: 13 },

  /* EMPTY AND LOADING STATES */
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  emptyInList: {
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 32,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  emptyBody: { fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8 },

  /* FIND */
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
  primaryLabel: { fontSize: 16, fontWeight: "700" },

  pressed: { opacity: 0.7 },
});
