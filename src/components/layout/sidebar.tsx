'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { FileText, MessageSquare, Kanban, Film, LogOut, Moon, Sun, Users } from 'lucide-react'
import { useTheme } from 'next-themes'
import type { Profile } from '@/types'
import { getUserColor } from '@/lib/colors'

const navItems = [
  { href: '/meetings', label: '회의록', icon: FileText },
  { href: '/resources', label: '리소스', icon: MessageSquare },
  { href: '/board', label: '보드', icon: Kanban },
  { href: '/portfolio', label: '포트폴리오', icon: Film },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserColor, setCurrentUserColor] = useState<string | null>(null)
  const [members, setMembers] = useState<Profile[]>([])

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email ?? null)
        setCurrentUserId(user.id)
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, user_color')
            .eq('id', user.id)
            .single()
          if (profile) {
            setDisplayName(profile.display_name)
            setCurrentUserColor(profile.user_color)
          }
        } catch {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', user.id)
            .single()
          if (profile) setDisplayName(profile.display_name)
        }

        // 팀원 목록 로드
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: true })
        if (allProfiles) {
          setMembers(allProfiles)
        }
      }
    }
    loadUser()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : userEmail
      ? userEmail.slice(0, 2).toUpperCase()
      : '?'

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto border-r bg-sidebar p-4">
      <div className="mb-6">
        <Link href="/meetings">
          <h1 className="text-lg font-bold text-sidebar-foreground">Videomaker Log</h1>
        </Link>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* 팀원 목록 */}
      {members.length > 0 && (
        <>
          <Separator className="my-3" />
          <div className="mb-1 flex items-center gap-2 px-2">
            <Users className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              팀원 ({members.length})
            </span>
          </div>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {members.map((member) => {
              const isMe = member.id === currentUserId
              const userColor = getUserColor(member.id, member.user_color)
              const memberInitial = member.display_name.slice(0, 1).toUpperCase()
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5"
                >
                  <Avatar size="sm" className="size-5">
                    <AvatarFallback
                      className={cn("text-[10px] font-bold border !border-white/20", userColor.text)}
                      style={{ backgroundColor: userColor.hex }}
                    >
                      {memberInitial}
                    </AvatarFallback>
                  </Avatar>
                  <span className={cn(
                    'truncate text-xs',
                    isMe ? 'font-medium text-sidebar-foreground' : 'text-muted-foreground'
                  )}>
                    {member.display_name}
                    {isMe && ' (나)'}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <Separator className="my-3" />

      {/* 로그인 사용자 정보 - 클릭 시 내 정보 */}
      <Link href="/profile">
        <div className={cn(
          "mb-3 flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-sidebar-accent/50",
          pathname === '/profile' && 'bg-sidebar-accent'
        )}>
          <Avatar size="sm">
            <AvatarFallback
              className={cn("font-bold border !border-white/20", getUserColor(currentUserId || 'default', currentUserColor).text)}
              style={{ backgroundColor: getUserColor(currentUserId || 'default', currentUserColor).hex }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {displayName || '사용자'}
            </p>
            {userEmail && (
              <p className="truncate text-xs text-muted-foreground">
                {userEmail}
              </p>
            )}
          </div>
        </div>
      </Link>

      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === 'dark' ? '라이트 모드' : '다크 모드'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </Button>
      </div>
    </aside>
  )
}
