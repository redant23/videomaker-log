export const getUserColor = (id: string = 'default') => {
  const colors = [
    { bg: 'bg-indigo-300', indicator: 'bg-indigo-300' },
    { bg: 'bg-emerald-300', indicator: 'bg-emerald-300' },
    { bg: 'bg-rose-300', indicator: 'bg-rose-300' },
    { bg: 'bg-amber-300', indicator: 'bg-amber-300' },
    { bg: 'bg-violet-300', indicator: 'bg-violet-300' },
    { bg: 'bg-cyan-300', indicator: 'bg-cyan-300' },
    { bg: 'bg-pink-300', indicator: 'bg-pink-300' },
    { bg: 'bg-orange-300', indicator: 'bg-orange-300' },
    { bg: 'bg-blue-300', indicator: 'bg-blue-300' },
  ]

  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % colors.length
  return colors[index]
}
