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
    bg: '', // Removed dynamic tailwind class
    text: 'text-white',
    border: 'border-white/20',
    indicator: '', // Removed dynamic tailwind class
    hex,
  }
}

export const getUserColor = (id: string = 'default', userColor?: any): UserColor => {
  // 인자로 들어온 userColor가 객체거나 배열인 경우를 위해 safe access
  let hex: string | null = null

  if (typeof userColor === 'string') {
    hex = userColor
  } else if (userColor && typeof userColor === 'object') {
    // 만약 배열로 들어왔다면 첫 번째 요소 사용
    const target = Array.isArray(userColor) ? userColor[0] : userColor
    hex = target?.user_color || target?.hex || null
  }

  if (hex && hex.startsWith('#')) {
    return colorFromHex(hex)
  }

  // 해시 기반 컬러 결정
  const colors = COLOR_OPTIONS.map((c) => c.hex)
  let hash = 0
  const stringId = String(id || 'default')
  for (let i = 0; i < stringId.length; i++) {
    hash = stringId.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % colors.length
  return colorFromHex(colors[index])
}
