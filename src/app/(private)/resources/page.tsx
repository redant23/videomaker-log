'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { format, startOfWeek, getWeek } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import { Send, Trash2, ExternalLink, MessageSquare, ChevronDown, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { getMessages, getArchivedMessages, createMessage, deleteMessage } from '@/actions/resources'
import type { Resource, Profile } from '@/types'
import { getUserColor } from '@/lib/colors'
import { extractUrls, isImageUrl } from '@/lib/url-utils'
import { extractMentions } from '@/lib/mention-utils'
import { OgPreviewCard } from '@/components/og-preview-card'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

function groupByWeek(messages: Resource[]) {
  const groups: Record<string, Resource[]> = {}
  messages.forEach((msg) => {
    const date = new Date(msg.created_at)
    const weekNum = getWeek(date, { weekStartsOn: 1 })
    const year = date.getFullYear()
    const key = `${year}년 ${date.getMonth() + 1}월 ${weekNum}주차`
    if (!groups[key]) groups[key] = []
    groups[key].push(msg)
  })
  return groups
}

/** @이름 부분을 하이라이트하여 렌더링 */
function renderTextWithMentions(text: string) {
  const parts = text.split(/(@\S+)/g)
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-semibold text-primary">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

export default function ResourcesPage() {
  const [messages, setMessages] = useState<Resource[]>([])
  const [archivedMessages, setArchivedMessages] = useState<Resource[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = useState<string | null>(null)
  const [isMaster, setIsMaster] = useState(false)
  const [members, setMembers] = useState<Profile[]>([])
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 멘션 자동완성 상태
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredMembers, setFilteredMembers] = useState<Profile[]>([])
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    }, 100)
  }

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setCurrentUserId(user.id)
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role, display_name')
              .eq('id', user.id)
              .single()
            if (profile?.role === 'master') setIsMaster(true)
            if (profile?.display_name) setCurrentUserName(profile.display_name)
          } catch { }
        }

        // 팀원 목록 로드
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: true })
        if (allProfiles) setMembers(allProfiles)

        const data = await getMessages()
        setMessages(data ?? [])
      } catch (err) {
        console.error('메시지 로딩 실패:', err)
        toast.error('메시지를 불러오는데 실패했습니다.')
      }
    }
    init()
  }, [])

  // Supabase Realtime 구독 (다른 유저의 변경사항도 실시간 반영)
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('resources-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'resources' },
        () => { refreshMessages() }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'resources' },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages.length])

  const loadArchive = async () => {
    if (archivedMessages.length > 0) return
    try {
      const data = await getArchivedMessages()
      setArchivedMessages(data ?? [])
    } catch (err) {
      console.error('아카이브 로딩 실패:', err)
    }
  }

  const refreshMessages = async () => {
    try {
      const data = await getMessages()
      setMessages(data ?? [])
    } catch (err) {
      console.error('메시지 새로고침 실패:', err)
    }
  }

  const sendMentionNotifications = useCallback(async (text: string) => {
    const mentioned = extractMentions(text, members)
    const others = mentioned.filter((m) => m.id !== currentUserId)
    if (others.length === 0) return

    try {
      await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mentionedUserIds: others.map((m) => m.id),
          mentionerName: currentUserName ?? '팀원',
          source: 'resource',
          messagePreview: text.length > 100 ? text.slice(0, 100) + '...' : text,
        }),
      })
    } catch (err) {
      console.error('멘션 알림 실패:', err)
    }
  }, [members, currentUserId, currentUserName])

  // 멘션 입력 핸들러
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart ?? newValue.length
    setContent(newValue)

    const textBeforeCursor = newValue.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex >= 0) {
      const charBefore = lastAtIndex > 0 ? newValue[lastAtIndex - 1] : ' '
      if (charBefore === ' ' || lastAtIndex === 0) {
        const query = textBeforeCursor.slice(lastAtIndex + 1)
        if (!query.includes(' ')) {
          const filtered = members.filter((m) =>
            m.display_name.toLowerCase().includes(query.toLowerCase())
          )
          setFilteredMembers(filtered)
          setShowSuggestions(filtered.length > 0)
          setMentionStart(lastAtIndex)
          setSelectedIndex(0)
          return
        }
      }
    }

    setShowSuggestions(false)
    setMentionStart(null)
  }

  const insertMention = (member: Profile) => {
    if (mentionStart === null) return
    const cursorPos = inputRef.current?.selectionStart ?? content.length
    const before = content.slice(0, mentionStart)
    const after = content.slice(cursorPos)
    const newValue = `${before}@${member.display_name} ${after}`
    setContent(newValue)
    setShowSuggestions(false)
    setMentionStart(null)

    setTimeout(() => {
      const pos = mentionStart + member.display_name.length + 2
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(pos, pos)
    }, 0)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % filteredMembers.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length)
    } else if (e.key === 'Enter' && filteredMembers[selectedIndex]) {
      e.preventDefault()
      insertMention(filteredMembers[selectedIndex])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (showSuggestions) return // 멘션 선택 중이면 전송 방지
    const trimmedContent = content.trim()
    if (!trimmedContent) return

    setIsLoading(true)
    try {
      await createMessage({
        content: trimmedContent,
      })
      // 멘션 알림 발송
      await sendMentionNotifications(trimmedContent)
      setContent('')
      await refreshMessages()
    } catch (err) {
      console.error('메시지 등록 실패:', err)
      toast.error('메시지 등록에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteMessage(id)
      setMessages((prev) => prev.filter((m) => m.id !== id))
      toast.success('메시지를 삭제했습니다.')
    } catch (err) {
      console.error('메시지 삭제 실패:', err)
      toast.error('메시지 삭제에 실패했습니다.')
    }
  }

  const canDelete = (message: Resource) => {
    return isMaster || message.author_id === currentUserId
  }

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase()
  }

  const archivedGroups = groupByWeek(archivedMessages)

  const renderMessageContent = (message: Resource) => {
    const urls = extractUrls(message.content)
    const imageUrls = urls.filter(isImageUrl)
    const linkUrls = urls.filter((u) => !isImageUrl(u))

    return (
      <>
        <p className="mt-0.5 text-sm whitespace-pre-wrap break-words">
          {renderTextWithMentions(message.content)}
        </p>
        {message.url && !urls.includes(message.url) && (
          <a
            href={message.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary mt-1 inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
          >
            <ExternalLink className="size-3.5" />
            <span className="truncate">{message.url}</span>
          </a>
        )}
        {imageUrls.map((imgUrl) => (
          <img
            key={imgUrl}
            src={imgUrl}
            alt=""
            className="mt-2 max-h-60 rounded-lg border object-contain"
          />
        ))}
        {linkUrls.map((linkUrl) => (
          <OgPreviewCard key={linkUrl} url={linkUrl} />
        ))}
        {message.url && isImageUrl(message.url) && (
          <img
            src={message.url}
            alt=""
            className="mt-2 max-h-60 rounded-lg border object-contain"
          />
        )}
        {message.url && !isImageUrl(message.url) && !urls.includes(message.url) && (
          <OgPreviewCard url={message.url} />
        )}
      </>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <Card className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <MessageSquare className="text-muted-foreground size-5" />
          <h2 className="text-lg font-semibold">리소스 공유</h2>
          <span className="text-muted-foreground text-sm">
            ({messages.length})
          </span>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1 p-4">
            {/* 이전 대화 아카이브 */}
            <Collapsible open={showArchive} onOpenChange={(open) => {
              setShowArchive(open)
              if (open) loadArchive()
            }}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground mb-2">
                  <ChevronDown className={`size-3.5 mr-1 transition-transform ${showArchive ? 'rotate-180' : ''}`} />
                  이전 대화 보기
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {Object.keys(archivedGroups).length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-4">이전 대화가 없습니다.</p>
                ) : (
                  Object.entries(archivedGroups).map(([week, msgs]) => (
                    <div key={week} className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-[10px] text-muted-foreground shrink-0">{week}</span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                      {msgs.map((message) => {
                        const displayName = message.profiles?.display_name ?? '알 수 없음'
                        const userColor = getUserColor(message.author_id, message.profiles)
                        return (
                          <div key={message.id} className="flex items-start gap-3 rounded-lg px-3 py-2 opacity-60">
                            <Avatar size="sm" className="mt-0.5 shrink-0">
                              <AvatarFallback
                                className={cn("font-medium border !border-white/10", userColor.text)}
                                style={{ backgroundColor: userColor.hex }}
                              >
                                {getInitials(displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2">
                                <span className="text-sm font-medium">{displayName}</span>
                                <span className="text-muted-foreground text-xs">
                                  {format(new Date(message.created_at), 'M/d HH:mm', { locale: ko })}
                                </span>
                              </div>
                              <p className="mt-0.5 text-sm whitespace-pre-wrap break-words">
                                {renderTextWithMentions(message.content)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))
                )}
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] text-muted-foreground shrink-0">최근 14일</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {messages.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center justify-center py-20 text-sm">
                <MessageSquare className="mb-2 size-10 opacity-30" />
                <p>아직 공유된 리소스가 없습니다.</p>
                <p>첫 번째 리소스를 공유해보세요!</p>
              </div>
            ) : (
              messages.map((message) => {
                const displayName =
                  message.profiles?.display_name ?? '알 수 없음'
                const userColor = getUserColor(message.author_id, message.profiles)

                return (
                  <div
                    key={message.id}
                    className="group hover:bg-muted/50 flex items-start gap-3 rounded-lg px-3 py-2 transition-colors"
                  >
                    <Avatar size="sm" className="mt-0.5 shrink-0">
                      {message.profiles?.avatar_url ? (
                        <AvatarImage
                          src={message.profiles.avatar_url}
                          alt={displayName}
                        />
                      ) : null}
                      <AvatarFallback
                        className={cn("font-medium border !border-white/10", userColor.text)}
                        style={{ backgroundColor: userColor.hex }}
                      >
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium flex items-center gap-1">
                          {displayName}
                          {message.profiles?.role === 'master' && <Crown className="size-3 text-yellow-500" />}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {format(
                            new Date(message.created_at),
                            'M/d HH:mm',
                            { locale: ko }
                          )}
                        </span>
                      </div>
                      {renderMessageContent(message)}
                    </div>

                    {canDelete(message) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => handleDelete(message.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                )
              })
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Input with mention support */}
        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
            {/* 멘션 자동완성 드롭다운 */}
            {showSuggestions && (
              <div className="absolute bottom-full left-0 right-12 z-50 mb-1 rounded-md border bg-popover p-1 shadow-md">
                {filteredMembers.map((member, i) => {
                  const uc = getUserColor(member.id, member.user_color)
                  return (
                    <button
                      key={member.id}
                      type="button"
                      className={cn(
                        'w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2',
                        i === selectedIndex && 'bg-accent'
                      )}
                      onMouseDown={(e) => { e.preventDefault(); insertMention(member) }}
                    >
                      <Avatar className="size-5">
                        <AvatarFallback
                          className={cn("text-[9px] font-bold", uc.text)}
                          style={{ backgroundColor: uc.hex }}
                        >
                          {member.display_name.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>@{member.display_name}</span>
                      {member.role === 'master' && <Crown className="size-3 text-yellow-500" />}
                    </button>
                  )
                })}
              </div>
            )}
            <Input
              ref={inputRef}
              placeholder="리소스를 공유해보세요... (@로 팀원 멘션)"
              value={content}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              className="h-9 text-sm"
            />
            <Button
              type="submit"
              size="icon"
              className="size-9 shrink-0"
              disabled={!content.trim() || isLoading}
            >
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
