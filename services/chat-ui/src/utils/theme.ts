import type { ClientTheme } from "../config/client";

export function resolvePrimaryColor(theme: ClientTheme): string | undefined {
  const candidate = theme.primaryColor?.trim();
  if (!candidate) return undefined;

  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
    return candidate;
  }

  return CSS.supports("color", candidate) ? candidate : undefined;
}

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

const ON_PRIMARY_DARK_TEXT: RgbColor = { r: 17, g: 24, b: 39 }; // #111827
const ON_PRIMARY_LIGHT_TEXT: RgbColor = { r: 255, g: 255, b: 255 }; // #ffffff

function parseComputedRgb(value: string): RgbColor | null {
  const numbers = value.match(/[\d.]+/g);
  if (!numbers || numbers.length < 3) {
    return null;
  }
  const [r, g, b] = numbers.slice(0, 3).map((part) => Number(part));
  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return null;
  }
  return { r, g, b };
}

function resolveToRgb(color: string): RgbColor | null {
  if (typeof document === "undefined") {
    return null;
  }
  const element = document.createElement("span");
  element.style.color = color;
  element.style.display = "none";
  document.body?.appendChild(element);
  const computed = getComputedStyle(element).color;
  element.remove();
  return parseComputedRgb(computed);
}

function channelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function relativeLuminance(color: RgbColor): number {
  const r = channelToLinear(color.r);
  const g = channelToLinear(color.g);
  const b = channelToLinear(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(luminanceA: number, luminanceB: number): number {
  const [lighter, darker] = luminanceA >= luminanceB ? [luminanceA, luminanceB] : [luminanceB, luminanceA];
  return (lighter + 0.05) / (darker + 0.05);
}

export function resolveOnPrimaryColor(primaryColor?: string): string | undefined {
  if (!primaryColor) {
    return undefined;
  }
  const background = resolveToRgb(primaryColor);
  if (!background) {
    return undefined;
  }

  const backgroundLum = relativeLuminance(background);
  const darkContrast = contrastRatio(backgroundLum, relativeLuminance(ON_PRIMARY_DARK_TEXT));
  const lightContrast = contrastRatio(backgroundLum, relativeLuminance(ON_PRIMARY_LIGHT_TEXT));

  return lightContrast >= darkContrast ? "#ffffff" : "#111827";
}
