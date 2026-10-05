import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SpeakerHigh, SpeakerSlash, X } from "phosphor-react-native";

import { useTheme } from "@/styles/ThemeContext";
import { nextStep, prevStep, skipTour, toggleTourMute, useTourState } from "./TourContext";
import { TOUR_STEPS } from "./tourSteps";

/**
 * The one global spotlight: dims everything EXCEPT the real button the current tour step points
 * at, draws a gold ring around it, and shows a caption bubble with narration + controls.
 *
 * Deliberately NOT an SVG mask-with-a-cutout (tried first, found live to be unreliable on
 * Android — the "hole" wasn't visibly showing through, so nothing was actually highlighted).
 * Four plain dimmed rectangles around the target, leaving the target's own area completely
 * untouched, is simpler and far more predictable across devices.
 *
 * v1: no animation yet (snaps straight to each target's rect) — this version exists to prove the
 * measurement pipeline works before reanimated transitions are layered on.
 */

const RING_PADDING = 8;
const RING_RADIUS = 14;
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const DIM_COLOR = "rgba(0,0,0,0.78)";

export default function TourOverlay() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { active, stepIndex, muted, targetRect, waitingForTarget } = useTourState();

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

  // Keep the caption clear of the hole: below it normally, above it if the target sits in the
  // bottom half of the screen, so the bubble never covers the very thing it's pointing at.
  const targetInBottomHalf = hole ? hole.y > SCREEN_HEIGHT / 2 : false;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={StyleSheet.absoluteFill} pointerEvents="auto">
        {hole ? (
          <>
            {/* TOP strip: full width, above the hole */}
            <View style={[styles.dim, { left: 0, right: 0, top: 0, height: Math.max(0, hole.y) }]} />
            {/* BOTTOM strip: full width, below the hole */}
            <View
              style={[
                styles.dim,
                { left: 0, right: 0, top: hole.y + hole.height, bottom: 0 },
              ]}
            />
            {/* LEFT strip: just the hole's own height, left of it */}
            <View
              style={[
                styles.dim,
                { left: 0, width: Math.max(0, hole.x), top: hole.y, height: hole.height },
              ]}
            />
            {/* RIGHT strip: just the hole's own height, right of it */}
            <View
              style={[
                styles.dim,
                { left: hole.x + hole.width, right: 0, top: hole.y, height: hole.height },
              ]}
            />
            {/* The ring itself — an outline, not a fill, so it never covers the real button */}
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
                },
              ]}
            />
          </>
        ) : (
          // Still waiting on a measurement: dim the whole screen rather than show a stale hole.
          <View style={[styles.dim, StyleSheet.absoluteFill]} />
        )}

        <View
          style={[
            styles.caption,
            { backgroundColor: theme.card, borderColor: theme.gold },
            hole
              ? targetInBottomHalf
                ? { top: Math.max(insets.top + 16, hole.y - 190) }
                : { top: Math.min(SCREEN_HEIGHT - insets.bottom - 220, hole.y + hole.height + 16) }
              : { top: SCREEN_HEIGHT / 2 - 90 },
          ]}
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
  dim: { position: "absolute", backgroundColor: DIM_COLOR },
  ring: {
    position: "absolute",
    borderWidth: 3,
    borderRadius: RING_RADIUS,
    backgroundColor: "transparent",
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
