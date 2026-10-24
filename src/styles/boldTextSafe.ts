/**
 * Text that has no font weight of its own is drawn by the phone's own text view, which on Android 12 and later
 * quietly uses a heavier font when the person has switched on "Bold text" (Samsung calls it "Bold font"), while React
 * Native measured the words with the normal one. When the text's box is only as wide as the words (a label next to
 * an icon, a centred message, a button's caption) the heavier letters no longer fit, the last letter drops onto a
 * second line that is cut off, and "Back" is drawn as "Bac" (found 24 Oct 2026 on a Samsung S22).
 *
 * Text WITH a weight is drawn with the font React Native chose, so measuring and drawing agree. Giving such a label
 * the normal weight, spelled out, changes nothing on screen at normal settings and stops the cut-off; the label then
 * ignores the Bold setting, which is a fair price for not losing letters. Use this on any short plain text whose box
 * is only as wide as its words. (The same job is done by a font weight already set in the style, by `flex: 1`, or by a
 * parent that stretches the text to the full width.)
 */
export const stableWeight = { fontWeight: "400" } as const;
