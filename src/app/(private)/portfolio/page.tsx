'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Film,
  ExternalLink,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  MoreHorizontal,
  Tag,
  Youtube,
  Instagram,
  Globe,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import type { PortfolioItem, Profile } from '@/types'
import { createClient } from '@/lib/supabase/client'
import {
  getPortfolioItems,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  togglePortfolioPublic,
} from '@/actions/portfolio'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

type FormData = {
  title: string
  description: string
  video_url: string
  tags: string
  account: string
}

const emptyForm: FormData = {
  title: '',
  description: '',
  video_url: '',
  tags: '',
  account: '',
}

function VideoTypeIcon({ type }: { type: PortfolioItem['video_type'] }) {
  switch (type) {
    case 'youtube':
      return <Youtube className="size-4 text-red-500" />
    case 'instagram':
      return <Instagram className="size-4 text-pink-500" />
    default:
      return <Globe className="size-4 text-muted-foreground" />
  }
}

export default function PortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [activeUser, setActiveUser] = useState<string | null>(null)
  const [members, setMembers] = useState<Profile[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null)
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [previewItem, setPreviewItem] = useState<PortfolioItem | null>(null)

  useEffect(() => {
    async function loadMembers() {
      const supabase = createClient()
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true })
      if (data) setMembers(data)
    }
    loadMembers()
  }, [])

  const fetchItems = useCallback(async () => {
    try {
      const data = await getPortfolioItems(
        activeUser ? { created_by: activeUser } : undefined
      )
      setItems(data ?? [])
    } catch (err) {
      console.error('포트폴리오 로딩 실패:', err)
      toast.error('포트폴리오를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [activeUser])

  useEffect(() => {
    setLoading(true)
    fetchItems()
  }, [fetchItems])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    items.forEach((item) => item.tags?.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [items])

  const filteredItems = useMemo(() => {
    if (!activeTag) return items
    return items.filter((item) => item.tags?.includes(activeTag))
  }, [items, activeTag])

  function openCreateDialog() {
    setEditingItem(null)
    setFormData(emptyForm)
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
    })
    setDialogOpen(true)
  }

  async function handleSubmit() {
    if (!formData.title.trim() || !formData.video_url.trim()) {
      toast.error('제목과 영상 URL은 필수입니다.')
      return
    }

    setSubmitting(true)
    const tags = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    try {
      if (editingItem) {
        await updatePortfolioItem(editingItem.id, {
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          video_url: formData.video_url.trim(),
          tags,
          account: formData.account.trim() || undefined,
          is_public: editingItem.is_public,
        })
        toast.success('포트폴리오가 수정되었습니다.')
      } else {
        await createPortfolioItem({
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          video_url: formData.video_url.trim(),
          tags,
          account: formData.account.trim() || undefined,
        })
        toast.success('포트폴리오가 등록되었습니다.')
      }
      setDialogOpen(false)
      fetchItems()
    } catch (err) {
      console.error('포트폴리오 저장 실패:', err)
      toast.error(editingItem ? '수정에 실패했습니다.' : '등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deletePortfolioItem(id)
      toast.success('포트폴리오가 삭제되었습니다.')
      fetchItems()
    } catch (err) {
      console.error('포트폴리오 삭제 실패:', err)
      toast.error('삭제에 실패했습니다.')
    }
  }

  async function handleTogglePublic(item: PortfolioItem) {
    try {
      await togglePortfolioPublic(item.id, !item.is_public)
      toast.success(item.is_public ? '비공개로 변경되었습니다.' : '공개로 변경되었습니다.')
      fetchItems()
    } catch (err) {
      console.error('공개 설정 변경 실패:', err)
      toast.error('공개 설정 변경에 실패했습니다.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">포트폴리오</h1>
          <p className="text-sm text-muted-foreground">
            영상 포트폴리오를 관리합니다.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus />
          새 영상
        </Button>
      </div>

      {/* User Filter */}
      {members.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <Badge
            variant={activeUser === null ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setActiveUser(null)}
          >
            전체
          </Badge>
          {members.map((member) => (
            <Badge
              key={member.id}
              variant={activeUser === member.id ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setActiveUser(activeUser === member.id ? null : member.id)}
            >
              {member.display_name}
            </Badge>
          ))}
        </div>
      )}

      {/* Tag Filters */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Tag className="size-4 text-muted-foreground" />
          <Badge
            variant={activeTag === null ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setActiveTag(null)}
          >
            전체
          </Badge>
          {allTags.map((tag) => (
            <Badge
              key={tag}
              variant={activeTag === tag ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Video Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          불러오는 중...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
          <Film className="size-10" />
          <p>포트폴리오가 없습니다</p>
          {activeTag && (
            <Button variant="link" onClick={() => setActiveTag(null)}>
              필터 초기화
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <Card key={item.id} className="group overflow-hidden py-0 gap-0">
              {/* Thumbnail */}
              <button
                type="button"
                className="relative aspect-video w-full cursor-pointer overflow-hidden bg-muted"
                onClick={() => setPreviewItem(item)}
              >
                {item.video_type === 'youtube' && item.thumbnail_url ? (
                  <img
                    src={item.thumbnail_url}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : item.video_type === 'instagram' ? (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400">
                    <Instagram className="size-12 text-white" />
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Film className="size-12 text-muted-foreground" />
                  </div>
                )}
                {/* Public/Private indicator overlay */}
                <div className="absolute top-2 left-2">
                  <Badge
                    variant={item.is_public ? 'default' : 'secondary'}
                    className="text-[10px]"
                  >
                    {item.is_public ? (
                      <Eye className="size-3" />
                    ) : (
                      <EyeOff className="size-3" />
                    )}
                    {item.is_public ? '공개' : '비공개'}
                  </Badge>
                </div>
              </button>

              <CardContent className="space-y-3 p-4">
                {/* Title & Action Menu */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <VideoTypeIcon type={item.video_type} />
                      <h3 className="truncate text-sm font-semibold">
                        {item.title}
                      </h3>
                    </div>
                    {(item.account || item.profiles?.display_name) && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.account}
                        {item.account && item.profiles?.display_name && ' · '}
                        {item.profiles?.display_name}
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0"
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(item)}>
                        <Pencil />
                        수정
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          window.open(item.video_url, '_blank')
                        }
                      >
                        <ExternalLink />
                        URL 열기
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleTogglePublic(item)}
                      >
                        {item.is_public ? <EyeOff /> : <Eye />}
                        {item.is_public ? '비공개로 변경' : '공개로 변경'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 />
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Description Preview */}
                {item.description && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {item.description}
                  </p>
                )}

                {/* Tags */}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer text-[10px]"
                        onClick={() => setActiveTag(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? '포트폴리오 수정' : '새 영상 등록'}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? '포트폴리오 항목을 수정합니다.'
                : 'YouTube 또는 Instagram URL을 붙여넣어 영상을 등록하세요.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="video_url">영상 URL</Label>
              <Input
                id="video_url"
                placeholder="https://youtube.com/watch?v=... 또는 https://instagram.com/reel/..."
                value={formData.video_url}
                onChange={(e) =>
                  setFormData({ ...formData, video_url: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">제목</Label>
              <Input
                id="title"
                placeholder="영상 제목"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">설명</Label>
              <Textarea
                id="description"
                placeholder="간단한 설명 (선택)"
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">태그</Label>
              <Input
                id="tags"
                placeholder="예: 음악, 브이로그, 튜토리얼 (쉼표로 구분)"
                value={formData.tags}
                onChange={(e) =>
                  setFormData({ ...formData, tags: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account">계정</Label>
              <Input
                id="account"
                placeholder="채널 또는 계정명 (선택)"
                value={formData.account}
                onChange={(e) =>
                  setFormData({ ...formData, account: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">취소</Button>
            </DialogClose>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting
                ? '저장 중...'
                : editingItem
                  ? '수정'
                  : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog
        open={previewItem !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null)
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <VideoTypeIcon type={previewItem?.video_type ?? 'other'} />
              {previewItem?.title}
            </DialogTitle>
            {previewItem?.account && (
              <DialogDescription>{previewItem.account}</DialogDescription>
            )}
          </DialogHeader>

          {previewItem && (
            <div className="space-y-4">
              {/* Embed / Preview */}
              {previewItem.video_type === 'youtube' ? (
                <div className="aspect-video w-full overflow-hidden rounded-md">
                  <iframe
                    src={`https://www.youtube.com/embed/${previewItem.video_id}`}
                    title={previewItem.title}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : previewItem.video_type === 'instagram' ? (
                <div className="flex aspect-video items-center justify-center rounded-md bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400">
                  <div className="text-center text-white">
                    <Instagram className="mx-auto size-12" />
                    <p className="mt-2 text-sm">Instagram Reel</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      onClick={() =>
                        window.open(previewItem.video_url, '_blank')
                      }
                    >
                      <ExternalLink />
                      Instagram에서 열기
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-md bg-muted">
                  <div className="text-center text-muted-foreground">
                    <Film className="mx-auto size-12" />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      onClick={() =>
                        window.open(previewItem.video_url, '_blank')
                      }
                    >
                      <ExternalLink />
                      영상 열기
                    </Button>
                  </div>
                </div>
              )}

              {/* Description */}
              {previewItem.description && (
                <p className="text-sm text-muted-foreground">
                  {previewItem.description}
                </p>
              )}

              {/* Tags */}
              {previewItem.tags && previewItem.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {previewItem.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
