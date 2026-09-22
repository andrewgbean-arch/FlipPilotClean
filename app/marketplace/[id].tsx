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

import SellerProfileCard from "@/features/seller/SellerProfileCard";
import SellerBadges from "@/components/core/SellerBadges";

import { BASE_URL } from "@/utils/api";

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

          {/* ⭐ Seller */}
          <GlowPulseCard style={{ marginTop: 20 }}>
            <Text style={styles.sectionTitle}>Seller</Text>

            <SellerProfileCard seller={listing.seller} />
            <SellerBadges seller={listing.seller} />
          </GlowPulseCard>
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
    marginBottom: 10,
  },

  sectionTitle: {
    color: GOLD,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
});

