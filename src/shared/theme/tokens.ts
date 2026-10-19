// Design Tokens for spacing, borderRadius, and typography
export const borderRadius = {
  sm: 6,
  md: 10,
  btn: 11,
  chip: 20,
  lg: 14,
  xl: 18,
  card: 14,
  full: 9999,
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  screenPadding: 16,
} as const;

export const typography = {
  badge: 9,
  caption: 10,
  small: 11,
  bodySmall: 12,
  body: 13,
  base: 14,
  subheading: 15,
  heading: 16,
  title: 17,
  heroTitle: 18,
  largeTitle: 24,
} as const;

export default {
  borderRadius,
  spacing,
  typography,
};
