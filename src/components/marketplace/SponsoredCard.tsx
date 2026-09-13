import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
} from "react-native";

import { BusinessAdvert } from "../../lib/businessAdverts";
import { useTheme } from "@/styles/ThemeContext";

import { layout } from "../../styles/layout";

const { radius: Radius, spacing: Spacing } = layout;

const textVariants = StyleSheet.create({
  h3: { fontSize: 20, fontWeight: "900" },
  body: { fontSize: 16 },
  small: { fontSize: 13, opacity: 0.75 },
});

export default function SponsoredCard({ advert }: { advert: BusinessAdvert }) {
  const theme = useTheme();
  const styles = getStyles(theme);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const openWebsite = () => {
    if (advert.website) Linking.openURL(advert.website);
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: false,
          }),
        ])
      ),
    ]).start();
  }, []);

  const onPressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
      }}
    >
      <Animated.View
        style={[
          styles.glowWrapper,
          {
            shadowOpacity: glowAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.15, 0.45],
            }),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.card}
          onPress={openWebsite}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          activeOpacity={0.9}
        >
          {/* Sponsored badge */}
          <View style={styles.badge}>
            <Text style={[textVariants.small, styles.badgeText]}>
              Sponsored
            </Text>
          </View>

          {/* Image */}
          {advert.image && (
            <Image source={{ uri: advert.image }} style={styles.image} />
          )}

          {/* Title */}
          <Text style={[textVariants.h3, styles.title]}>
            {advert.title}
          </Text>

          {/* Tagline */}
          {advert.tagline && (
            <Text style={[textVariants.small, styles.tagline]}>
              {advert.tagline}
            </Text>
          )}

          {/* Description */}
          <Text style={[textVariants.body, styles.subtitle]}>
            {advert.description}
          </Text>

          {/* Rating */}
          {advert.rating && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={18} color={theme.accent} />
              <Text style={[textVariants.body, styles.ratingText]}>
                {advert.rating.toFixed(1)}
              </Text>
            </View>
          )}

          {/* CTA Button */}
          <View style={styles.button}>
            <Text style={[textVariants.h3, styles.buttonText]}>
              Visit Website →
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    glowWrapper: {
      shadowColor: theme.accent,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 0 },
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: theme.accent,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    badge: {
      backgroundColor: theme.accent,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.md,
      alignSelf: "flex-start",
      marginBottom: Spacing.md,
    },
    badgeText: {
      color: theme.black,
      fontWeight: "900",
    },
    image: {
      width: "100%",
      height: 160,
      borderRadius: Radius.md,
      marginBottom: Spacing.md,
    },
    title: {
      color: theme.text,
      marginBottom: Spacing.xs,
    },
    tagline: {
      color: theme.accent,
      marginBottom: Spacing.sm,
      fontWeight: "700",
    },
    subtitle: {
      color: theme.text,
      marginBottom: Spacing.md,
    },
    ratingRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: Spacing.md,
      gap: Spacing.xs,
    },
    ratingText: {
      color: theme.accent,
      fontWeight: "700",
    },
    button: {
      backgroundColor: theme.accent,
      paddingVertical: Spacing.md,
      borderRadius: Radius.md,
      alignItems: "center",
      marginTop: Spacing.xs,
    },
    buttonText: {
      color: theme.black,
      fontWeight: "800",
    },
  });
