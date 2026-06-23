import type { Inches } from "../types/model";

export function feetInches(inches: Inches, opts: { compact?: boolean } = {}): string {
  const sign = inches < 0 ? "-" : "";
  const total = Math.abs(inches);
  const feet = Math.floor(total / 12);
  const remInches = total - feet * 12;
  const rounded = Math.round(remInches * 10) / 10;
  if (opts.compact) {
    if (feet === 0) return `${sign}${rounded}"`;
    if (rounded === 0) return `${sign}${feet}'`;
    return `${sign}${feet}'${rounded}"`;
  }
  if (feet === 0) return `${sign}${rounded}"`;
  return `${sign}${feet}' ${rounded}"`;
}

export function parseFeetInches(input: string): Inches | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);
  const m = trimmed.match(/^(-?)(\d+(?:\.\d+)?)\s*(?:'|ft)?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in)?)?$/);
  if (!m) {
    const inOnly = trimmed.match(/^(-?)(\d+(?:\.\d+)?)\s*(?:"|in)$/);
    if (inOnly) return (inOnly[1] === "-" ? -1 : 1) * parseFloat(inOnly[2]);
    return null;
  }
  const sign = m[1] === "-" ? -1 : 1;
  const feet = parseFloat(m[2]);
  const inches = m[3] ? parseFloat(m[3]) : 0;
  return sign * (feet * 12 + inches);
}

export function sqftFromInches(widthIn: Inches, heightIn: Inches): number {
  return (widthIn * heightIn) / 144;
}

export function formatSqft(sqft: number): string {
  return `${sqft.toFixed(1)} sq ft`;
}
