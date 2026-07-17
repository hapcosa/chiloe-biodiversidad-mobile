import type {Reino} from '../types/domain';

export const colors = {
  background: '#F5F1E8',
  surface: '#FFFFFF',
  primary: '#1F6F50',
  primaryDark: '#164B38',
  secondary: '#D99036',
  text: '#1D2A24',
  muted: '#66736D',
  border: '#D8D0C3',
  danger: '#B33A3A',
  success: '#2D7D46',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const reinoLabels: Record<Reino, string> = {
  animalia: 'Animalia',
  plantae: 'Plantae',
  fungi: 'Fungi',
  protista: 'Protista',
  monera: 'Monera',
};

export const reinoColors: Record<Reino, string> = {
  animalia: '#9B4A2E',
  plantae: '#2E7D32',
  fungi: '#7B4E8A',
  protista: '#2A7D8C',
  monera: '#6B6B2E',
};

