export const colors = {
  background: '#0B0B0F',
  surface: '#16161D',
  surfaceElevated: '#1F1F29',
  border: '#2A2A36',
  textPrimary: '#F5F5F7',
  textSecondary: '#9A9AA8',
  textMuted: '#6B6B78',
  accent: '#7CC4FF',
  accentMuted: '#3A6F99',
  positive: '#7DDFA0',
  warn: '#F2C977',
  danger: '#F47C7C',
  overlay: 'rgba(0,0,0,0.6)',
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 22,
  xl: 32,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  title: { fontSize: 32, fontWeight: '700' as const },
  heading: { fontSize: 24, fontWeight: '600' as const },
  body: { fontSize: 17, fontWeight: '400' as const },
  label: { fontSize: 15, fontWeight: '500' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
} as const;
