import React from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from "react-native";

/* ============================================================
   ⭐ AUTO FORMAT REG (AB12 CDE)
============================================================ */
export function autoFormatReg(input: string): string {
  const cleaned = input.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  if (cleaned.length <= 4) return cleaned;
  return cleaned.slice(0, 4) + " " + cleaned.slice(4, 7);
}

/* ============================================================
   ⭐ MOT STATUS BADGE
============================================================ */
export function getMotStatusColor(theme: any, expiry: string | null) {
  if (!expiry) return theme.muted;

  const today = new Date();
  const exp = new Date(expiry);

  if (exp < today) return theme.danger; // expired
  if ((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) < 30)
    return theme.accent; // due soon

  return theme.success; // pass
}

export function SuperBadge({
  label,
  theme,
  color,
}: {
  label: string;
  theme: any;
  color: string;
}) {
  return (
    <View
      style={{
        backgroundColor: color,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: theme.radius.md,
        alignSelf: "flex-start",
        marginTop: 6,
      }}
    >
      <Text
        style={{
          color: theme.black,
          fontWeight: "700",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/* ============================================================
   ⭐ PREMIUM DIVIDER
============================================================ */
export function SuperDivider({ theme }: { theme: any }) {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: theme.goldSoftGlow,
        marginVertical: theme.spacing.md,
      }}
    />
  );
}

/* ============================================================
   ⭐ SUPERNOVA CARD
============================================================ */
export function SuperCard({
  children,
  theme,
  title,
}: {
  children: React.ReactNode;
  theme: any;
  title: string;
}) {
  return (
    <View
      style={{
        marginBottom: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radius.xl,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
      }}
    >
      <Text
        style={{
          color: theme.text,
          fontSize: 16,
          fontWeight: "700",
          marginBottom: 10,
        }}
      >
        {title}
      </Text>

      {children}
    </View>
  );
}

/* ============================================================
   ⭐ SUPERNOVA INPUT
============================================================ */
export function SuperInput({
  label,
  theme,
  multiline,
  placeholder,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  theme: any;
  multiline?: boolean;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <Text
        style={{
          fontSize: 15,
          color: theme.text,
          marginBottom: 6,
        }}
      >
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        style={{
          backgroundColor: theme.card,
          padding: 14,
          borderRadius: theme.radius.md,
          borderWidth: 2,
          borderColor: theme.goldDeep,
          color: theme.text,
          minHeight: multiline ? 90 : undefined,
        }}
      />
    </View>
  );
}

/* ============================================================
   ⭐ SUPERNOVA BUTTON
============================================================ */
export function SuperButton({
  label,
  onPress,
  theme,
}: {
  label: string;
  onPress: () => void;
  theme: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        padding: 14,
        backgroundColor: theme.accent,
        borderRadius: theme.radius.md,
        marginBottom: theme.spacing.sm,
        alignItems: "center",
      }}
    >
      <Text style={{ color: theme.black, fontSize: 15 }}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ============================================================
   ⭐ GOLD GLOW BUTTON (Save Vehicle)
============================================================ */
export function SuperGlowButton({
  label,
  onPress,
  theme,
}: {
  label: string;
  onPress: () => void;
  theme: any;
}) {
  const scale = new Animated.Value(1);

  const pulse = () => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: theme.animation.pulse.small,
        duration: theme.animation.fast,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: theme.animation.fast,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
      }}
    >
      <TouchableOpacity
        onPress={() => {
          pulse();
          onPress();
        }}
        style={{
          paddingVertical: 16,
          borderRadius: theme.radius.xl,
          backgroundColor: theme.goldDeep,
          alignItems: "center",
          shadowColor: theme.goldHardGlow,
          shadowOpacity: 0.9,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        <Text
          style={{
            color: theme.black,
            fontSize: 18,
            fontWeight: "800",
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
