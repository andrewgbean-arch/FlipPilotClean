import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SponsoredCard from "../../src/components/SponsoredCard";
import { businessAdverts } from "../../src/lib/businessAdverts";
import { Fair, fairs } from "../../src/lib/fairs";

export default function BootFairFinderScreen() {
  const [postcode, setPostcode] = useState("");
  const [radius, setRadius] = useState(10);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  const [fairLocations, setFairLocations] = useState<Fair[]>([]);

  useEffect(() => {
    setFairLocations(fairs);
  }, []);

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const toggleView = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setViewMode(viewMode === "list" ? "map" : "list");

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  const featuredAd = businessAdverts.find((ad) => ad.isFeatured);
  const otherAds = businessAdverts.filter((ad) => !ad.isFeatured);

  // Use `featured` fairs as "sponsored" for now
  const sponsoredFairs = useMemo(
    () => fairLocations.filter((f) => f.featured).slice(0, 5),
    [fairLocations]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER SIGNBOARD */}
        <Animated.View
          style={{
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          }}
        >
          <View style={styles.signBoard}>
            <Text style={styles.signTitle}>Boot Fairs</Text>
            <Text style={styles.signSubtitle}>
              Real British car boot vibes. Find stalls, fields, and bargains.
            </Text>
          </View>
        </Animated.View>

        {/* SIGNPOST VIEW TOGGLE */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.signPostButton,
              viewMode === "list" && styles.signPostActive,
            ]}
            onPress={() => viewMode !== "list" && toggleView()}
          >
            <Text
              style={[
                styles.signPostText,
                viewMode === "list" && styles.signPostTextActive,
              ]}
            >
              List View
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.signPostButton,
              viewMode === "map" && styles.signPostActive,
            ]}
            onPress={() => viewMode !== "map" && toggleView()}
          >
            <Text
              style={[
                styles.signPostText,
                viewMode === "map" && styles.signPostTextActive,
              ]}
            >
              Map View
            </Text>
          </TouchableOpacity>
        </View>

        {/* CHALKBOARD SEARCH */}
        {viewMode === "list" && (
          <View style={styles.searchBox}>
            <Text style={styles.searchLabel}>Find a boot fair near you</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter postcode (e.g. TQ4 6AG)"
              placeholderTextColor="#C9D2E0"
              value={postcode}
              onChangeText={setPostcode}
            />

            <View style={styles.radiusRow}>
              {[5, 10, 20].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.radiusButton,
                    radius === r && styles.radiusSelected,
                  ]}
                  onPress={() => setRadius(r)}
                >
                  <Text
                    style={[
                      styles.radiusText,
                      radius === r && styles.radiusTextSelected,
                    ]}
                  >
                    {r} miles
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
  style={styles.searchButton}
  onPress={() =>
    router.push({
      pathname: "/bootfairs/search",
      params: { postcode, radius },
    })
  }
>
  <Text style={styles.searchText}>Search boot fairs</Text>
</TouchableOpacity>

          </View>
        )}

        <Animated.View style={{ opacity: fadeAnim }}>
          {viewMode === "list" ? (
            <>
              {/* TOP SPONSORED BOOTFAIRS BOX */}
              {sponsoredFairs.length > 0 && (
                <View style={styles.sponsoredBox}>
                  <Text style={styles.sponsoredTitle}>
                    Top sponsored bootfairs near you
                  </Text>
                  <Text style={styles.sponsoredSubtitle}>
                    Featured stalls within about {radius} miles.
                  </Text>

                  {sponsoredFairs.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.sponsoredFairCard}
                      onPress={() =>
                        router.push({
                          pathname: "/bootfairs/details",
                          params: { id: item.id },
                        })
                      }
                    >
                      <View style={styles.sponsoredFairLeft}>
                        <Text style={styles.sponsoredFairName}>
                          {item.name}
                        </Text>
                        <Text style={styles.sponsoredFairMeta}>
                          {item.postcode} • {item.nextDate}
                        </Text>
                        <Text style={styles.sponsoredFairTag}>
                          ⭐ Sponsored bootfair
                        </Text>
                      </View>
                      <View style={styles.sponsoredFairRight}>
                        <Text style={styles.sponsoredFairDistance}>
                          ~{radius} mi
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* HERO SPONSOR BANNER (LOCAL BUSINESS) */}
              {featuredAd && (
                <View style={styles.heroSponsor}>
                  {featuredAd.image && (
                    <Image
                      source={{ uri: featuredAd.image }}
                      style={styles.heroImage}
                    />
                  )}

                  <View style={styles.heroOverlay} />

                  <View style={styles.heroContent}>
                    <Text style={styles.heroTag}>Sponsored stall</Text>
                    <Text style={styles.heroTitle}>{featuredAd.title}</Text>
                  </View>
                </View>
              )}

              {/* SPONSOR CAROUSEL (LOCAL BUSINESSES) */}
              {otherAds.length > 0 && (
                <View style={styles.carouselSection}>
                  <Text style={styles.carouselTitle}>Other sponsored stalls</Text>

                  <FlatList
                    data={otherAds}
                    keyExtractor={(item) => item.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.carouselContent}
                    renderItem={({ item }) => (
                      <View style={styles.sponsorCardWrapper}>
                        <SponsoredCard advert={item} />
                      </View>
                    )}
                  />
                </View>
              )}

              {/* BOOTFAIR LIST */}
              <FlatList
                data={fairLocations}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 8 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.card}
                    onPress={() =>
                      router.push({
                        pathname: "/bootfairs/details",
                        params: { id: item.id },
                      })
                    }
                  >
                    {/* Ticket stub top strip */}
                    <View style={styles.cardTopStrip}>
                      <Text style={styles.cardTopStripText}>
                        {item.postcode}
                      </Text>
                    </View>

                    {item.images?.[0] && (
                      <Image
                        source={{ uri: item.images[0] }}
                        style={styles.cardImage}
                      />
                    )}

                    <Text style={styles.cardTitle}>{item.name}</Text>

                    <View style={styles.badgeRow}>
                      {item.featured && (
                        <View style={styles.featuredBadge}>
                          <Text style={styles.featuredText}>⭐ Featured</Text>
                        </View>
                      )}

                      <View style={styles.frequencyBadge}>
                        <Text style={styles.frequencyText}>
                          {item.frequency}
                        </Text>
                      </View>

                      <View style={styles.busyBadge}>
                        <Text style={styles.busyText}>
                          {item.busyScore}/10 Busy
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.cardSub}>{item.postcode}</Text>
                    <Text style={styles.cardSub}>{item.nextDate}</Text>

                    <Text style={styles.cardFees}>
                      {item.openingTime}–{item.closingTime}
                    </Text>

                    <Text style={styles.viewDetails}>View stall details →</Text>

                    {/* Ticket perforation */}
                    <View style={styles.cardPerforationRow}>
                      <View style={styles.cardPerforationDot} />
                      <View style={styles.cardPerforationLine} />
                      <View style={styles.cardPerforationDot} />
                    </View>
                  </TouchableOpacity>
                )}
              />

              {/* BOTTOM LOCAL BUSINESS SPONSOR (SECONDARY) */}
              {otherAds.length > 0 && (
                <View style={styles.bottomSponsorBox}>
                  <Text style={styles.bottomSponsorLabel}>Sponsored</Text>
                  <SponsoredCard advert={otherAds[0]} />
                </View>
              )}
            </>
          ) : (
            <View style={styles.mapPlaceholder}>
              <Text style={{ color: "#fff", textAlign: "center" }}>
                Map view disabled (Expo Go limitation)
              </Text>
            </View>
          )}
        </Animated.View>

        {/* LIST YOUR BOOT FAIR BUTTON */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/bootfairs/add")}
        >
          <Text style={styles.addButtonText}>List Your Boot Fair</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0A1128",
  },
  container: {
    flex: 1,
    backgroundColor: "#0A1128",
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  /* SIGNBOARD HEADER */
  signBoard: {
    backgroundColor: "#112240",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  signTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFD700",
    textAlign: "center",
  },
  signSubtitle: {
    marginTop: 6,
    color: "#C9D2E0",
    fontSize: 14,
    textAlign: "center",
  },

  /* SIGNPOST TOGGLE */
  toggleRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    marginBottom: 10,
  },
  signPostButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#374151",
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#112240",
  },
  signPostActive: {
    borderColor: "#FFD700",
    backgroundColor: "#1F2937",
  },
  signPostText: {
    color: "#9CA3AF",
    fontWeight: "800",
    fontSize: 14,
  },
  signPostTextActive: {
    color: "#FFD700",
  },

  /* CHALKBOARD SEARCH */
  searchBox: {
    backgroundColor: "#112240",
    padding: 16,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#FFD700",
    marginBottom: 16,
  },
  searchLabel: {
    color: "#F9FAFB",
    fontWeight: "800",
    marginBottom: 8,
    fontSize: 14,
  },
  input: {
    backgroundColor: "#0A1128",
    padding: 14,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 12,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#4B5563",
  },
  radiusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  radiusButton: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 4,
    backgroundColor: "#0A1128",
    borderRadius: 999,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4B5563",
  },
  radiusSelected: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  radiusText: {
    color: "#E5E7EB",
    fontWeight: "700",
  },
  radiusTextSelected: {
    color: "#FFFFFF",
  },
  searchButton: {
    backgroundColor: "#22C55E",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  searchText: {
    color: "#022C22",
    fontSize: 16,
    fontWeight: "900",
  },

  /* SPONSORED BOOTFAIRS BOX */
  sponsoredBox: {
    width: "100%",
    marginBottom: 16,
    backgroundColor: "#112240",
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#FFD700",
    padding: 16,
  },
  sponsoredTitle: {
    color: "#F9FAFB",
    fontWeight: "900",
    fontSize: 15,
  },
  sponsoredSubtitle: {
    color: "#9CA3AF",
    fontSize: 13,
    marginTop: 2,
    marginBottom: 10,
  },
  sponsoredFairCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,215,0,0.25)",
  },
  sponsoredFairLeft: {
    flex: 1,
  },
  sponsoredFairRight: {
    paddingLeft: 10,
  },
  sponsoredFairName: {
    color: "#F9FAFB",
    fontWeight: "800",
    fontSize: 14,
  },
  sponsoredFairMeta: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 2,
  },
  sponsoredFairTag: {
    color: "#FBBF24",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "700",
  },
  sponsoredFairDistance: {
    color: "#E5E7EB",
    fontWeight: "700",
    fontSize: 13,
  },

  /* HERO SPONSOR */
  heroSponsor: {
    width: "100%",
    marginBottom: 16,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  heroImage: {
    width: "100%",
    height: 160,
  },
heroOverlay: {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  backgroundColor: "rgba(0,0,0,0.45)",
},


  heroContent: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
  },
  heroTag: {
    color: "#FBBF24",
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 4,
  },
  heroTitle: {
    color: "#F9FAFB",
    fontSize: 20,
    fontWeight: "900",
  },

  /* SPONSOR CAROUSEL */
  carouselSection: {
    marginBottom: 12,
  },
  carouselTitle: {
    color: "#E5E7EB",
    fontWeight: "800",
    fontSize: 14,
    marginBottom: 6,
  },
  carouselContent: {
    paddingVertical: 4,
  },
  sponsorCardWrapper: {
    width: 260,
    marginRight: 10,
  },

  /* BOOTFAIR CARDS */
  card: {
    backgroundColor: "#112240",
    padding: 16,
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  cardTopStrip: {
    backgroundColor: "#1F2937",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  cardTopStripText: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  cardImage: {
    width: "100%",
    height: 140,
    borderRadius: 12,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
    color: "#F9FAFB",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  featuredBadge: {
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.7)",
  },
  featuredText: {
    color: "#FBBF24",
    fontWeight: "700",
    fontSize: 12,
  },
  frequencyBadge: {
    backgroundColor: "rgba(148, 163, 184, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.6)",
  },
  frequencyText: {
    color: "#E5E7EB",
    fontWeight: "600",
    fontSize: 12,
  },
  busyBadge: {
    backgroundColor: "rgba(248, 113, 113, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.7)",
  },
  busyText: {
    color: "#FCA5A5",
    fontWeight: "600",
    fontSize: 12,
  },
  cardSub: {
    color: "#9CA3AF",
    marginBottom: 2,
    fontSize: 13,
  },
  cardFees: {
    color: "#22C55E",
    fontWeight: "700",
    marginBottom: 8,
    fontSize: 14,
  },
  viewDetails: {
    color: "#3B82F6",
    fontWeight: "800",
    fontSize: 14,
  },

  /* TICKET PERFORATION */
  cardPerforationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  cardPerforationDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#0A1128",
  },
  cardPerforationLine: {
    flex: 1,
    height: 1,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#4B5563",
    marginHorizontal: 6,
  },

  /* BOTTOM SPONSOR */
  bottomSponsorBox: {
    width: "100%",
    backgroundColor: "#112240",
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#FFD700",
    padding: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  bottomSponsorLabel: {
    color: "#9CA3AF",
    fontSize: 12,
    marginBottom: 4,
    fontWeight: "700",
  },

  /* MAP PLACEHOLDER */
  mapPlaceholder: {
    height: 260,
    backgroundColor: "#112240",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 16,
  },

  /* ADD BUTTON */
  addButton: {
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: "#22C55E",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  addButtonText: {
    color: "#022C22",
    fontSize: 17,
    fontWeight: "900",
  },
});

