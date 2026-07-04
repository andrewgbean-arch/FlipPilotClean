import { useTheme } from "../context/ThemeContext";

import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type CalculationModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function CalculationModal({
  visible,
  onClose,
}: CalculationModalProps) {
  const theme = useTheme(); // ← FIXED

  const styles = getStyles(theme); // ← FIXED

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Calculator</Text>

          <Text style={styles.text}>Your calculation UI goes here.</Text>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    container: {
      width: "85%",
      backgroundColor: theme.card, // FIXED
      padding: 20,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.accent, // FIXED
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.accent, // FIXED
      marginBottom: 10,
      textAlign: "center",
    },
    text: {
      color: theme.text, // FIXED
      fontSize: 16,
      marginBottom: 20,
      textAlign: "center",
    },
    closeButton: {
      backgroundColor: theme.accent, // FIXED
      paddingVertical: 10,
      borderRadius: 8,
    },
    closeText: {
      color: theme.primary, // FIXED
      fontWeight: "700",
      textAlign: "center",
      fontSize: 16,
    },
  });
