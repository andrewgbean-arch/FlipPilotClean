import { useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SpeakerHigh, SpeakerSlash, X } from "phosphor-react-native";

import { useTheme } from "@/styles/ThemeContext";
import { nextStep, prevStep, skipTour, toggleTourMute, useTourState } from "./TourContext";
import { TOUR_STEPS } from "./tourSteps";

/**
 * The one global spotlight: draws a gold ring around the real button the current tour step points
 * at, and shows a caption bubble with narration + controls.
 *
 * Deliberately NOT an SVG mask-with-a-cutout (tried first, found live to be unreliable on
 * Android — the "hole" wasn't visibly showing through, so nothing was actually highlighted).
 * No dimming at all (the owner wanted the pages left fully visible): just a gold ring around the
 * target's own rect, which is plain, predictable and the same on every device.
 *
 * v1: no animation yet (snaps straight to each target's rect) — this version exists to prove the
 * measurement pipeline works before reanimated transitions are layered on.
 */

const RING_PADDING = 8;
const RING_RADIUS = 14;
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
// Space kept between the highlight ring and the caption, and between the caption and the screen edge.
const CAPTION_GAP = 14;
const SCREEN_EDGE_GAP = 8;
// Only used until the caption has laid out once and told us its real height.
const CAPTION_HEIGHT_GUESS = 240;

export default function TourOverlay() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { active, stepIndex, muted, targetRect, waitingForTarget } = useTourState();
  // The caption's real height (its text wraps differently on every step), so it can be placed to
  // genuinely clear the highlighted button instead of relying on a guess.
  const [captionHeight, setCaptionHeight] = useState(CAPTION_HEIGHT_GUESS);

  if (!active) return null;

  const step = TOUR_STEPS[stepIndex];
  if (!step) return null;

  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const hole = !waitingForTarget && targetRect
    ? {
        x: targetRect.x - RING_PADDING,
        y: targetRect.y - RING_PADDING,
        width: targetRect.width + RING_PADDING * 2,
        height: targetRect.height + RING_PADDING * 2,
      }
    : null;

  // Keep the caption clear of the highlighted button: below it when it fits there, otherwise above
  // it. (Below first: the Scan screen's torch and zoom buttons sit at the top.) If neither side has
  // room for the whole caption (a very tall target), use the roomier side flush to the screen edge,
  // so it covers as little as possible rather than sitting in the middle of the target.
  const topLimit = insets.top + SCREEN_EDGE_GAP;
  const bottomLimit = SCREEN_HEIGHT - insets.bottom - SCREEN_EDGE_GAP;
  let captionTop = SCREEN_HEIGHT / 2 - captionHeight / 2;
  if (hole) {
    const roomBelow = bottomLimit - (hole.y + hole.height + CAPTION_GAP);
    const roomAbove = hole.y - CAPTION_GAP - topLimit;
    if (roomBelow >= captionHeight) captionTop = hole.y + hole.height + CAPTION_GAP;
    else if (roomAbove >= captionHeight) captionTop = hole.y - CAPTION_GAP - captionHeight;
    else captionTop = roomBelow >= roomAbove ? bottomLimit - captionHeight : topLimit;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={StyleSheet.absoluteFill} pointerEvents="auto">
        {/* No dimming: the page stays fully visible and the gold ring does the pointing. This whole
            layer is transparent but still catches touches, so a stray tap can't pull someone out
            of the tour into the app underneath. While the target is still being measured there is no
            ring at all, rather than a stale one. */}
        {hole ? (
          <View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                left: hole.x,
                top: hole.y,
                width: hole.width,
                height: hole.height,
                borderColor: theme.gold,
                shadowColor: theme.gold,
              },
            ]}
          />
        ) : null}

        <View
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            if (h > 0 && Math.abs(h - captionHeight) > 1) setCaptionHeight(h);
          }}
          style={[styles.caption, { backgroundColor: theme.card, borderColor: theme.gold, top: captionTop }]}
        >
          <View style={styles.captionTopRow}>
            <View style={styles.dots}>
              {TOUR_STEPS.map((s, i) => (
                <View
                  key={s.id}
                  style={[styles.dot, { backgroundColor: i === stepIndex ? theme.gold : theme.hairline }]}
                />
              ))}
            </View>
            <View style={styles.captionButtons}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={muted ? "Turn narration on" : "Turn narration off"}
                hitSlop={10}
                onPress={toggleTourMute}
                style={styles.iconButton}
              >
                {muted ? (
                  <SpeakerSlash size={18} color={theme.muted} />
                ) : (
                  <SpeakerHigh size={18} color={theme.gold} />
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Skip tour"
                hitSlop={10}
                onPress={skipTour}
                style={styles.iconButton}
              >
                <X size={18} color={theme.muted} />
              </Pressable>
            </View>
          </View>

          <Text style={[styles.title, { color: theme.text }]}>{step.title}</Text>
          <Text style={[styles.body, { color: theme.muted }]}>
            {waitingForTarget ? "One moment…" : step.body}
          </Text>

          <View style={styles.actionsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              disabled={stepIndex === 0}
              onPress={prevStep}
              style={[styles.secondaryButton, stepIndex === 0 && styles.disabled]}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Back</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isLast ? "Finish" : "Next"}
              onPress={nextStep}
              style={[styles.primaryButton, { backgroundColor: theme.gold }]}
            >
              <Text style={{ color: theme.black, fontWeight: "800", fontSize: 15 }}>
                {isLast ? "Finish" : "Next"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    borderWidth: 4,
    borderRadius: RING_RADIUS,
    backgroundColor: "transparent",
    // A soft glow so the ring still stands out on a bright page now there's no dimming behind it.
    shadowOpacity: 0.95,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  caption: {
    position: "absolute",
    left: 20,
    right: 20,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  captionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  captionButtons: { flexDirection: "row", gap: 14 },
  iconButton: { padding: 2 },
  title: { fontSize: 17, fontWeight: "800", marginBottom: 6 },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  actionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  secondaryButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  secondaryButtonText: { fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.35 },
  primaryButton: { paddingVertical: 10, paddingHorizontal: 22, borderRadius: 10 },
});
