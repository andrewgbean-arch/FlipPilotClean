import type { EmotionName, EmotionState } from "../api/types";

/**
 * Each emotion keeps one fixed hue everywhere (colour follows the entity, never its rank).
 * Hues come from the categorical data-viz palette (see --viz-* in styles.css); labels are
 * always rendered next to the colour so identity never relies on colour alone.
 */
export const EMOTIONS: { name: EmotionName; label: string; color: string }[] = [
  { name: "happy", label: "Happy", color: "var(--viz-yellow)" },
  { name: "curious", label: "Curious", color: "var(--viz-blue)" },
  { name: "focused", label: "Focused", color: "var(--viz-violet)" },
  { name: "relaxed", label: "Relaxed", color: "var(--viz-aqua)" },
  { name: "excited", label: "Excited", color: "var(--viz-orange)" },
  { name: "concerned", label: "Concerned", color: "var(--viz-red)" },
  { name: "reflective", label: "Reflective", color: "var(--viz-magenta)" },
  { name: "motivated", label: "Motivated", color: "var(--viz-green)" },
];

export function emotionColor(name: string): string {
  return EMOTIONS.find((e) => e.name === name.toLowerCase())?.color ?? "var(--accent)";
}

export function topEmotions(state: Partial<EmotionState> | undefined, n = 3) {
  if (!state) return [];
  return EMOTIONS.map((e) => ({ ...e, value: Number(state[e.name] ?? 0) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}
