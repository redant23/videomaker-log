'use client'

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import { Send, Link as LinkIcon, Trash2, ExternalLink, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { getMessages, createMessage, deleteMessage } from '@/actions/resources'
import type { Resource } from '@/types'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function ResourcesPage() {
  const [messages, setMessages] = useState<Resource[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [showUrlField, setShowUrlField] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
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
        if (user) setCurrentUserId(user.id)

        const data = await getMessages()
        setMessages(data ?? [])
      } catch (err) {
        console.error('메시지 로딩 실패:', err)
        toast.error('메시지를 불러오는데 실패했습니다.')
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages.length])

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
      const data = await getMessages()
      setMessages(data ?? [])
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

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase()
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
            {messages.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center justify-center py-20 text-sm">
                <MessageSquare className="mb-2 size-10 opacity-30" />
                <p>아직 공유된 리소스가 없습니다.</p>
                <p>첫 번째 리소스를 공유해보세요!</p>
              </div>
            ) : (
              messages.map((message) => {
                const isMine = message.author_id === currentUserId
                const displayName =
                  message.profiles?.display_name ?? '알 수 없음'

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
                      <AvatarFallback>
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
                      <p className="mt-0.5 text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                      {message.url && (
                        <a
                          href={message.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary mt-1 inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
                        >
                          <ExternalLink className="size-3.5" />
                          <span className="truncate">
                            {message.url}
                          </span>
                        </a>
                      )}
                    </div>

                    {isMine && (
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
