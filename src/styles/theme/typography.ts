// src/styles/theme/typography.ts
import { Colors } from "./colors";

export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: "700" as const,
    lineHeight: 38,
    color: Colors.white,
  },
  h2: {
    fontSize: 26,
    fontWeight: "600" as const,
    lineHeight: 32,
    color: Colors.white,
  },
  h3: {
    fontSize: 20,
    fontWeight: "600" as const,
    lineHeight: 26,
    color: Colors.white,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 22,
    color: Colors.muted,
  },
  small: {
    fontSize: 13,
    fontWeight: "400" as const,
    lineHeight: 18,
    color: Colors.muted,
  },
};
