// Tipografia fluida do design system (mesma fórmula do CRM): interpola de
// `minValue` px em 320px de viewport até `maxValue` px em 1512px.
export const calcClamp = (minValue: number, maxValue: number): string => {
  const diff = maxValue - minValue;
  const interval = 1512 - 320;

  const slope = diff / interval;
  const vw = slope * 100;

  const offset = minValue - (vw * 320) / 100;

  return `${minValue}px, ${vw}vw + ${offset}px, ${maxValue}px`;
};

// Atalho para `style={fs(12, 14)}`.
export const fs = (minValue: number, maxValue: number) => ({ fontSize: `clamp(${calcClamp(minValue, maxValue)})` });
