import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
} from "react-native";

// ------------------------------------------------------
// TYPES
// ------------------------------------------------------
interface AIChatWindowProps {
  theme: any;
  visible: boolean;
  onClose: () => void;
  onSend: (msg: string) => Promise<string>;
}

interface ChatMessage {
  from: "user" | "ai";
  text: string;
}

// ------------------------------------------------------
// COMPONENT
// ------------------------------------------------------
export default function AIChatWindow({
  theme,
  visible,
  onClose,
  onSend,
}: AIChatWindowProps) {
  const slide = useRef(new Animated.Value(0)).current;
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<ScrollView | null>(null);

  // ------------------------------------------------------
  // OPEN / CLOSE ANIMATION
  // ------------------------------------------------------
  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: visible ? 300 : 250,
      useNativeDriver: false,
    }).start();
  }, [visible]);

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  // ------------------------------------------------------
  // SEND MESSAGE
  // ------------------------------------------------------
  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = { from: "user", text: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);

    const aiReply = await onSend(userMsg.text);
    const aiMsg: ChatMessage = { from: "ai", text: aiReply };

    setMessages((prev) => [...prev, aiMsg]);

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
  };

  // ------------------------------------------------------
  // RENDER
  // ------------------------------------------------------
  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderColor: theme.goldDeep,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.handle} />

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {messages.map((m, i) => (
          <View
            key={i}
            style={[
              styles.bubble,
              m.from === "user"
                ? { alignSelf: "flex-end", backgroundColor: theme.accent }
                : { alignSelf: "flex-start", backgroundColor: theme.secondary },
            ]}
          >
            <Text
              style={{
                color: m.from === "user" ? theme.black : theme.text,
                fontWeight: "600",
              }}
            >
              {m.text}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.background,
              color: theme.text,
              borderColor: theme.goldDeep,
            },
          ]}
          value={input}
          onChangeText={setInput}
          placeholder="Ask FlipPilot AI..."
          placeholderTextColor={theme.muted}
        />

        <Pressable
          onPress={sendMessage}
          style={[styles.sendBtn, { backgroundColor: theme.accent }]}
        >
          <Text style={{ color: theme.black, fontWeight: "900" }}>Send</Text>
        </Pressable>
      </View>

      <Pressable onPress={onClose} style={styles.closeBtn}>
        <Text style={{ color: "white", fontWeight: "900" }}>Close</Text>
      </Pressable>
    </Animated.View>
  );
}

// ------------------------------------------------------
// STYLES
// ------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: "70%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 3,
    paddingTop: 10,
  },
  handle: {
    width: 60,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignSelf: "center",
    marginBottom: 10,
  },
  messages: {
    flex: 1,
    paddingHorizontal: 16,
  },
  bubble: {
    padding: 12,
    borderRadius: 14,
    marginVertical: 6,
    maxWidth: "80%",
  },
  inputRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  input: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 10,
  },
  sendBtn: {
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 14,
  },
  closeBtn: {
    alignSelf: "center",
    marginBottom: 10,
  },
});
