'use client'

import { useEffect, useRef, useState } from 'react'
import { format, startOfWeek, getWeek } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import { Send, Link as LinkIcon, Trash2, ExternalLink, MessageSquare, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { getMessages, getArchivedMessages, createMessage, deleteMessage } from '@/actions/resources'
import type { Resource } from '@/types'
import { getUserColor } from '@/lib/colors'
import { extractUrls, isImageUrl } from '@/lib/url-utils'
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
    const weekStart = startOfWeek(date, { weekStartsOn: 1 })
    const weekNum = getWeek(date, { weekStartsOn: 1 })
    const year = date.getFullYear()
    const key = `${year}년 ${date.getMonth() + 1}월 ${weekNum}주차`
    if (!groups[key]) groups[key] = []
    groups[key].push(msg)
  })
  return groups
}

export default function ResourcesPage() {
  const [messages, setMessages] = useState<Resource[]>([])
  const [archivedMessages, setArchivedMessages] = useState<Resource[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isMaster, setIsMaster] = useState(false)
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [showUrlField, setShowUrlField] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

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
              .select('role')
              .eq('id', user.id)
              .single()
            if (profile?.role === 'master') setIsMaster(true)
          } catch {}
        }

        const data = await getMessages()
        setMessages(data ?? [])
      } catch (err) {
        console.error('메시지 로딩 실패:', err)
        toast.error('메시지를 불러오는데 실패했습니다.')
      }
    }
    init()
  }, [])

  // Supabase Realtime 구독
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('resources-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'resources' },
        async () => {
          const data = await getMessages()
          setMessages(data ?? [])
        }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedContent = content.trim()
    if (!trimmedContent) return

    setIsLoading(true)
    try {
      await createMessage({
        content: trimmedContent,
        url: url.trim() || undefined,
      })
      setContent('')
      setUrl('')
      setShowUrlField(false)
      toast.success('메시지를 등록했습니다.')
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
          {message.content}
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
    <div className="flex h-full flex-col">
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
                        const userColor = getUserColor(message.author_id, (message.profiles as any)?.user_color)
                        return (
                          <div key={message.id} className="flex items-start gap-3 rounded-lg px-3 py-2 opacity-60">
                            <Avatar size="sm" className="mt-0.5 shrink-0">
                              <AvatarFallback className={`${userColor.bg} ${userColor.text} font-medium border !border-white/10`}>
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
                              <p className="mt-0.5 text-sm whitespace-pre-wrap break-words">{message.content}</p>
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
                const userColor = getUserColor(message.author_id, (message.profiles as any)?.user_color)

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
                      <AvatarFallback className={`${userColor.bg} ${userColor.text} font-medium border !border-white/10`}>
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium">
                          {displayName}
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

        {/* Input */}
        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            {showUrlField && (
              <div className="flex items-center gap-2">
                <LinkIcon className="text-muted-foreground size-4 shrink-0" />
                <Input
                  type="url"
                  placeholder="URL을 입력하세요 (선택)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={showUrlField ? 'secondary' : 'ghost'}
                size="icon"
                className="size-9 shrink-0"
                onClick={() => setShowUrlField(!showUrlField)}
              >
                <LinkIcon className="size-4" />
              </Button>
              <Input
                placeholder="리소스를 공유해보세요..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
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
            </div>
          </form>
        </div>
      </Card>
    </div>
  )
}
