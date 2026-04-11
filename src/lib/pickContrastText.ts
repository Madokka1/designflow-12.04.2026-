import type { CSSProperties } from 'react'

type Rgb = { r: number; g: number; b: number }

function srgbChannelToLinear(c: number): number {
  const x = c / 255
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * srgbChannelToLinear(rgb.r) +
    0.7152 * srgbChannelToLinear(rgb.g) +
    0.0722 * srgbChannelToLinear(rgb.b)
  )
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const L1 = relativeLuminance(a)
  const L2 = relativeLuminance(b)
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 }
/** Как в макете — почти чёрный текст на светлых заливках */
const INK_BLACK: Rgb = { r: 10, g: 10, b: 10 }

function bestContrastForeground(bg: Rgb): '#ffffff' | '#0a0a0a' {
  const onWhite = contrastRatio(bg, WHITE)
  const onBlack = contrastRatio(bg, INK_BLACK)
  return onWhite >= onBlack ? '#ffffff' : '#0a0a0a'
}

function formatHex(rgb: Rgb): string {
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`
}

/** Парсинг #RGB, #RRGGBB, #RRGGBBAA (альфа игнорируется). */
export function hexToRgb(hex: string): Rgb | null {
  const t = hex.trim()
  let m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(t)
  if (m) {
    return {
      r: Number.parseInt(m[1], 16),
      g: Number.parseInt(m[2], 16),
      b: Number.parseInt(m[3], 16),
    }
  }
  m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(t)
  if (m) {
    return {
      r: Number.parseInt(m[1], 16),
      g: Number.parseInt(m[2], 16),
      b: Number.parseInt(m[3], 16),
    }
  }
  m = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(t)
  if (m) {
    return {
      r: Number.parseInt(m[1] + m[1], 16),
      g: Number.parseInt(m[2] + m[2], 16),
      b: Number.parseInt(m[3] + m[3], 16),
    }
  }
  return null
}

/** Текст на заливке hex: белый или почти чёрный — по лучшему контрасту (WCAG luminance). */
export function pickContrastText(hex: string): '#ffffff' | '#0a0a0a' {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#ffffff'
  return bestContrastForeground(rgb)
}

/**
 * Стили для кнопок с акцентным фоном: при невалидном hex — токены fill-contrast темы,
 * чтобы не было «наследованного» текста того же цвета, что и фон.
 */
export function accentButtonStyle(accent: string): CSSProperties {
  const rgb = hexToRgb(accent)
  if (!rgb) {
    return {
      backgroundColor: 'var(--color-fill-contrast-bg)',
      color: 'var(--color-fill-contrast-fg)',
    }
  }
  return {
    backgroundColor: formatHex(rgb),
    color: bestContrastForeground(rgb),
  }
}
