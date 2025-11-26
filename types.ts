export type Theme = 'dark' | 'light';
export type ColorFormat = 'HSL' | 'HEX' | 'RGB';

export interface ViewState {
  x: number;
  y: number;
  scale: number;
  step: number; // Density/Tolerance (Gap between color values)
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export interface Dimensions {
  width: number;
  height: number;
}
