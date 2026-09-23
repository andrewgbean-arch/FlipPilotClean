import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Animated,
  Dimensions,
  StyleSheet,
  Image,
} from "react-native";

import HeroHeader from "@/components/ui/HeroHeader";
import GlowPulseCard from "@/components/ui/GlowPulseCard";

import SellerPanel from "@/components/marketplace/SellerPanel";
import ListingActions from "@/components/marketplace/ListingActions";

import { BASE_URL } from "@/utils/api";
import { categoryLabel, fieldsFor } from "@/constants/marketplaceCategories";
import { BUYER_SAFETY_TIPS } from "@/utils/scamSafety";
import SafetyCard from "@/components/marketplace/SafetyCard";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const FP_BLUE = "#0A1128";
const GOLD = "#FFD700";
const MUTED = "#E5ECFF";

export default function ListingDetails() {
  const { id } = useLocalSearchParams();
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // Fade‑in animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();
  }, []);

  // Fetch listing
  useEffect(() => {
    if (!id) return;

    fetch(`${BASE_URL}/published-listings/${id}`)
      // An unknown id comes back as a 404 with an error object, which is not a listing.
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setListing(data && typeof data === "object" && !Array.isArray(data) ? data : null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <Text style={styles.loading}>Loading...</Text>;
  if (!listing) return <Text style={styles.loading}>Listing not found</Text>;

  const listingName = listing.vehicle
    ? `${listing.vehicle.year ?? ""} ${listing.vehicle.make ?? ""} ${listing.vehicle.model ?? ""}`.trim()
    : listing.title ?? "This listing";

  // The category's own questions, in the order they were asked, skipping any
  // the seller left blank. Older listings kept condition on its own.
  const details: Record<string, string> = {
    ...(listing.condition ? { condition: String(listing.condition) } : {}),
    ...(listing.details && typeof listing.details === "object" ? listing.details : {}),
  };

  const answered = fieldsFor(listing.category)
    .map((f) => ({ label: f.label, value: String(details[f.key] ?? "").trim() }))
    .filter((row) => row.value !== "");

  const heroTranslateY = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, -40],
    extrapolate: "clamp",
  });

  const heroScale = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [1, 1.05],
    extrapolate: "clamp",
  });

  return (
    <View style={{ flex: 1, backgroundColor: FP_BLUE }}>
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        <HeroHeader
          title="Listing Details"
          subtitle="Full breakdown of this flip"
          glow
        />

        <View style={{ padding: 20 }}>
          {/* ⭐ Parallax Hero Image */}
          {listing.photos?.[0] && (
            <Animated.View
              style={[
                styles.heroImageWrapper,
                {
                  transform: [{ translateY: heroTranslateY }, { scale: heroScale }],
                },
              ]}
            >
              <Image
                source={{ uri: listing.photos[0] }}
                style={styles.heroImage}
              />

              <View style={styles.heroOverlay} />

              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>FLIPPILOT PRO</Text>
              </View>
            </Animated.View>
          )}

          {/* ⭐ Title */}
          <Text style={styles.title}>{listingName}</Text>

          <Text style={styles.price}>£{listing.price}</Text>

          <Text style={styles.subMeta}>
            {categoryLabel(listing.category)}
            {listing.location ? ` • ${listing.location}` : ""}
          </Text>

          {/* ⭐ What the seller told us about it */}
          {answered.length > 0 && (
            <GlowPulseCard style={{ marginTop: 20 }}>
              <Text style={styles.sectionTitle}>Details</Text>
              {answered.map(({ label, value }) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </View>
              ))}
            </GlowPulseCard>
          )}

          {/* ⭐ Description */}
          {typeof listing.description === "string" && listing.description.trim() !== "" && (
            <GlowPulseCard style={{ marginTop: 20 }}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.body}>{listing.description}</Text>
            </GlowPulseCard>
          )}

          {/* ⭐ Seller — counted from what really happened, not defaults */}
          <SellerPanel sellerId={listing.sellerId} listingId={listing.id} />

          <ListingActions listingId={listing.id} sold={Boolean(listing.soldAt)} />

          <SafetyCard title="Before you buy this" tips={BUYER_SAFETY_TIPS} />
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    padding: 20,
    color: GOLD,
    textAlign: "center",
  },

  heroImageWrapper: {
    marginBottom: 20,
  },
  heroImage: {
    width: "100%",
    height: SCREEN_HEIGHT * 0.3,
    borderRadius: 16,
  },
  heroOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    borderRadius: 16,
    backgroundColor: "rgba(10,17,40,0.45)",
  },
  proBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: FP_BLUE,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: GOLD,
  },
  proBadgeText: {
    color: GOLD,
    fontWeight: "bold",
    fontSize: 12,
  },

  title: {
    color: GOLD,
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 6,
  },
  price: {
    color: MUTED,
    fontSize: 20,
    marginBottom: 6,
  },
  subMeta: {
    color: MUTED,
    fontSize: 14,
    opacity: 0.8,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    paddingVertical: 6,
  },
  detailLabel: {
    color: MUTED,
    fontSize: 14,
    opacity: 0.8,
    flexShrink: 0,
  },
  detailValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },

  body: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 22,
  },

  sectionTitle: {
    color: GOLD,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
});

