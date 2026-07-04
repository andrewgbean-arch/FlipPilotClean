import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { BusinessAdvert } from "../lib/businessAdverts";

import ThemedText from "./ThemedText";
import ThemedView from "./ThemedView";
import { useTheme } from "../context/ThemeContext";
import { layout } from "../styles/layout";

const { radius: Radius, spacing: Spacing } = layout;

// ⭐ NEW TEXT VARIANTS
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
      <TouchableOpacity
        style={styles.card}
        onPress={openWebsite}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.9}
      >
        <ThemedView style={styles.badge}>
          <ThemedText style={[textVariants.small, styles.badgeText]}>
            Sponsored
          </ThemedText>
        </ThemedView>

        {advert.image && (
          <Image source={{ uri: advert.image }} style={styles.image} />
        )}

        <ThemedText style={textVariants.h3}>{advert.title}</ThemedText>

        {advert.tagline && (
          <ThemedText style={[textVariants.small, styles.tagline]}>
            {advert.tagline}
          </ThemedText>
        )}

        <ThemedText style={[textVariants.body, styles.subtitle]}>
          {advert.description}
        </ThemedText>

        {advert.rating && (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={18} color={theme.accent} />
            <ThemedText style={[textVariants.body, styles.ratingText]}>
              {advert.rating.toFixed(1)}
            </ThemedText>
          </View>
        )}

        <ThemedView style={styles.button}>
          <ThemedText style={[textVariants.h3, styles.buttonText]}>
            Visit Website →
          </ThemedText>
        </ThemedView>
      </TouchableOpacity>
    </Animated.View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
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
