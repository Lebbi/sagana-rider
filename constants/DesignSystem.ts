import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Base dimensions for responsive scaling
export const BASE_WIDTH = 375;
export const BASE_HEIGHT = 812;

// Responsive scaling functions
export const scale = (size: number) => (width / BASE_WIDTH) * size;
export const verticalScale = (size: number) => (height / BASE_HEIGHT) * size;

// Color Palette
export const Colors = {
  // Primary Colors
  primary: '#2c5938',
  primaryDark: '#1e4d2b',
  primaryLight: '#306238',
  
  // Secondary Colors
  secondary: '#FFD700',
  secondaryDark: '#e6c200',
  
  // Background Colors
  background: '#ffffff',
  backgroundLight: '#eaf3e6',
  backgroundWhite: '#ffffff',
  
  // Text Colors
  textPrimary: '#2c5938',
  textSecondary: '#555555',
  textLight: '#666666',
  textWhite: '#ffffff',
  
  // Status Colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  
  // Neutral Colors
  gray: '#888888',
  grayLight: '#cccccc',
  grayDark: '#333333',
  
  // Border Colors
  border: '#e0e0e0',
  borderLight: '#f0f0f0',
  
  // Shadow Colors
  shadow: '#000000',
  facebookBlue: '#1877F2',
};

// Typography
export const Typography = {
  // Font Sizes
  h1: scale(30),
  h2: scale(26),
  h3: scale(22),
  h4: scale(20),
  h5: scale(18),
  h6: scale(16),
  body: scale(16),
  small: scale(14),
  caption: scale(12),
  
  // Font Weights
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
  extraBold: '800' as const,
};

// Spacing
export const Spacing = {
  xs: scale(4),
  sm: scale(8),
  md: scale(12),
  lg: scale(16),
  xl: scale(20),
  xxl: scale(24),
  xxxl: scale(32),
};

// Border Radius
export const BorderRadius = {
  sm: scale(4),
  md: scale(8),
  lg: scale(12),
  xl: scale(16),
  xxl: scale(20),
  round: scale(50),
};

// Shadows
export const Shadows = {
  small: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  large: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};

// Common Component Styles
export const CommonStyles = {
  // Container Styles
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  
  // Card Styles
  card: {
    backgroundColor: Colors.backgroundWhite,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.medium,
  },
  cardSmall: {
    backgroundColor: Colors.backgroundWhite,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.small,
  },
  
  // Button Styles
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...Shadows.medium,
  },
  secondaryButton: {
    backgroundColor: Colors.secondary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...Shadows.medium,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  
  // Text Styles
  heading1: {
    fontSize: Typography.h1,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  heading2: {
    fontSize: Typography.h2,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  heading3: {
    fontSize: Typography.h3,
    fontWeight: Typography.semiBold,
    color: Colors.textPrimary,
  },
  bodyText: {
    fontSize: Typography.body,
    fontWeight: Typography.regular,
    color: Colors.textSecondary,
  },
  captionText: {
    fontSize: Typography.caption,
    fontWeight: Typography.regular,
    color: Colors.textLight,
  },
  
  // Input Styles
  input: {
    backgroundColor: Colors.backgroundWhite,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.body,
    color: Colors.textPrimary,
  },
  inputFocused: {
    borderColor: Colors.primary,
    ...Shadows.small,
  },
  
  // Navigation Styles
  navbar: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xxl,
    flexDirection: 'row' as const,
    justifyContent: 'space-around' as const,
    alignItems: 'center' as const,
    paddingHorizontal: Spacing.md,
    ...Shadows.large,
  },
  
  // Loading Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.background,
  },
  
  // Badge Styles
  badge: {
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};

// Layout Constants
export const Layout = {
  screenWidth: width,
  screenHeight: height,
  cardMargin: Spacing.sm,
  numColumns: 2,
  cardWidth: (width - Spacing.sm * 3) / 2,
  navbarHeight: verticalScale(60),
  headerHeight: verticalScale(80),
};

export default {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  CommonStyles,
  Layout,
  scale,
  verticalScale,
};
