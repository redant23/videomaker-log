export interface UserColor {
  bg: string
  text: string
  border: string
  indicator: string
}

export const getUserColor = (id: string = 'default'): UserColor => {
  const colors: UserColor[] = [
    { bg: 'bg-[#6366f1]', text: 'text-white', border: 'border-white/20', indicator: 'bg-[#6366f1]' }, // Indigo
    { bg: 'bg-[#10b981]', text: 'text-white', border: 'border-white/20', indicator: 'bg-[#10b981]' }, // Emerald
    { bg: 'bg-[#f43f5e]', text: 'text-white', border: 'border-white/20', indicator: 'bg-[#f43f5e]' }, // Rose
    { bg: 'bg-[#f59e0b]', text: 'text-white', border: 'border-white/20', indicator: 'bg-[#f59e0b]' }, // Amber
    { bg: 'bg-[#8b5cf6]', text: 'text-white', border: 'border-white/20', indicator: 'bg-[#8b5cf6]' }, // Violet
    { bg: 'bg-[#06b6d4]', text: 'text-white', border: 'border-white/20', indicator: 'bg-[#06b6d4]' }, // Cyan
    { bg: 'bg-[#ec4899]', text: 'text-white', border: 'border-white/20', indicator: 'bg-[#ec4899]' }, // Pink
    { bg: 'bg-[#f97316]', text: 'text-white', border: 'border-white/20', indicator: 'bg-[#f97316]' }, // Orange
    { bg: 'bg-[#3b82f6]', text: 'text-white', border: 'border-white/20', indicator: 'bg-[#3b82f6]' }, // Blue
    { bg: 'bg-[#d946ef]', text: 'text-white', border: 'border-white/20', indicator: 'bg-[#d946ef]' }, // Fuchsia
    { bg: 'bg-[#84cc16]', text: 'text-white', border: 'border-white/20', indicator: 'bg-[#84cc16]' }, // Lime
    { bg: 'bg-[#14b8a6]', text: 'text-white', border: 'border-white/20', indicator: 'bg-[#14b8a6]' }, // Teal
  ]

  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % colors.length
  return colors[index]
}
