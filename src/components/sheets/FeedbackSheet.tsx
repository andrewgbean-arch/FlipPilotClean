import React, { useEffect } from "react";
import GoldFoil from "@/components/ui/GoldFoil";
import {
  Animated,
  Pressable,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Text,
  View,
} from "react-native";

import { useTheme } from "@/styles/useTheme";

interface FeedbackSheetProps {
  translateY: Animated.Value;
  closeSheet: () => void;
  feedbackText: string;
  setFeedbackText: (t: string) => void;
  warning: boolean;
  sendFeedback: () => void;
}

const FeedbackSheet: React.FC<FeedbackSheetProps> = ({
  translateY,
  closeSheet,
  feedbackText,
  setFeedbackText,
  warning,
  sendFeedback,
}) => {
  const theme = useTheme();

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardWillShow", (e) => {
      Animated.timing(translateY, {
        toValue: -e.endCoordinates.height + 40,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });

    const hideSub = Keyboard.addListener("keyboardWillHide", () => {
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "position" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      style={styles.overlay}
      pointerEvents="box-none"
    >
      {/* Tap outside to close */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={closeSheet}
        pointerEvents="auto"
        accessibilityRole="button"
        accessibilityLabel="Close feedback"
      />

      {/* Sheet */}
      <Animated.View
        pointerEvents="auto"
        style={[
          styles.sheet,
          {
            backgroundColor: theme.card,
            borderColor: theme.hairline,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: theme.muted }]} />

        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
          Feedback and ideas
        </Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Tell us what would make FlipPilot better.
        </Text>

        {/* Input */}
        <Text style={[styles.label, { color: theme.muted }]}>Your feedback</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.background,
              color: theme.text,
              borderColor: theme.hairline,
            },
          ]}
          placeholder="Tell us your idea..."
          placeholderTextColor={theme.muted}
          accessibilityLabel="Your feedback"
          value={feedbackText}
          onChangeText={setFeedbackText}
          multiline
        />

        {warning && (
          <Text
            style={[styles.error, { color: theme.danger }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            Please enter something first
          </Text>
        )}

        {/* SEND BUTTON */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send feedback"
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.gold, overflow: "hidden" },
            pressed && styles.pressed,
          ]}
          onPress={sendFeedback}
        >
          <GoldFoil />
          <Text style={[styles.buttonText, { color: theme.black }]}>Send</Text>
        </Pressable>

        {/* CANCEL BUTTON */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel feedback"
          style={({ pressed }) => [
            styles.secondaryButton,
            { backgroundColor: theme.background, borderColor: theme.hairline },
            pressed && styles.pressed,
          ]}
          onPress={closeSheet}
        >
          <Text style={[styles.buttonText, { color: theme.text }]}>Cancel</Text>
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    width: "100%",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: "top",
  },
  error: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  primaryButton: {
    minHeight: 52,
    marginTop: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    minHeight: 52,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.75,
  },
});

export default FeedbackSheet;
