export const APP_NAME = 'Videomaker Log'

export const NAV_ITEMS = [
  { href: '/meetings', label: '회의록', icon: 'FileText' },
  { href: '/resources', label: '리소스', icon: 'MessageSquare' },
  { href: '/board', label: '보드', icon: 'Kanban' },
  { href: '/portfolio', label: '포트폴리오', icon: 'Film' },
] as const

export const BOARD_COLUMNS = [
  { id: 'todo' as const, label: '할 일' },
  { id: 'in_progress' as const, label: '진행 중' },
  { id: 'done' as const, label: '완료' },
]
