// Centralized Theme Colors
// EasyShoppingMallBD - Primary color #0092EE based on HTML design
export const colors = {
  // Primary brand colors
  primary: '#0092EE',
  primaryDark: '#0077C2',
  primaryLight: '#E5F4FD',
  primaryGradientStart: '#0092EE',
  primaryGradientEnd: '#0067B3',

  // Typography & UI neutral colors
  ink: '#12263A',        // Dark text
  muted: '#64748B',      // Secondary / muted text
  line: '#E3EAF1',       // Border line
  background: '#F7FAFC', // Screen background
  card: '#FFFFFF',       // Card / surface background

  // Badges & Actions
  accent: '#E5484D',      // Discount & badge red
  accentLight: '#FDECEF',
  success: '#10B981',
  warning: '#F59E0B',

  // Product & category pastel tint backgrounds from HTML
  tintBlue: '#E5F4FD',
  tintOrange: '#FFF1E0',
  tintGreen: '#EAF7EE',
  tintPurple: '#F3EBFB',
  tintPink: '#FDECEF',
  tintYellow: '#FEF9C3',
} as const;

export type AppColors = typeof colors;
export default colors;
