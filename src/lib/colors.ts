export interface UserColor {
  bg: string
  text: string
  border: string
  indicator: string
  hex: string
}

export const COLOR_OPTIONS = [
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Fuchsia', hex: '#d946ef' },
  { name: 'Lime', hex: '#84cc16' },
  { name: 'Teal', hex: '#14b8a6' },
] as const

function colorFromHex(hex: string): UserColor {
  return {
    bg: `bg-[${hex}]`,
    text: 'text-white',
    border: 'border-white/20',
    indicator: `bg-[${hex}]`,
    hex,
  }
}

export const getUserColor = (id: string = 'default', userColor?: string | null): UserColor => {
  if (userColor) {
    return colorFromHex(userColor)
  }

  const colors = COLOR_OPTIONS.map((c) => c.hex)

  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % colors.length
  return colorFromHex(colors[index])
}
