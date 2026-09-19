import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Animated,
  Dimensions,
  StyleSheet,
  Image,
  TouchableOpacity,
} from "react-native";

import HeroHeader from "@/components/ui/HeroHeader";
import GlowPulseCard from "@/components/ui/GlowPulseCard";
import FlipPilotAssistantSheet from "@/components/sheets/FlipPilotAssistantSheet";

import SellerProfileCard from "@/features/seller/SellerProfileCard";
import ConfidenceMeter from "@/components/analytics/ConfidenceMeter";
import OfferCalculator from "@/components/core/OfferCalculator";
import BuyerSafetyScore from "@/components/core/BuyerSafetyScore";
import SellerBadges from "@/components/core/SellerBadges";
import ValuationEngine from "@/components/ai/ValuationEngine";

import ListingQualityScore from "@/components/marketplace/ListingQualityScore";
import PhotoAnalyzer from "@/components/ai/PhotoAnalyzer";
import CarHistoryChecker from "@/components/motors/CarHistoryChecker";
import MileageRiskScore from "@/components/motors/MileageRiskScore";

import DepreciationCurve from "@/components/DepreciationCurve";
import DealProbabilityAI from "@/components/core/DealProbabilityAI";
import PriceDropPredictor from "@/components/marketplace/PriceDropPredictor";
import MarketHeatIndex from "@/components/analytics/MarketHeatIndex";
import NegotiationAI from "@/components/ai/NegotiationAI";
import FlipDifficultyScore from "@/components/core/FlipDifficultyScore";

import { calculateFlipScore } from "@/utils/flipScorePredictor";

import { BASE_URL } from "@/utils/api";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const FP_BLUE = "#0A1128";
const GOLD = "#FFD700";
const MUTED = "#E5ECFF";

export default function ListingDetails() {
  const { id } = useLocalSearchParams();
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPro, setShowPro] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // ⭐ AI Assistant bottom sheet
  const [showAI, setShowAI] = useState(false);
  const aiTranslateY = useRef(new Animated.Value(500)).current;

  const openAISheet = () => {
    setShowAI(true);
    Animated.timing(aiTranslateY, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeAISheet = () => {
    Animated.timing(aiTranslateY, {
      toValue: 500,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowAI(false));
  };

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
      .then((res) => res.json())
      .then((data) => {
        setListing(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <Text style={styles.loading}>Loading...</Text>;
  if (!listing) return <Text style={styles.loading}>Listing not found</Text>;

  const prediction = calculateFlipScore(listing);

  const dealHeat =
    prediction.flipScore >= 85
      ? "🔥 Hot"
      : prediction.flipScore >= 70
      ? "Warm"
      : "Cold";

  const listingName = listing.vehicle
    ? `${listing.vehicle.year ?? ""} ${listing.vehicle.make ?? ""} ${listing.vehicle.model ?? ""}`.trim()
    : listing.title ?? "This listing";

  const aiSummary = `${listingName} shows a ${dealHeat.toLowerCase()} deal profile with estimated profit of around £${prediction.profitEstimate} and a FlipScore of ${prediction.flipScore}/100.`;

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
      {/* ⭐ Ask AI Button */}
      <TouchableOpacity onPress={openAISheet} style={styles.askAIButton}>
        <Text style={styles.askAIText}>💬 Ask AI</Text>
      </TouchableOpacity>

      {showAI && (
        <FlipPilotAssistantSheet
          isOpen={showAI}
          translateY={aiTranslateY}
          closeSheet={closeAISheet}
        />
      )}

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

          {/* ⭐ Deal Heat */}
          <View
            style={[
              styles.dealHeatBadge,
              {
                backgroundColor:
                  dealHeat === "🔥 Hot"
                    ? "#FF5252"
                    : dealHeat === "Warm"
                    ? GOLD
                    : "#555",
              },
            ]}
          >
            <Text style={styles.dealHeatText}>{dealHeat}</Text>
          </View>

          {/* ⭐ AI Summary */}
          <GlowPulseCard style={{ marginTop: 20 }}>
            <Text style={styles.sectionTitle}>FlipPilot AI Summary</Text>
            <Text style={styles.sectionText}>{aiSummary}</Text>
          </GlowPulseCard>

          {/* ⭐ Core Intelligence */}
          <GlowPulseCard style={{ marginTop: 24 }}>
            <Text style={styles.sectionTitle}>Core FlipPilot Intelligence</Text>

            <ConfidenceMeter score={prediction.flipScore} />
            <ValuationEngine listing={listing} prediction={prediction} />
            <BuyerSafetyScore listing={listing} prediction={prediction} />
            <SellerProfileCard seller={listing.seller} />
            <SellerBadges seller={listing.seller} />
            <OfferCalculator listing={listing} prediction={prediction} />
            <NegotiationAI listing={listing} prediction={prediction} />
          </GlowPulseCard>

          {/* ⭐ Pro Mode Toggle */}
          <TouchableOpacity
            onPress={() => setShowPro(!showPro)}
            style={styles.proToggle}
          >
            <Text style={styles.proToggleText}>
              {showPro ? "Hide Full Analysis" : "View Full Analysis (Pro Mode)"}
            </Text>
          </TouchableOpacity>

          {/* ⭐ Pro Mode */}
          {showPro && (
            <GlowPulseCard style={{ marginTop: 20 }}>
              <Text style={styles.sectionTitle}>FlipPilot Pro Analysis</Text>

              <ListingQualityScore listing={listing} prediction={prediction} />

              <PhotoAnalyzer listing={listing} />

              <CarHistoryChecker listing={listing} />

              <MileageRiskScore listing={listing} />

              <DealProbabilityAI listing={listing} prediction={prediction} />

              <PriceDropPredictor listing={listing} prediction={prediction} />

              <MarketHeatIndex />

              <DepreciationCurve listing={listing} prediction={prediction} />

              <FlipDifficultyScore listing={listing} prediction={prediction} />
            </GlowPulseCard>
          )}
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

  askAIButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: GOLD,
    padding: 16,
    borderRadius: 999,
    zIndex: 50,
    shadowColor: GOLD,
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  askAIText: {
    fontWeight: "bold",
    color: FP_BLUE,
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

  dealHeatBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 20,
  },
  dealHeatText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },

  sectionTitle: {
    color: GOLD,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  sectionText: {
    color: MUTED,
    fontSize: 14,
  },

  proToggle: {
    backgroundColor: GOLD,
    padding: 12,
    borderRadius: 10,
    marginTop: 20,
    alignItems: "center",
    shadowColor: GOLD,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  proToggleText: {
    fontWeight: "bold",
    fontSize: 16,
    color: FP_BLUE,
  },
});

