import { HSL, ColorFormat } from './types';

export const HSLToRGB = (h: number, s: number, l: number): [number, number, number] => {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
};

export const RGBToHex = (r: number, g: number, b: number): string => {
  return "#" + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("").toUpperCase();
};

export const HexToRGB = (hex: string): [number, number, number] | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : null;
};

export const RGBToHSL = (r: number, g: number, b: number): HSL => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
};

export const formatColor = (hsl: HSL, format: ColorFormat): string => {
  const { h, s, l } = hsl;
  if (format === 'HSL') {
    const fmt = (n: number) => Number.isInteger(n) ? n.toString() : n.toFixed(2);
    return `${fmt(h)}, ${fmt(s)}%, ${fmt(l)}%`;
  }
  const [r, g, b] = HSLToRGB(h, s, l);
  if (format === 'RGB') {
    return `${r}, ${g}, ${b}`;
  }
  return RGBToHex(r, g, b);
};

export const getContrastColor = (hsl: HSL): string => {
  let { h, s, l } = hsl;
  let newL = l > 50 ? l - 25 : l + 25;
  let newS = s > 50 ? s - 25 : s + 25;
  return `hsl(${h}, ${newS}%, ${newL}%)`;
};

// Ping Pong / Triangle Wave function for infinite grid
// Maps index 0..max..2max to 0..max..0
export const getPingPongValue = (index: number, max: number) => {
    if (max <= 0) return 0;
    const cycle = 2 * max;
    // Standard modulo for negative numbers handling
    let rem = index % cycle;
    if (rem < 0) rem += cycle;
    
    return rem > max ? cycle - rem : rem;
}

export const getBouncedValue = (value: number, max: number) => {
    const cycle = 2 * max;
    let rem = value % cycle;
    if (rem < 0) rem += cycle;
    return rem > max ? cycle - rem : rem;
};

export const describeArc = (x: number, y: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, outerRadius, endAngle);
    const end = polarToCartesian(x, y, outerRadius, startAngle);
    const start2 = polarToCartesian(x, y, innerRadius, endAngle);
    const end2 = polarToCartesian(x, y, innerRadius, startAngle);

    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    const d = [
        "M", start.x, start.y,
        "A", outerRadius, outerRadius, 0, largeArcFlag, 0, end.x, end.y,
        "L", end2.x, end2.y,
        "A", innerRadius, innerRadius, 0, largeArcFlag, 1, start2.x, start2.y,
        "Z"
    ].join(" ");

    return d;
}

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
}

export const cartesianToPolar = (x: number, y: number) => {
    // Math.atan2 returns angle in radians from -PI to PI
    // 0 is positive X axis (3 o'clock).
    // We want 0 to be Top (12 o'clock) for standard Hue wheels, or match the SVG coord system.
    // SVG: 0 deg is typically 3 o'clock in trig, but we usually rotate -90 to make it top.
    
    // In our describeArc, we used (angle - 90).
    // Let's stick to standard trig and adjust result.
    // atan2(y, x) -> 0 at East, PI/2 at South, -PI/2 at North.
    
    let rad = Math.atan2(y, x);
    let deg = rad * (180 / Math.PI); // -180 to 180
    
    // Rotate so -90 (North) becomes 0/360
    // North (-90) -> 0
    // East (0) -> 90
    // South (90) -> 180
    // West (180) -> 270
    
    deg += 90;
    if (deg < 0) deg += 360;
    
    return deg;
}