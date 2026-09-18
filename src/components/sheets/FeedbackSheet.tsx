import React, { useEffect } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Text,
} from "react-native";

import { useTheme } from "@/styles/useTheme";
import { Feather } from "@expo/vector-icons";

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
  const silver = "#AAB4C3";

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
      />

      {/* Floating Sheet */}
      <Animated.View
        pointerEvents="auto"
        style={[
          styles.sheet,
          {
            backgroundColor: theme.card,
            borderColor: theme.goldDeep,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Title */}
        <Text style={[styles.title, { color: theme.goldDeep }]}>
          <Feather name="message-circle" size={22} color={theme.goldDeep} />{" "}
          Feedback / Ideas
        </Text>

        {/* Input */}
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.background,
              color: theme.text,
              borderColor: theme.goldDeep,
            },
          ]}
          placeholder="Tell us your idea..."
          placeholderTextColor={silver}
          value={feedbackText}
          onChangeText={setFeedbackText}
          multiline
        />

        {warning && (
          <Text style={{ color: "red", marginTop: 6 }}>
            Please enter something first
          </Text>
        )}

        {/* SEND BUTTON */}
        <Pressable
          style={[
            styles.button,
            {
              backgroundColor: theme.goldDeep,
              borderColor: theme.black,
            },
          ]}
          onPress={sendFeedback}
        >
          <Text style={[styles.buttonText, { color: theme.black }]}>Send</Text>
        </Pressable>

        {/* CANCEL BUTTON */}
        <Pressable
          style={[
            styles.cancelButton,
            {
              backgroundColor: theme.background,
              borderColor: theme.goldDeep,
            },
          ]}
          onPress={closeSheet}
        >
          <Text style={[styles.buttonText, { color: silver }]}>Cancel</Text>
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
    padding: 22,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    minHeight: 130,
    borderWidth: 2,
    borderRadius: 16,
    padding: 14,
    fontSize: 16,
  },
  button: {
    marginTop: 22,
    paddingVertical: 14,
    borderWidth: 2,
    borderRadius: 14,
    alignItems: "center",
  },
  cancelButton: {
    marginTop: 14,
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
