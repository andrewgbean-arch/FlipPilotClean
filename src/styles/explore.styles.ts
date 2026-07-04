import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#0A1128",
  },

  title: {
    fontSize: 38,
    fontWeight: "900",
    color: "#FFD700",
  },

  subtitle: {
    color: "#DDE6F7",
    fontSize: 20,
    marginBottom: 20,
  },

  search: {
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 14,
    borderRadius: 14,
    fontSize: 18,
    color: "#FFFFFF",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },

  section: {
    marginBottom: 30,
  },

  sectionTitle: {
    color: "#FFD700",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 12,
  },

  // ⭐ LIGHT CARD
  cardLight: {
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 20,
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },

  // ⭐ DARK PREMIUM CARD
  cardDark: {
    backgroundColor: "rgba(255, 215, 0, 0.05)",
    padding: 20,
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FFD700",
  },

  cardTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },

  cardTitleDark: {
    color: "#FFD700",
    fontSize: 22,
    fontWeight: "900",
  },

  cardText: {
    color: "#DDE6F7",
    marginTop: 6,
    fontSize: 18,
  },

  cardTextDark: {
    color: "#DDE6F7",
    marginTop: 6,
    fontSize: 18,
  },

  empty: {
    color: "#7A8BAA",
    fontSize: 18,
    textAlign: "center",
    marginTop: 40,
  },

  // ⭐ MODAL OVERLAY
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },

 modalBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
},


  modalBox: {
    width: "88%",
    maxHeight: "75%",
    backgroundColor: "#0A1128",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#FFD700",
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFD700",
    marginBottom: 10,
  },

  modalContent: {
    maxHeight: "65%",
    marginBottom: 20,
  },

  modalText: {
    color: "#DDE6F7",
    fontSize: 16,
    lineHeight: 22,
  },

  modalClose: {
    backgroundColor: "#FFD700",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  modalCloseText: {
    color: "#0A1128",
    fontSize: 16,
    fontWeight: "700",
  },

  // ⭐ NEW SUPER‑PREMIUM STYLES BELOW ⭐

  // Glow border for premium cards
  glowCard: {
    shadowColor: "#FFD700",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },

  // Pro badge
  proBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#FFD700",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },

  proBadgeText: {
    color: "#0A1128",
    fontWeight: "900",
    fontSize: 12,
  },

  // Supernova highlight
  supernova: {
    borderColor: "#FF6B00",
    shadowColor: "#FF6B00",
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },

  // Category divider
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginVertical: 10,
  },

  // AI suggestion highlight
  aiGlow: {
    borderColor: "#00C6FF",
    shadowColor: "#00C6FF",
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
});
