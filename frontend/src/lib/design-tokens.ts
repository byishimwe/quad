/**
 * Design Tokens for Quad Platform
 *
 * This file provides type-safe access to design tokens defined as CSS variables.
 * Tokens mirror the CSS variables used by Quad's components.
 *
 * Validates: Requirements 1.4, 13.1, 13.2, 13.3, 13.4, 13.5
 */

/**
 * Color tokens
 * All colors are defined in HSL format as CSS variables
 */
export const colors = {
  // Base colors
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",

  // Card colors
  card: "hsl(var(--card))",
  cardForeground: "hsl(var(--card-foreground))",

  // Popover colors
  popover: "hsl(var(--popover))",
  popoverForeground: "hsl(var(--popover-foreground))",

  // Primary colors
  primary: "hsl(var(--primary))",
  primaryForeground: "hsl(var(--primary-foreground))",

  // Secondary colors
  secondary: "hsl(var(--secondary))",
  secondaryForeground: "hsl(var(--secondary-foreground))",

  // Muted colors
  muted: "hsl(var(--muted))",
  mutedForeground: "hsl(var(--muted-foreground))",

  // Accent colors
  accent: "hsl(var(--accent))",
  accentForeground: "hsl(var(--accent-foreground))",

  // Destructive colors
  destructive: "hsl(var(--destructive))",
  destructiveForeground: "hsl(var(--destructive-foreground))",

  // Border and input colors
  border: "hsl(var(--border))",
  input: "hsl(var(--input))",
  ring: "hsl(var(--ring))",

  // Semantic colors
  success: "hsl(var(--success))",
  successForeground: "hsl(var(--success-foreground))",
  warning: "hsl(var(--warning))",
  warningForeground: "hsl(var(--warning-foreground))",
} as const;

/**
 * Spacing scale
 * Following a consistent scale: 0.25rem, 0.5rem, 1rem, 1.5rem, 2rem, 3rem, 4rem
 * Validates: Requirements 13.2
 */
export const spacing = {
  1: "0.25rem", // 4px
  2: "0.5rem", // 8px
  3: "0.75rem", // 12px
  4: "1rem", // 16px
  5: "1.25rem", // 20px
  6: "1.5rem", // 24px
  8: "2rem", // 32px
  10: "2.5rem", // 40px
  12: "3rem", // 48px
  16: "4rem", // 64px
  20: "5rem", // 80px
  24: "6rem", // 96px
} as const;

/**
 * Border radius tokens
 * Validates: Requirements 13.3
 */
export const borderRadius = {
  sm: "0.375rem", // 6px - small radius
  md: "0.5rem", // 8px - medium radius
  lg: "0.75rem", // 12px - large radius
  xl: "1rem", // 16px - extra large radius
  "2xl": "1.5rem", // 24px - 2x extra large radius
  full: "9999px", // Full circle/pill shape
} as const;

/**
 * Shadow tokens
 * Validates: Requirements 13.4
 */
export const shadows = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
  inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
  none: "none",
} as const;

/**
 * Typography tokens
 * Validates: Requirements 13.5
 */
export const typography = {
  fontFamily: {
    sans: [
      "Inter",
      "ui-sans-serif",
      "system-ui",
      "-apple-system",
      "sans-serif",
    ],
    mono: [
      "ui-monospace",
      "SFMono-Regular",
      "Menlo",
      "Monaco",
      "Consolas",
      "monospace",
    ],
  },
  fontSize: {
    xs: "0.75rem", // 12px
    sm: "0.875rem", // 14px
    base: "1rem", // 16px
    lg: "1.125rem", // 18px
    xl: "1.25rem", // 20px
    "2xl": "1.5rem", // 24px
    "3xl": "1.875rem", // 30px
    "4xl": "2.25rem", // 36px
    "5xl": "3rem", // 48px
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  lineHeight: {
    tight: "1.25",
    normal: "1.5",
    relaxed: "1.75",
  },
  letterSpacing: {
    tight: "-0.025em",
    normal: "0",
    wide: "0.025em",
  },
} as const;

/**
 * Z-index scale for consistent layering
 * Ensures proper stacking context throughout the application
 */
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  toast: 1070,
  tooltip: 1080,
} as const;

/**
 * Breakpoints for responsive design
 * Validates: Requirements 11.4
 */
export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

/**
 * Transition durations
 * All values in milliseconds
 */
export const transitionDuration = {
  fast: 150,
  normal: 200,
  slow: 300,
  slower: 500,
} as const;

/**
 * Transition timing functions
 */
export const transitionTiming = {
  easeOut: "cubic-bezier(0, 0, 0.2, 1)",
  easeIn: "cubic-bezier(0.4, 0, 1, 1)",
  easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
} as const;

/**
 * Touch target minimum size for mobile
 * Validates: Requirements 11.5
 */
export const touchTarget = {
  minSize: "44px",
  minSizePx: 44,
} as const;

/**
 * Container max widths
 */
export const containerMaxWidth = {
  narrow: "42rem", // 672px
  medium: "56rem", // 896px
  wide: "72rem", // 1152px
  full: "100%",
} as const;

/**
 * Helper function to get CSS variable value
 */
export const getCSSVariable = (variableName: string): string => {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();
};

/**
 * Helper function to set CSS variable value
 */
export const setCSSVariable = (variableName: string, value: string): void => {
  if (typeof window === "undefined") return;
  document.documentElement.style.setProperty(variableName, value);
};

/**
 * Type exports for TypeScript support
 */
export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof borderRadius;
export type ShadowToken = keyof typeof shadows;
export type FontSizeToken = keyof typeof typography.fontSize;
export type FontWeightToken = keyof typeof typography.fontWeight;
export type BreakpointToken = keyof typeof breakpoints;
export type ZIndexToken = keyof typeof zIndex;
