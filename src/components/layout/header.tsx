'use client'

import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/meetings': '회의록',
  '/resources': '리소스',
  '/board': '보드',
  '/portfolio': '포트폴리오',
}

export function Header() {
  const pathname = usePathname()
  const baseRoute = '/' + (pathname.split('/')[1] || '')
  const title = pageTitles[baseRoute] || ''

  return (
    <header className="flex h-14 items-center border-b px-6">
      <h2 className="text-lg font-semibold">{title}</h2>
    </header>
  )
}
