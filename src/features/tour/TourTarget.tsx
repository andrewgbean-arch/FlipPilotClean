import { useEffect, useRef } from "react";
import { View, type LayoutChangeEvent } from "react-native";

import { registerTarget, unregisterTarget, notifyTargetLayout, type Rect } from "./TourContext";

/**
 * How a real screen tells the tour "this is the button step X points at" — wraps a button (or use
 * useTourTarget below to attach a ref directly, when an extra wrapping View would break a flex
 * layout). Registers on mount, measures on demand (the tour re-measures fresh window coordinates
 * each time it's needed, rather than trusting a layout snapshot that may be stale or wrong before
 * the screen has finished laying out).
 *
 * collapsable={false} is required on Android: without it, a plain View with no other props gets
 * flattened out of the native view tree, and measureInWindow silently stops working.
 */
function measureInWindowAsync(node: View | null): Promise<Rect | null> {
  return new Promise((resolve) => {
    if (!node) return resolve(null);
    node.measureInWindow((x, y, width, height) => {
      if (typeof x !== "number" || Number.isNaN(x)) resolve(null);
      else resolve({ x, y, width, height });
    });
  });
}

export function useTourTarget(id: string) {
  const ref = useRef<View>(null);

  useEffect(() => {
    registerTarget(id, () => measureInWindowAsync(ref.current), ref.current);
    return () => unregisterTarget(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onLayout = (_e: LayoutChangeEvent) => notifyTargetLayout(id);

  return { ref, onLayout };
}

export function TourTarget({
  id,
  children,
  style,
}: {
  id: string;
  children: React.ReactNode;
  /** Needed whenever the wrapped child relies on ITS parent for sizing (a percentage width in a
   *  flex row, say) — this extra wrapping layer becomes that parent, so it must carry the same
   *  sizing or the child's own percentage-based style starts measuring against the wrong box. */
  style?: import("react-native").StyleProp<import("react-native").ViewStyle>;
}) {
  const { ref, onLayout } = useTourTarget(id);
  return (
    <View ref={ref} collapsable={false} onLayout={onLayout} style={style}>
      {children}
    </View>
  );
}
