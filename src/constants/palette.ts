export type AppPalette = {
  background: string;
  surface: string;
  field: string;
  text: string;
  textSecondary: string;
  accent: string;
  accentText: string;
  divider: string;
  error: string;
};

export const DarkPalette: AppPalette = {
  background: '#000000',
  surface: '#1C1C1E',
  field: '#2C2C2E',
  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  accent: '#32D74B',
  accentText: '#04210B',
  divider: '#3A3A3C',
  error: '#FF453A',
};

export const LightPalette: AppPalette = {
  background: '#F2F2F7',
  surface: '#FFFFFF',
  field: '#E5E5EA',
  text: '#000000',
  textSecondary: '#6C6C70',
  accent: '#248A3D',
  accentText: '#FFFFFF',
  divider: '#D1D1D6',
  error: '#FF3B30',
};
