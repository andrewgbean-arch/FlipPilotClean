import React, { useEffect, useRef } from "react";
import { View, Text, Animated } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

interface ListingQualityScoreProps {
  listing: {
    photos?: string[];
    description?: string;
    vehicle?: {
      make?: string;
      model?: string;
      year?: number;
      mileage?: number;
      engine?: string;
      fuel?: string;
    };
    price?: number;
  };
  prediction: {
    flipScore?: number;
  };
}

export default function ListingQualityScore({ listing, prediction }: ListingQualityScoreProps) {
  // Safe defaults
  const photos = listing?.photos ?? [];
  const description = listing?.description ?? "";
  const vehicle = listing?.vehicle ?? {};
  const price = listing?.price ?? 0;
  const flipScore = prediction?.flipScore ?? 0;

  let score = 50;

  // Photo quality
  const photoScore =
    photos.length >= 5 ? 15 :
    photos.length >= 3 ? 10 :
    photos.length >= 1 ? 5 : -10;
  score += photoScore;

  // Description quality
  const descScore =
    description.length > 200 ? 15 :
    description.length > 100 ? 10 :
    description.length > 40 ? 5 : -10;
  score += descScore;

  // Vehicle metadata completeness
  const requiredFields = ["make", "model", "year", "mileage", "engine", "fuel"] as const;
  const missing = requiredFields.filter((f) => !vehicle[f]);

  const metaScore =
    missing.length === 0 ? 10 :
    missing.length <= 2 ? 5 : -10;
  score += metaScore;

  // Price clarity
  const priceScore = price > 0 ? 5 : -10;
  score += priceScore;

  // FlipScore alignment
  const flipScoreBonus = flipScore >= 75 ? 5 : 0;
  score += flipScoreBonus;

  // Cap score
  score = Math.max(0, Math.min(100, score));

  // Main bar animation
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: score,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const barWidth = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  const getColor = () => {
    if (score >= 80) return "#4CAF50"; // green
    if (score >= 60) return "#FFD700"; // gold
    return "#FF5252"; // red
  };

  // Glow animation
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const glowSize = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 8],
  });

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.6],
  });

  // Holographic animation
  const holoAnim = useRef(new Animated.Value(0)).current;

  const getBadge = () => {
    if (score >= 95) {
      return {
        label: "Holographic Elite",
        color: "#FFFFFF",
        holographic: true,
        icon: (
          <MaterialCommunityIcons
            name="diamond-stone"
            size={18}
            color="#000"
          />
        ),
      };
    }

    if (score >= 80) {
      return {
        label: "Elite Listing",
        color: "#FFD700",
        holographic: false,
        icon: <Feather name="award" size={16} color="#000" />,
      };
    }

    if (score >= 60) {
      return {
        label: "Strong Listing",
        color: "#C0C0C0",
        holographic: false,
        icon: <MaterialCommunityIcons name="medal" size={16} color="#000" />,
      };
    }

    return {
      label: "Needs Improvement",
      color: "#CD7F32",
      holographic: false,
      icon: (
        <MaterialCommunityIcons
          name="shield-half-full"
          size={16}
          color="#000"
        />
      ),
    };
  };

  const badge = getBadge();

  useEffect(() => {
    if (badge.holographic) {
      Animated.loop(
        Animated.timing(holoAnim, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: false,
        })
      ).start();
    }
  }, [badge.holographic]);

  const holoGradient = holoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View
      style={{
        marginTop: 16,
        backgroundColor: "#111827",
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#FFD700",
      }}
    >
      <Text style={{ color: "#FFD700", fontSize: 20, fontWeight: "900", marginBottom: 10 }}>
        Listing Quality Score
      </Text>

      {/* Badge with glow + holographic */}
      <Animated.View
        style={{
          alignSelf: "flex-start",
          marginBottom: 12,
          padding: glowSize,
          borderRadius: 12,
          opacity: glowOpacity,
        }}
      >
        <Animated.View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 10,
            backgroundColor: badge.holographic ? "#ffffff" : badge.color,
            shadowColor: badge.holographic ? "#00eaff" : badge.color,
            shadowOpacity: badge.holographic ? 0.9 : 0.7,
            shadowRadius: badge.holographic ? 10 : 6,
            shadowOffset: { width: 0, height: 0 },
            transform: badge.holographic
              ? [{ rotate: holoGradient }]
              : [],
          }}
        >
          {badge.icon}
          <Text
            style={{
              color: "#000",
              fontWeight: "900",
              fontSize: 13,
            }}
          >
            {badge.label}
          </Text>
        </Animated.View>
      </Animated.View>

      {/* Animated Score Bar */}
      <View style={{ height: 12, backgroundColor: "#333", borderRadius: 8, overflow: "hidden" }}>
        <Animated.View
          style={{
            height: "100%",
            width: barWidth,
            backgroundColor: getColor(),
          }}
        />
      </View>

      <Text
        style={{
          color: getColor(),
          fontSize: 22,
          fontWeight: "bold",
          marginTop: 10,
        }}
      >
        {score}/100
      </Text>

      {/* Breakdown */}
      <View style={{ marginTop: 16 }}>
        <Text style={{ color: "#ccc", marginBottom: 6 }}>Breakdown:</Text>

        <Text style={{ color: photoScore >= 0 ? "#4CAF50" : "#FF5252" }}>
          • Photo Quality: {photoScore >= 0 ? "+" : ""}{photoScore}
        </Text>

        <Text style={{ color: descScore >= 0 ? "#4CAF50" : "#FF5252" }}>
          • Description Detail: {descScore >= 0 ? "+" : ""}{descScore}
        </Text>

        <Text style={{ color: metaScore >= 0 ? "#4CAF50" : "#FF5252" }}>
          • Metadata Completeness: {metaScore >= 0 ? "+" : ""}{metaScore}
        </Text>

        <Text style={{ color: priceScore >= 0 ? "#4CAF50" : "#FF5252" }}>
          • Price Clarity: {priceScore >= 0 ? "+" : ""}{priceScore}
        </Text>

        <Text style={{ color: flipScoreBonus >= 0 ? "#4CAF50" : "#ccc" }}>
          • FlipScore Bonus: {flipScoreBonus >= 0 ? "+" : ""}{flipScoreBonus}
        </Text>
      </View>
    </View>
  );
}
