import { router, useLocalSearchParams } from "expo-router";
import {
    ActivityIndicator,
    Animated,
    Image,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

// ❌ REMOVED expo-maps
// import { MapView } from "expo-maps";

// ❌ REMOVED react-native-maps Marker
// import { Marker } from "react-native-maps";

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Fair, getAllFairs } from "../../src/lib/fairs";

export default function BootfairDetails() {
  const { id: idParam } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  const [fair, setFair] = useState<Fair | null>(null);
  const [loading, setLoading] = useState(true);

  const slideAnim = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    let active = true;

    // Fairs the user added live in storage, so they are read asynchronously.
    getAllFairs().then((all) => {
      if (!active) return;
      setFair(all.find((f) => f.id === id) ?? null);
      setLoading(false);
    });

    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 450,
      useNativeDriver: true,
    }).start();

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  if (!fair) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>Bootfair not found.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const openMaps = () => {
    // Fairs listed without coordinates are stored as 0,0 (a point in the sea),
    // so search by address/postcode instead.
    const hasCoords = fair.lat !== 0 || fair.lng !== 0;
    const query = hasCoords
      ? `${fair.lat},${fair.lng}`
      : encodeURIComponent([fair.address, fair.postcode].filter(Boolean).join(", "));
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  const openWebsite = () => {
    if (fair.website) Linking.openURL(fair.website);
  };

  const callOrganiser = () => {
    if (fair.phone) Linking.openURL(`tel:${fair.phone}`);
  };

  const emailOrganiser = () => {
    if (fair.email) Linking.openURL(`mailto:${fair.email}`);
  };

  return (
    <ScrollView style={styles.container}>
      {/* HERO IMAGE */}
      {fair.images?.length > 0 && (
        <Image source={{ uri: fair.images[0] }} style={styles.heroImage} />
      )}

      <Text style={styles.title}>{fair.name}</Text>
      <Text style={styles.address}>{fair.address || fair.postcode}</Text>

      {/* SLIDE-UP PANEL */}
      <Animated.View style={[styles.panel, { transform: [{ translateY: slideAnim }] }]}>
        {/* BADGES */}
        <View style={styles.badgeRow}>
          {fair.featured && (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredText}>⭐ Featured</Text>
            </View>
          )}

          {fair.verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={16} color="#FFD700" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}

          <View style={styles.hoursBadge}>
            <Text style={styles.hoursText}>{fair.hours}</Text>
          </View>

          {/* 0 means nobody has rated it, not "quiet" */}
          {fair.busyScore > 0 && (
            <View style={styles.busyBadge}>
              <Text style={styles.busyText}>Busy {fair.busyScore}/10</Text>
            </View>
          )}

          <View style={styles.frequencyBadge}>
            <Text style={styles.frequencyText}>{fair.frequency}</Text>
          </View>
        </View>

        {/* CATEGORY CHIPS */}
        <View style={styles.categoryRow}>
          {fair.categories?.map((cat) => (
            <View key={cat} style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>{cat}</Text>
            </View>
          ))}
        </View>

        {/* DESCRIPTION */}
        {fair.description ? (
          <Text style={styles.description}>{fair.description}</Text>
        ) : null}

        {/* WHEN AND HOW MUCH (entered by whoever listed the fair) */}
        {fair.nextDate ? (
          <Text style={styles.nextDate}>Next date: {fair.nextDate}</Text>
        ) : null}

        {fair.entryFee || fair.stallFee ? (
          <View style={styles.statsRow}>
            <View style={styles.statsCard}>
              <Text style={styles.statsLabel}>Entry Fee</Text>
              <Text style={styles.statsValue}>{fair.entryFee || "-"}</Text>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.statsLabel}>Stall Fee</Text>
              <Text style={styles.statsValue}>{fair.stallFee || "-"}</Text>
            </View>
          </View>
        ) : null}

        {/* EVENT STATS (0 means no estimate, so the block is hidden) */}
        {fair.estimatedStalls > 0 || fair.estimatedVisitors > 0 ? (
          <View style={styles.statsRow}>
            <View style={styles.statsCard}>
              <Text style={styles.statsLabel}>Estimated Stalls</Text>
              <Text style={styles.statsValue}>{fair.estimatedStalls}</Text>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.statsLabel}>Estimated Visitors</Text>
              <Text style={styles.statsValue}>{fair.estimatedVisitors}</Text>
            </View>
          </View>
        ) : null}

        {/* PAYMENTS */}
        <View style={styles.paymentRow}>
          <View style={styles.paymentItem}>
            <Ionicons
              name="card"
              size={20}
              color={fair.acceptsCard ? "#FFD700" : "#555"}
            />
            <Text style={styles.paymentLabel}>Card</Text>
          </View>

          <View style={styles.paymentItem}>
            <Ionicons
              name="cash"
              size={20}
              color={fair.acceptsCash ? "#FFD700" : "#555"}
            />
            <Text style={styles.paymentLabel}>Cash</Text>
          </View>
        </View>

        {/* GOOD TO KNOW */}
        <Text style={styles.sectionTitle}>Good to Know</Text>
        <View style={styles.facilityGrid}>
          <Facility icon="car" label="Parking" enabled={fair.parking} />
          <Facility icon="restaurant" label="Food" enabled={fair.foodStalls} />
          <Facility icon="paw" label="Dogs" enabled={fair.dogFriendly} />
          <Facility icon="male-female" label="Toilets" enabled={fair.toilets} />
          <Facility icon="accessibility" label="Accessible" enabled={fair.wheelchairAccessible} />
          <Facility icon="cloud" label="Weather Safe" enabled={fair.weatherSafe} />
          <Facility icon="home" label="Indoor" enabled={fair.indoor} />
        </View>

        {/* ORGANISER CONTACT */}
        <Text style={styles.sectionTitle}>Organiser Contact</Text>
        <View style={styles.organiserCard}>
          {fair.displayEmailPublicly && fair.email && (
            <TouchableOpacity onPress={emailOrganiser}>
              <Text style={styles.contactLink}>{fair.email}</Text>
            </TouchableOpacity>
          )}

          {fair.phone && (
            <TouchableOpacity onPress={callOrganiser}>
              <Text style={styles.contactLink}>{fair.phone}</Text>
            </TouchableOpacity>
          )}

          {fair.website && (
            <TouchableOpacity onPress={openWebsite}>
              <Text style={styles.contactLink}>Website</Text>
            </TouchableOpacity>
          )}

          {fair.social?.facebook && (
            <TouchableOpacity onPress={() => Linking.openURL(fair.social?.facebook!)}>
              <Text style={styles.contactLink}>Facebook</Text>
            </TouchableOpacity>
          )}

          {fair.social?.instagram && (
            <TouchableOpacity onPress={() => Linking.openURL(fair.social?.instagram!)}>
              <Text style={styles.contactLink}>Instagram</Text>
            </TouchableOpacity>
          )}

          {fair.social?.twitter && (
            <TouchableOpacity onPress={() => Linking.openURL(fair.social?.twitter!)}>
              <Text style={styles.contactLink}>Twitter</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* BUTTONS */}
        <TouchableOpacity style={styles.buttonPrimary} onPress={openMaps}>
          <Ionicons name="navigate" size={20} color="white" />
          <Text style={styles.buttonPrimaryText}>Open in Google Maps</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        {/* LAST UPDATED */}
        <Text style={styles.lastUpdated}>
          Last updated: {new Date(fair.lastUpdated).toLocaleDateString()}
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

/* FACILITY COMPONENT */
function Facility({
  icon,
  label,
  enabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  enabled: boolean;
}) {
  return (
    <View style={[styles.facilityItem, enabled ? styles.facilityOn : styles.facilityOff]}>
      <Ionicons name={icon} size={18} color={enabled ? "#FFD700" : "#555"} />
      <Text style={[styles.facilityLabel, { color: enabled ? "#FFD700" : "#777" }]}>
        {label}
      </Text>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0F1F",
  },
  heroImage: {
    width: "100%",
    height: 200,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  title: {
    color: "white",
    fontSize: 28,
    fontWeight: "700",
    marginTop: 16,
    marginLeft: 20,
  },
  address: {
    color: "#AFC6FF",
    fontSize: 16,
    marginLeft: 20,
    marginBottom: 16,
  },

  center: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },

  panel: {
    backgroundColor: "rgba(20, 30, 60, 0.75)",
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.25)",
    marginHorizontal: 20,
    marginBottom: 40,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  featuredBadge: {
    backgroundColor: "rgba(255, 215, 0, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.5)",
  },
  featuredText: {
    color: "#FFD700",
    fontWeight: "700",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.4)",
  },
  verifiedText: {
    color: "#FFD700",
    fontWeight: "700",
  },
  hoursBadge: {
    backgroundColor: "rgba(30, 144, 255, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(30, 144, 255, 0.5)",
  },
  hoursText: {
    color: "#1e90ff",
    fontWeight: "600",
  },
  busyBadge: {
    backgroundColor: "rgba(255, 80, 80, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 80, 80, 0.5)",
  },
  busyText: {
    color: "#FF8080",
    fontWeight: "600",
  },
  frequencyBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  frequencyText: {
    color: "#fff",
    fontWeight: "600",
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#112240",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  categoryChipText: {
    color: "#FFD700",
    fontWeight: "700",
  },
  description: {
    color: "#D0D8FF",
    fontSize: 15,
    marginBottom: 16,
  },
  nextDate: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statsCard: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  statsLabel: {
    color: "#AFC6FF",
    fontSize: 14,
    marginBottom: 4,
  },
  statsValue: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  paymentItem: {
    alignItems: "center",
  },
  paymentLabel: {
    color: "#AFC6FF",
    marginTop: 4,
  },
  sectionTitle: {
    color: "#FFD700",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: 10,
  },
  facilityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  facilityItem: {
    width: "30%",
    padding: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  facilityOn: {
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.4)",
  },
  facilityOff: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  facilityLabel: {
    marginTop: 6,
    fontSize: 13,
  },
  organiserCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  contactLink: {
    color: "#1e90ff",
    fontSize: 15,
    marginTop: 4,
  },
  buttonPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e90ff",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  buttonPrimaryText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    marginTop: 6,
  },
  backButtonText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
  },
  lastUpdated: {
    color: "#AFC6FF",
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
  },
  errorText: {
    color: "white",
    fontSize: 20,
    textAlign: "center",
    marginBottom: 20,
  },
});
