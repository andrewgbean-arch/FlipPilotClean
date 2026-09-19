import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Heart } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import FlipCard from "@/components/FlipCard";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useTheme } from "@/styles/ThemeContext";

export default function FavouritesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { vehicles, deleteVehicle, toggleFavourite, loaded, loadError } = useVehicleHistory();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const favourites = useMemo(() => {
    return [...vehicles]
      .filter((v) => v.favourite)
      .sort((a, b) => Number(new Date(b.timestamp)) - Number(new Date(a.timestamp)));
  }, [vehicles]);

  const handleDelete = (id: string) => {
    deleteVehicle(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleUnsave = (id: string) => {
    toggleFavourite(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Scanned items open the flip details; records from the vehicle flows carry a
  // registration and keep their own vehicle screen.
  const openDetails = (item: FlipRecord) => {
    router.push(item.mot?.reg ? `/vehicles/details/${item.id}` : `/flip/${item.id}`);
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 16 }]}
    >
      <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
        Favourites
      </Text>

      {favourites.length === 0 ? (
        // Nothing until the saved flips have been read, so this never flashes
        // up while loading (or for a list that couldn't be read).
        loaded ? (
          <View style={styles.emptyBox}>
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: theme.card, borderColor: theme.goldSoftGlow },
              ]}
            >
              <Heart size={30} color={theme.gold} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {loadError ? "Couldn't load your flips" : "No favourites yet"}
            </Text>
            <Text style={[styles.emptyBody, { color: theme.muted }]}>
              {loadError ?? "Tap the heart on a flip in History and it will show up here."}
            </Text>
          </View>
        ) : null
      ) : (
        <FlatList
          data={favourites}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FlipCard
              item={item}
              onOpen={() => openDetails(item)}
              onToggleFavourite={() => handleUnsave(item.id)}
              onDelete={() => setConfirmId(item.id)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Modal
        visible={confirmId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmId(null)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: theme.card, borderColor: HAIRLINE }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Delete this flip?</Text>
            <Text style={[styles.modalText, { color: theme.muted }]}>
              It will be removed from your History too. This can't be undone.
            </Text>

            <View style={styles.modalButtons}>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.modalButton,
                  { backgroundColor: theme.background },
                  pressed && styles.pressed,
                ]}
                onPress={() => setConfirmId(null)}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.modalButton,
                  { backgroundColor: theme.danger },
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  if (confirmId) handleDelete(confirmId);
                  setConfirmId(null);
                }}
              >
                <Text style={[styles.modalButtonText, { color: theme.white }]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const HAIRLINE = "rgba(255, 255, 255, 0.08)";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 32,
  },
  separator: {
    height: 12,
  },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modal: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  modalText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.75,
  },
});
