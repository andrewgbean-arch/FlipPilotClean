import { useTheme } from "../context/ThemeContext";

import { Modal, Text, TouchableOpacity, View } from "react-native";

type WarningModalProps = {
  visible: boolean;
  message: string;
  onClose: () => void;
};

export default function WarningModal({
  visible,
  message,
  onClose,
}: WarningModalProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: "85%",
            padding: 20,
            borderRadius: 12,
            backgroundColor: theme.card,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              marginBottom: 10,
              color: theme.accent,
            }}
          >
            Warning
          </Text>

          <Text
            style={{
              marginBottom: 20,
              color: theme.text,
            }}
          >
            {message}
          </Text>

          <TouchableOpacity
            onPress={onClose}
            style={{
              padding: 12,
              backgroundColor: theme.accent,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                textAlign: "center",
                fontWeight: "600",
                color: theme.black, // FIXED
              }}
            >
              OK
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
