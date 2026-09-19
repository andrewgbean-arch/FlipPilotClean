import { router, useLocalSearchParams } from "expo-router";
import {
  CalendarBlank,
  CaretRight,
  MagnifyingGlass,
  MapPin,
  WarningCircle,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/ThemeContext";

import { Fair, getAllFairs } from "../../src/lib/fairs";

const API_URL = "https://api.postcodes.io/postcodes/";

type FairResult = Fair & { distance: number };

// Calm, specific wording for each way the search can fail.
function errorCopy(error: string): { title: string; body: string } {
  switch (error) {
    case "No postcode provided.":
      return {
        title: "No postcode entered",
        body: "Go back and enter a postcode to search near.",
      };
    case "Invalid postcode.":
      return {
        title: "Postcode not recognised",
        body: "Check the postcode and try again.",
      };
    case "Failed to fetch postcode data.":
      return {
        title: "Couldn't look up that postcode",
        body: "Check your connection and try again.",
      };
    default:
      return { title: "Couldn't search boot fairs", body: error };
  }
}

function FactRow({ Icon, text }: { Icon: PhosphorIcon; text: string }) {
  const theme = useTheme();

  return (
    <View style={styles.factRow}>
      <Icon size={16} color={theme.muted} />
      <Text style={[styles.factText, { color: theme.text }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

// One boot fair in the results. The whole card opens the fair.
function ResultCard({ item }: { item: FairResult }) {
  const theme = useTheme();

  const image = item.images?.[0];
  const distance = `${item.distance.toFixed(1)} miles away`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${[item.postcode, item.nextDate]
        .filter(Boolean)
        .join(", ")}, ${distance}. View details`}
      onPress={() =>
        router.push({
          pathname: "/bootfairs/details",
          params: { id: item.id },
        })
      }
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.hairline },
        pressed && styles.pressed,
      ]}
    >
      {image ? (
        <Image
          source={{ uri: image }}
          style={[styles.cardImage, { backgroundColor: theme.background }]}
          resizeMode="cover"
        />
      ) : null}

      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={[styles.cardTitle, { color: theme.text }]}>
          {item.name}
        </Text>

        <View style={styles.facts}>
          <FactRow Icon={MapPin} text={item.postcode} />
          {item.nextDate ? <FactRow Icon={CalendarBlank} text={item.nextDate} /> : null}
        </View>

        <View style={[styles.cardFooter, { borderTopColor: theme.hairline }]}>
          <Text style={[styles.distanceText, { color: theme.text }]}>{distance}</Text>
          <CaretRight size={18} color={theme.muted} />
        </View>
      </View>
    </Pressable>
  );
}

export default function BootfairSearchResults() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    postcode?: string | string[];
    radius?: string | string[];
  }>();
  const postcode = (Array.isArray(params.postcode) ? params.postcode[0] : params.postcode)?.trim();
  const radiusParam = Array.isArray(params.radius) ? params.radius[0] : params.radius;
  const radius = Number(radiusParam) || 10;

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<FairResult[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!postcode) {
      setError("No postcode provided.");
      setLoading(false);
      return;
    }

    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    fetch(API_URL + encodeURIComponent(postcode), { signal: controller.signal })
      .then((res) => {
        // A 404 means "no such postcode"; any other failure is the lookup itself.
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`Postcode lookup failed (${res.status})`);
        return res.json();
      })
      .then(async (data) => {
        if (!active) return;

        if (
          typeof data?.result?.latitude !== "number" ||
          typeof data?.result?.longitude !== "number"
        ) {
          setError("Invalid postcode.");
          setLoading(false);
          return;
        }

        const coords = {
          lat: data.result.latitude,
          lng: data.result.longitude,
        };

        // Fairs the user added are stored on the device, so they are part of the search too.
        const allFairs = await getAllFairs();
        if (!active) return;

        const filtered = allFairs
          .map((fair) => {
            const d = distanceMiles(coords.lat, coords.lng, fair.lat, fair.lng);
            return { ...fair, distance: d };
          })
          .filter((f) => f.distance <= radius)
          .sort((a, b) => a.distance - b.distance);

        setResults(filtered);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to fetch postcode data.");
        setLoading(false);
      })
      .finally(() => clearTimeout(timer));

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [postcode, radius]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.muted} />
        <Text style={[styles.stateBody, { color: theme.muted }]}>
          {postcode ? `Searching for boot fairs near ${postcode}` : "Searching for boot fairs"}
        </Text>
      </View>
    );
  }

  if (error) {
    const copy = errorCopy(error);

    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <View
          style={[styles.stateIcon, { backgroundColor: theme.card, borderColor: theme.hairline }]}
        >
          <WarningCircle size={30} color={theme.warning} />
        </View>
        <Text style={[styles.stateTitle, { color: theme.text }]} accessibilityRole="header">
          {copy.title}
        </Text>
        <Text style={[styles.stateBody, { color: theme.muted }]}>{copy.body}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.gold },
            pressed && styles.pressed,
          ]}
          onPress={() => router.back()}
        >
          <Text style={[styles.primaryLabel, { color: theme.black }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
              Results near {postcode}
            </Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>
              Within {radius} miles
              {results.length > 0 ? ` · ${results.length} found` : ""}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <View
              style={[
                styles.stateIcon,
                { backgroundColor: theme.card, borderColor: theme.goldSoftGlow },
              ]}
            >
              <MagnifyingGlass size={30} color={theme.gold} />
            </View>
            <Text style={[styles.stateTitle, { color: theme.text }]}>
              No boot fairs in this area
            </Text>
            <Text style={[styles.stateBody, { color: theme.muted }]}>
              Nothing is listed within {radius} miles of {postcode}. Go back and try a wider
              search.
            </Text>
          </View>
        }
        renderItem={({ item }) => <ResultCard item={item} />}
      />
    </View>
  );
}

/* ------------------------------
   DISTANCE CALCULATION (Haversine)
--------------------------------*/
function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ------------------------------
   STYLES
--------------------------------*/
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pressed: {
    opacity: 0.75,
  },

  /* LOADING / ERROR / EMPTY */
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyBox: {
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 16,
  },
  stateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  stateBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },
  primaryButton: {
    minHeight: 52,
    paddingHorizontal: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: "700",
  },

  /* HEADER */
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },

  /* RESULTS */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  separator: {
    height: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    height: 140,
  },
  cardBody: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
  },
  facts: {
    gap: 6,
    marginTop: 10,
  },
  factRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  factText: {
    flex: 1,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  cardFooter: {
    minHeight: 44,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  distanceText: {
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
