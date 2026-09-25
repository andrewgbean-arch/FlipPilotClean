import { formatMoney } from "@/features/vehicles/utils/vehicleStats";
import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
} from "react-native";

import GlowPulseCard from "@/components/ui/GlowPulseCard";
import HeroHeader from "@/components/ui/HeroHeader";
import SparklesOverlay from "@/components/ui/SparklesOverlay";

import { BASE_URL } from "@/utils/api";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function PublicListing() {
  const { id } = useLocalSearchParams();
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  /** Fade-in animation */
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();
  }, []);

  /** Fetch listing */
  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadFailed(false);
    fetch(`${BASE_URL}/published-listings/${id}`)
      // An unknown id is a 404 ("no longer there"); anything else that goes wrong is a failed load, which must
      // not be reported as the listing not existing.
      .then(async (res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error("bad-status");
        return res.json();
      })
      .then((data) => {
        if (!live) return;
        setListing(data && typeof data === "object" && !Array.isArray(data) && !data.error ? data : null);
        setLoading(false);
      })
      .catch(() => {
        if (!live) return;
        setLoadFailed(true);
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [id, reloadKey]);

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );

  if (loadFailed)
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loading}>Couldn't load this listing. Check your connection and try again.</Text>
        <Text style={[styles.loading, { textDecorationLine: "underline" }]} accessibilityRole="button" onPress={() => setReloadKey((k) => k + 1)}>
          Try again
        </Text>
      </View>
    );

  if (!listing || listing.error)
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loading}>This listing is no longer available. It may have been sold or removed.</Text>
      </View>
    );

  // Only a rating a seller has really earned is shown. Never a made-up default.
  const sellerRating: number | null = typeof listing.seller?.rating === "number" ? listing.seller.rating : null;
  const sellerTrust = sellerRating != null ? sellerRating * 20 : 0;

  const listingName = listing.vehicle
    ? `${listing.vehicle.year ?? ""} ${listing.vehicle.make ?? ""} ${listing.vehicle.model ?? ""}`.trim()
    : listing.title ?? "This listing";

  /** Hero animations */
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
    <View style={styles.container}>
      <SparklesOverlay />

      <Animated.ScrollView
        style={{ padding: 20 }}
        contentContainerStyle={{ paddingBottom: 160 }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        <HeroHeader
          title="Listing Overview"
          subtitle="Buyer‑facing FlipPilot intelligence"
          glow
        />

        {/* HERO IMAGE */}
        {listing.photos?.[0] && (
          <Animated.View
            style={[
              styles.heroWrapper,
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

        {/* TITLE + PRICE */}
        <GlowPulseCard style={{ marginTop: 10 }}>
          <Text style={styles.title}>{listingName}</Text>

          <Text style={styles.price}>{formatMoney(Number(listing.price))}</Text>
        </GlowPulseCard>

        {/* GALLERY */}
        {listing.photos?.length > 1 && (
          <GlowPulseCard style={{ marginTop: 20 }}>
            <Text style={styles.sectionTitle}>Gallery</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 10 }}
            >
              {listing.photos.map((uri: string, i: number) => (
                <Animated.View
                  key={i}
                  style={{
                    marginRight: 10,
                    transform: [
                      {
                        scale: fadeAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.9, 1],
                        }),
                      },
                    ],
                  }}
                >
                  <Image source={{ uri }} style={styles.galleryImage} />
                </Animated.View>
              ))}
            </ScrollView>
          </GlowPulseCard>
        )}

        {/* VEHICLE DETAILS (only for listings with structured vehicle data) */}
        {listing.vehicle ? (
          <>
            <GlowPulseCard style={{ marginTop: 20 }}>
              <Text style={styles.sectionTitle}>Vehicle Details</Text>

              <Text style={styles.detailText}>
                Colour: {listing.vehicle?.colour}
              </Text>
              <Text style={styles.detailText}>
                Fuel: {listing.vehicle?.fuelType}
              </Text>
              <Text style={styles.detailText}>
                Engine: {listing.vehicle?.engineSize}cc
              </Text>
              <Text style={styles.detailText}>
                Year: {listing.vehicle?.year}
              </Text>
              <Text style={styles.detailText}>
                Tax Status: {listing.vehicle?.taxStatus}
              </Text>
            </GlowPulseCard>

            {/* MOT HISTORY */}
            <GlowPulseCard style={{ marginTop: 20 }}>
              <Text style={styles.sectionTitle}>MOT History</Text>

              <Text style={styles.detailText}>
                Mileage: {listing.vehicle?.mileage}
              </Text>
              <Text style={styles.detailText}>
                Last MOT: {listing.vehicle?.lastMotDate}
              </Text>
            </GlowPulseCard>
          </>
        ) : (
          <GlowPulseCard style={{ marginTop: 20 }}>
            <Text style={styles.sectionTitle}>Listing Details</Text>

            <Text style={styles.detailText}>
              Category: {listing.category ?? "General"}
            </Text>
            {listing.mileage != null && (
              <Text style={styles.detailText}>Mileage: {listing.mileage}</Text>
            )}
            {listing.location && (
              <Text style={styles.detailText}>Location: {listing.location}</Text>
            )}
          </GlowPulseCard>
        )}

        {/* SELLER TRUST: only when there is a real rating */}
        {sellerRating != null && (
        <GlowPulseCard style={{ marginTop: 20 }}>
          <Text style={styles.sectionTitle}>Seller Trust Meter</Text>

          <View style={styles.trustBar}>
            <View
              style={[
                styles.trustFill,
                {
                  width: `${sellerTrust}%`,
                  backgroundColor:
                    sellerTrust >= 80
                      ? "#4CAF50"
                      : sellerTrust >= 60
                      ? "#FFD700"
                      : "#FF5252",
                },
              ]}
            />
          </View>

          <Text style={styles.detailText}>
            Rating: {sellerRating.toFixed(1)}/5 • Trust:{" "}
            {Math.round(sellerTrust)}%
          </Text>
        </GlowPulseCard>
        )}

        {/* DESCRIPTION */}
        {listing.description && (
          <GlowPulseCard style={{ marginTop: 20 }}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.sectionText}>{listing.description}</Text>
          </GlowPulseCard>
        )}

        {/* CONTACT SELLER */}
        <GlowPulseCard style={{ marginTop: 20 }}>
          <Text style={styles.sectionTitle}>Contact Seller</Text>

          <TouchableOpacity
            onPress={() => router.push(`/messages/${id}`)}
            style={styles.messageButton}
          >
            <Text style={styles.messageButtonText}>Message Seller</Text>
          </TouchableOpacity>
        </GlowPulseCard>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1128",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0A1128",
  },

  loading: {
    padding: 20,
    color: "#FFD700",
  },

  galleryImage: {
    width: 140,
    height: 140,
    borderRadius: 12,
  },

  heroWrapper: {
    marginTop: 10,
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
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  proBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#000",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#FFD700",
  },

  proBadgeText: {
    color: "#FFD700",
    fontWeight: "bold",
    fontSize: 12,
  },

  title: {
    color: "#FFD700",
    fontSize: 26,
    fontWeight: "bold",
  },

  price: {
    color: "#ccc",
    fontSize: 20,
    marginTop: 6,
  },

  sectionTitle: {
    color: "#FFD700",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 6,
  },

  sectionText: {
    color: "#E5ECFF",
    fontSize: 14,
  },

  detailText: {
    color: "#ccc",
    marginTop: 4,
  },

  trustBar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#222",
    overflow: "hidden",
    marginTop: 6,
  },

  trustFill: {
    height: "100%",
  },

  messageButton: {
    backgroundColor: "#FFD700",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: "center",
    shadowColor: "#FFD700",
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 5,
  },

  messageButtonText: {
    fontWeight: "bold",
  },
});
