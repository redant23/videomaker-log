'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Film, ExternalLink, Pencil, Trash2, MoreHorizontal, Tag, Youtube, Instagram, Globe, Users, Loader2, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

import type { PortfolioItem, Profile } from '@/types'
import { createClient } from '@/lib/supabase/client'
import {
  getPortfolioItems, createPortfolioItem, updatePortfolioItem, deletePortfolioItem, getDistinctAccounts,
} from '@/actions/portfolio'
import { fetchVideoMetadata } from '@/lib/video-metadata'
import { getUserColor } from '@/lib/colors'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

type FormData = {
  title: string
  description: string
  video_url: string
  tags: string
  account: string
  created_by: string
  thumbnail_url: string
}

const emptyForm: FormData = { title: '', description: '', video_url: '', tags: '', account: '', created_by: '', thumbnail_url: '' }

function isInstagramCdn(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return hostname.endsWith('fbcdn.net') || hostname.endsWith('cdninstagram.com')
  } catch {
    return false
  }
}

function proxyThumbnail(url: string): string {
  if (isInstagramCdn(url)) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`
  }
  return url
}

function VideoTypeIcon({ type, url }: { type: PortfolioItem['video_type']; url?: string }) {
  const isYt = type === 'youtube' || (url && /youtube\.com|youtu\.be/.test(url))
  const isIg = type === 'instagram' || (url && /instagram\.com/.test(url))
  if (isYt) return <Youtube className="size-4 text-red-500" />
  if (isIg) return <Instagram className="size-4 text-pink-500" />
  return <Globe className="size-4 text-muted-foreground" />
}

export default function PortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [activeUser, setActiveUser] = useState<string | null>(null)
  const [activePlatform, setActivePlatform] = useState<string | null>(null)
  const [members, setMembers] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isMaster, setIsMaster] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null)
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [previewItem, setPreviewItem] = useState<PortfolioItem | null>(null)
  const [accounts, setAccounts] = useState<string[]>([])
  const [fetchingMeta, setFetchingMeta] = useState(false)
  const [showAccountSuggestions, setShowAccountSuggestions] = useState(false)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        try {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
          if (profile?.role === 'master') setIsMaster(true)
        } catch { }
      }
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: true })
      if (data) setMembers(data)

      try { const accts = await getDistinctAccounts(); setAccounts(accts) } catch { }
    }
    init()
  }, [])

  const canModify = (item: PortfolioItem) => isMaster || item.created_by === currentUserId

  const fetchItems = useCallback(async () => {
    try {
      const data = await getPortfolioItems()
      setItems(data ?? [])
    } catch (err) {
      console.error('포트폴리오 로딩 실패:', err)
      toast.error('포트폴리오를 불러오는데 실패했습니다.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { setLoading(true); fetchItems() }, [fetchItems])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    items.forEach((item) => item.tags?.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [items])

  const filteredItems = useMemo(() => {
    let result = items
    if (activeUser) result = result.filter((item) => item.created_by === activeUser)
    if (activePlatform) result = result.filter((item) => {
      if (activePlatform === 'instagram') return item.video_type === 'instagram' || /instagram\.com/.test(item.video_url)
      return item.video_type === activePlatform
    })
    if (activeTag) result = result.filter((item) => item.tags?.includes(activeTag))
    return result
  }, [items, activeUser, activePlatform, activeTag])

  function openCreateDialog() {
    setEditingItem(null)
    setFormData({ ...emptyForm, created_by: currentUserId || '' })
    setDialogOpen(true)
  }

  function openEditDialog(item: PortfolioItem) {
    setEditingItem(item)
    setFormData({
      title: item.title,
      description: item.description ?? '',
      video_url: item.video_url,
      tags: item.tags?.join(', ') ?? '',
      account: item.account ?? '',
      created_by: item.created_by,
      thumbnail_url: item.thumbnail_url ?? '',
    })
    setDialogOpen(true)
  }

  async function handleFetchMetadata() {
    if (!formData.video_url.trim()) return
    setFetchingMeta(true)
    try {
      const meta = await fetchVideoMetadata(formData.video_url.trim())
      if (meta) {
        setFormData((prev) => ({
          ...prev,
          title: prev.title || meta.title,
          description: prev.description || meta.description,
          tags: prev.tags || (meta.tags.length > 0 ? meta.tags.join(', ') : ''),
          account: prev.account || meta.account,
          thumbnail_url: prev.thumbnail_url || meta.thumbnail_url,
        }))
        toast.success('영상 정보를 가져왔습니다.')
      } else {
        toast.error('영상 정보를 가져올 수 없습니다.')
      }
    } catch { toast.error('영상 정보 가져오기 실패') }
    finally { setFetchingMeta(false) }
  }

  async function handleSubmit() {
    if (!formData.title.trim() || !formData.video_url.trim()) {
      toast.error('제목과 영상 URL은 필수입니다.')
      return
    }
    setSubmitting(true)
    const tags = formData.tags.split(',').map((t) => t.trim()).filter(Boolean)
    try {
      if (editingItem) {
        await updatePortfolioItem(editingItem.id, {
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          video_url: formData.video_url.trim(),
          tags,
          account: formData.account.trim() || undefined,
          thumbnail_url: formData.thumbnail_url || undefined,
          created_by: formData.created_by || undefined,
        })
        toast.success('포트폴리오가 수정되었습니다.')
      } else {
        await createPortfolioItem({
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          video_url: formData.video_url.trim(),
          tags,
          account: formData.account.trim() || undefined,
          created_by: formData.created_by || undefined,
          thumbnail_url: formData.thumbnail_url || undefined,
        })
        toast.success('포트폴리오가 등록되었습니다.')
      }
      setDialogOpen(false)
      fetchItems()
      try { const accts = await getDistinctAccounts(); setAccounts(accts) } catch { }
    } catch (err) {
      console.error('포트폴리오 저장 실패:', err)
      toast.error(editingItem ? '수정에 실패했습니다.' : '등록에 실패했습니다.')
    } finally { setSubmitting(false) }
  }

  async function handleDelete(id: string) {
    try { await deletePortfolioItem(id); toast.success('포트폴리오가 삭제되었습니다.'); fetchItems() }
    catch (err) { console.error('포트폴리오 삭제 실패:', err); toast.error('삭제에 실패했습니다.') }
  }

  const filteredAccountSuggestions = accounts.filter((a) =>
    a.toLowerCase().includes(formData.account.toLowerCase()) && a !== formData.account
  )

  return (
    <div className="space-y-6 flex-1 overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">포트폴리오</h1>
          <p className="text-xs md:text-sm text-muted-foreground">영상 포트폴리오를 관리합니다.</p>
        </div>
        <Button size="sm" className="md:h-9 md:px-4 md:text-sm" onClick={openCreateDialog}><Plus />새 영상</Button>
      </div>

      {members.length > 0 && (() => {
        const creatorsWithItems = new Set(items.map((item) => item.created_by))
        const activeMembers = members.filter((m) => creatorsWithItems.has(m.id))
        return activeMembers.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <Badge variant={activeUser === null ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setActiveUser(null)}>전체</Badge>
            {activeMembers.map((member) => (
              <Badge key={member.id} variant={activeUser === member.id ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setActiveUser(activeUser === member.id ? null : member.id)}>
                {member.display_name}
              </Badge>
            ))}
          </div>
        ) : null
      })()}

      <div className="flex flex-wrap items-center gap-2">
        <Film className="size-4 text-muted-foreground" />
        <Badge variant={activePlatform === null ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setActivePlatform(null)}>전체</Badge>
        <Badge variant={activePlatform === 'youtube' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setActivePlatform(activePlatform === 'youtube' ? null : 'youtube')}>
          <Youtube className="size-3" />YouTube
        </Badge>
        <Badge variant={activePlatform === 'instagram' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setActivePlatform(activePlatform === 'instagram' ? null : 'instagram')}>
          <Instagram className="size-3" />Instagram
        </Badge>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Tag className="size-4 text-muted-foreground" />
          <Badge variant={activeTag === null ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setActiveTag(null)}>전체</Badge>
          {allTags.map((tag) => (
            <Badge key={tag} variant={activeTag === tag ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setActiveTag(activeTag === tag ? null : tag)}>
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">불러오는 중...</div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
          <Film className="size-10" />
          <p>포트폴리오가 없습니다</p>
          {activeTag && <Button variant="link" onClick={() => setActiveTag(null)}>필터 초기화</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <Card key={item.id} className="group overflow-hidden py-0 gap-0">
              <button type="button" className={cn("relative aspect-video w-full cursor-pointer overflow-hidden", item.thumbnail_url && isInstagramCdn(item.thumbnail_url) ? 'bg-black' : 'bg-muted')} onClick={() => setPreviewItem(item)}>
                {item.thumbnail_url ? (
                  <img src={proxyThumbnail(item.thumbnail_url)} alt={item.title} referrerPolicy="no-referrer" className={cn("h-full w-full transition-transform group-hover:scale-105", isInstagramCdn(item.thumbnail_url) ? 'object-contain' : 'object-cover')} />
                ) : item.video_type === 'instagram' ? (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400">
                    <Instagram className="size-12 text-white" />
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><Film className="size-12 text-muted-foreground" /></div>
                )}
              </button>

              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <VideoTypeIcon type={item.video_type} url={item.video_url} />
                      <h3 className="truncate text-sm font-semibold">{item.title}</h3>
                    </div>
                    {item.account && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.account}
                      </p>
                    )}
                  </div>
                  {canModify(item) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs" className="shrink-0"><MoreHorizontal /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(item)}><Pencil />수정</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(item.video_url, '_blank')}><ExternalLink />URL 열기</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(item.id)}><Trash2 />삭제</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                {item.description && <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer text-[10px]" onClick={() => setActiveTag(tag)}>{tag}</Badge>
                    ))}
                  </div>
                )}
                {item.profiles?.display_name && (() => {
                  const uc = getUserColor(item.created_by, item.profiles)
                  return (
                    <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
                      <Avatar className="size-4">
                        <AvatarFallback
                          className={cn("text-[8px] font-bold border !border-white/20", uc.text)}
                          style={{ backgroundColor: uc.hex }}
                        >
                          {item.profiles.display_name.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                        {item.profiles.display_name}
                        {item.profiles.role === 'master' && <Crown className="size-2.5 text-yellow-500" />}
                      </span>
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? '포트폴리오 수정' : '새 영상 등록'}</DialogTitle>
            <DialogDescription>{editingItem ? '포트폴리오 항목을 수정합니다.' : 'YouTube 또는 Instagram URL을 붙여넣어 영상을 등록하세요.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="video_url">영상 URL</Label>
              <div className="flex gap-2">
                <Input id="video_url" placeholder="https://youtube.com/watch?v=..." value={formData.video_url} onChange={(e) => setFormData({ ...formData, video_url: e.target.value })} className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={handleFetchMetadata} disabled={fetchingMeta || !formData.video_url.trim()}>
                  {fetchingMeta ? <Loader2 className="size-4 animate-spin" /> : '자동입력'}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">제목</Label>
              <Input id="title" placeholder="영상 제목" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">설명</Label>
              <Textarea id="description" placeholder="간단한 설명 (선택)" rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">태그</Label>
              <Input id="tags" placeholder="예: 음악, 브이로그, 튜토리얼 (쉼표로 구분)" value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="account">계정</Label>
              <Input
                id="account"
                placeholder="채널 또는 계정명 (선택)"
                value={formData.account}
                onChange={(e) => { setFormData({ ...formData, account: e.target.value }); setShowAccountSuggestions(true) }}
                onFocus={() => setShowAccountSuggestions(true)}
                onBlur={() => setTimeout(() => setShowAccountSuggestions(false), 200)}
              />
              {showAccountSuggestions && filteredAccountSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover p-1 shadow-md">
                  {filteredAccountSuggestions.map((acct) => (
                    <button key={acct} type="button" className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent" onClick={() => { setFormData({ ...formData, account: acct }); setShowAccountSuggestions(false) }}>
                      {acct}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {members.length > 1 && (
              <div className="space-y-2">
                <Label>제작자</Label>
                <Select value={formData.created_by} onValueChange={(v) => setFormData({ ...formData, created_by: v })}>
                  <SelectTrigger><SelectValue placeholder="제작자 선택" /></SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.display_name}{m.id === currentUserId ? ' (나)' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">취소</Button></DialogClose>
            <Button onClick={handleSubmit} disabled={submitting}>{submitting ? '저장 중...' : editingItem ? '수정' : '등록'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewItem !== null} onOpenChange={(open) => { if (!open) setPreviewItem(null) }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <VideoTypeIcon type={previewItem?.video_type ?? 'other'} url={previewItem?.video_url} />
              {previewItem?.title}
            </DialogTitle>
            {previewItem?.account && <DialogDescription>{previewItem.account}</DialogDescription>}
          </DialogHeader>
          {previewItem && (
            <div className="space-y-4">
              {previewItem.video_type === 'youtube' ? (
                <div className="aspect-video w-full overflow-hidden rounded-md">
                  <iframe src={`https://www.youtube.com/embed/${previewItem.video_id}`} title={previewItem.title} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                </div>
              ) : previewItem.thumbnail_url ? (
                <div className={cn("relative aspect-video w-full overflow-hidden rounded-md cursor-pointer group/preview", previewItem.thumbnail_url && isInstagramCdn(previewItem.thumbnail_url) ? 'bg-black' : 'bg-muted')} onClick={() => window.open(previewItem.video_url, '_blank')}>
                  <img src={proxyThumbnail(previewItem.thumbnail_url)} alt={previewItem.title} referrerPolicy="no-referrer" className={cn("h-full w-full transition-transform group-hover/preview:scale-105", isInstagramCdn(previewItem.thumbnail_url) ? 'object-contain' : 'object-cover')} />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/preview:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-black">
                      <ExternalLink className="size-4" />영상 열기
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-md bg-muted">
                  <div className="text-center text-muted-foreground">
                    <Film className="mx-auto size-12" />
                    <Button variant="secondary" size="sm" className="mt-3" onClick={() => window.open(previewItem.video_url, '_blank')}><ExternalLink />영상 열기</Button>
                  </div>
                </div>
              )}
              {previewItem.description && <p className="text-sm text-muted-foreground">{previewItem.description}</p>}
              {previewItem.tags && previewItem.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">{previewItem.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
