import React from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import ThemedText from "@/src/styles/theme/ThemedText";

import { useTheme } from "@/src/context/ThemeContext";

interface FeedbackSheetProps {
  translateY: Animated.AnimatedInterpolation<string | number>;
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.overlay}
      pointerEvents="box-none"
    >
      {/* Tap outside to close */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={closeSheet}
        pointerEvents="auto"
      />

      {/* Sliding sheet */}
      <Animated.View
        pointerEvents="auto"
        style={[
          styles.sheet,
          {
            backgroundColor: theme.card,
            borderColor: theme.goldDeep,
            borderWidth: 3,
            transform: [{ translateY }],
          },
        ]}
      >
        <ThemedText style={[styles.title, { color: theme.accent }]}>
          Feedback / Ideas
        </ThemedText>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.background,
              color: theme.accent,
              borderColor: theme.goldDeep,
            },
          ]}
          placeholder="Tell us your idea..."
          placeholderTextColor="#999"
          value={feedbackText}
          onChangeText={setFeedbackText}
          multiline
        />

        {warning && (
          <ThemedText style={{ color: "red", marginTop: 6 }}>
            Please enter something first
          </ThemedText>
        )}

        {/* SEND BUTTON */}
        <Pressable
          style={[
            styles.button,
            { backgroundColor: theme.goldDeep, borderColor: theme.black },
          ]}
          onPress={sendFeedback}
        >
          <ThemedText style={styles.buttonText}>Send</ThemedText>
        </Pressable>

        {/* CANCEL BUTTON */}
        <Pressable
          style={[
            styles.cancelButton,
            { backgroundColor: theme.background, borderColor: theme.goldDeep },
          ]}
          onPress={closeSheet}
        >
          <ThemedText style={[styles.buttonText, { color: theme.accent }]}>
            Cancel
          </ThemedText>
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    width: "100%",
    padding: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 14,
    textAlign: "center",
  },
  input: {
    minHeight: 120,
    borderWidth: 2,
    borderRadius: 14,
    padding: 12,
    fontSize: 16,
  },
  button: {
    marginTop: 20,
    paddingVertical: 14,
    borderWidth: 2,
    borderRadius: 14,
    alignItems: "center",
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderWidth: 2,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "900",
  },
});

export default FeedbackSheet;
